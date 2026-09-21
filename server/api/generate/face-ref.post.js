const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

function normalizeBase64Image(rawValue) {
  const input = String(rawValue || '').trim();
  if (!input) return '';

  if (input.startsWith('data:')) {
    const commaIndex = input.indexOf(',');
    if (commaIndex === -1) return '';
    return input.slice(commaIndex + 1).trim();
  }

  return input;
}

function extractInlineDataFromResponse(response) {
  const candidate = response?.candidates?.[0];
  const parts = candidate?.content?.parts ?? [];

  if (!parts.length) {
    const finishReason = candidate?.finishReason;
    const error = new Error(`Gemini returned no parts. finishReason=${finishReason || 'unknown'}`);
    error.name = 'GeminiNoPartsError';
    error.finishReason = finishReason;
    throw error;
  }

  const imagePart = parts.find((part) => part?.inlineData?.data || part?.inline_data?.data);
  if (!imagePart) {
    throw new Error('Gemini did not return any image part');
  }

  return imagePart.inlineData ?? imagePart.inline_data;
}

function isRetryableNoPartsFinishReason(finishReason) {
  const normalized = String(finishReason || '').trim().toUpperCase();
  if (!normalized) return true;
  return normalized.includes('IMAGE_SAFETY') || normalized.includes('IMAGE_OTHER') || normalized.includes('SAFETY');
}

function sanitizeFallbackPrompt(customPrompt) {
  const normalized = String(customPrompt || '').replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return 'Generate the reference sheet from this source image.';
  }

  const sentences = normalized
    .split(/(?<=\.)\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .filter((sentence) => !/imp[eé]rativ|prevail|prevaut|prevaud|must/i.test(sentence));

  return sentences.join(' ').trim() || 'Generate the reference sheet from this source image.';
}

async function generateFaceRefImage(genai, customPrompt, sourceImageBase64, Modality) {
  return genai.models.generateContent({
    model: 'gemini-3-pro-image-preview',
    contents: [
      {
        role: 'user',
        parts: [
          { text: 'Generate the reference sheet from this source image.' },
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: sourceImageBase64,
            },
          },
        ],
      },
    ],
    config: {
      systemInstruction: customPrompt,
      responseModalities: [Modality.TEXT, Modality.IMAGE],
    },
  })
}

async function generateFaceRefImageWithFallback(genai, customPrompt, sourceImageBase64, Modality) {
  try {
    const response = await generateFaceRefImage(genai, customPrompt, sourceImageBase64, Modality)
    return extractInlineDataFromResponse(response)
  } catch (error) {
    if (error?.name !== 'GeminiNoPartsError' || !isRetryableNoPartsFinishReason(error.finishReason)) {
      throw error
    }

    console.warn('[generate:face-ref] Gemini returned no parts, retrying with a sanitized prompt.', {
      finishReason: error.finishReason || 'unknown',
    })

    const fallbackPrompt = sanitizeFallbackPrompt(customPrompt)
    const retryResponse = await generateFaceRefImage(genai, fallbackPrompt, sourceImageBase64, Modality)
    return extractInlineDataFromResponse(retryResponse)
  }
}

module.exports = defineEventHandler(async (event) => {
  try {
    // Chaque appel depense du credit Gemini: sans session, n importe qui pouvait
    // le consommer. Import dynamique car ce fichier reste en `module.exports`
    // (un import statique casserait le serveur de dev, voir tasks/lessons.md).
    const authModule = await import('../../utils/auth.js');
    const user = await authModule.requireAuthUser(event);

    const body = await readBody(event);
    const sourceImageBase64 = normalizeBase64Image(body?.sourceImageBase64);
    const customPrompt = String(body?.customPrompt || '').trim();

    if (!sourceImageBase64) {
      return sendError(event, createError({ statusCode: 400, statusMessage: 'sourceImageBase64 requis' }));
    }

    if (!customPrompt) {
      return sendError(event, createError({ statusCode: 400, statusMessage: 'customPrompt requis' }));
    }

    const geminiKey = String(process.env.GEMINI_API_KEY || '').trim();
    if (!geminiKey || geminiKey === '...') {
      return sendError(event, createError({ statusCode: 500, statusMessage: 'GEMINI_API_KEY non configuree' }));
    }

    const { GoogleGenAI, Modality } = await import('@google/genai');
    const genai = new GoogleGenAI({ apiKey: geminiKey });

    const inlineData = await generateFaceRefImageWithFallback(genai, customPrompt, sourceImageBase64, Modality)
    const imageBase64 = String(inlineData?.data || '').trim();

    if (!imageBase64) {
      throw new Error('Image vide retournee par Gemini');
    }

    const buffer = Buffer.from(imageBase64, 'base64');

    const tempDir = path.join(process.cwd(), 'storage', 'temp');
    fs.mkdirSync(tempDir, { recursive: true });

    // Le nom porte l identifiant de l utilisateur et un suffixe aleatoire: un
    // horodatage seul se devine, et rien ne liait ce fichier a son auteur
    // (voir la verification correspondante dans upload/face-ref.post.js).
    const fileName = `faceref_${user.id}_${crypto.randomBytes(6).toString('hex')}.jpg`;
    const absolutePath = path.join(tempDir, fileName);
    fs.writeFileSync(absolutePath, buffer);

    const tempImagePath = path.relative(process.cwd(), absolutePath).replace(/\\/g, '/');

    return {
      tempImagePath,
      imageBase64,
    };
  } catch (err) {
    // Un refus volontaire (401...) garde son code au lieu d etre aplati en 500.
    if (err?.statusCode) {
      return sendError(event, err);
    }

    console.error('[generate:face-ref] failure', {
      name: err?.name,
      code: err?.code,
      message: err?.message,
      stack: err?.stack,
    });

    const statusCode = err?.name === 'GeminiNoPartsError' ? 422 : 500;

    return sendError(event, createError({
      statusCode,
      statusMessage: `Erreur generation face ref: ${err?.message || 'erreur inconnue'}`,
      data: {
        name: err?.name,
        code: err?.code,
        message: err?.message,
      },
    }));
  }
});
