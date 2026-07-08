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
    throw new Error(`Gemini returned no parts. finishReason=${finishReason || 'unknown'}`);
  }

  const imagePart = parts.find((part) => part?.inlineData?.data || part?.inline_data?.data);
  if (!imagePart) {
    throw new Error('Gemini did not return any image part');
  }

  return imagePart.inlineData ?? imagePart.inline_data;
}

module.exports = defineEventHandler(async (event) => {
  try {
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

    const response = await genai.models.generateContent({
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
    });

    const inlineData = extractInlineDataFromResponse(response);
    const imageBase64 = String(inlineData?.data || '').trim();

    if (!imageBase64) {
      throw new Error('Image vide retournee par Gemini');
    }

    const buffer = Buffer.from(imageBase64, 'base64');

    const tempDir = path.join(process.cwd(), 'storage', 'temp');
    fs.mkdirSync(tempDir, { recursive: true });

    const fileName = `faceref_${Date.now()}.jpg`;
    const absolutePath = path.join(tempDir, fileName);
    fs.writeFileSync(absolutePath, buffer);

    const tempImagePath = path.relative(process.cwd(), absolutePath).replace(/\\/g, '/');

    return {
      tempImagePath,
      imageBase64,
    };
  } catch (err) {
    console.error('[generate:face-ref] failure', {
      name: err?.name,
      code: err?.code,
      message: err?.message,
      stack: err?.stack,
    });

    return sendError(event, createError({
      statusCode: 500,
      statusMessage: `Erreur generation face ref: ${err?.message || 'erreur inconnue'}`,
      data: {
        name: err?.name,
        code: err?.code,
        message: err?.message,
      },
    }));
  }
});
