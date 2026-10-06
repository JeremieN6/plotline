import {
  getAssetSheetFallbackPrompt,
  getAssetSheetPrompt,
  getRolePromptLabel,
  normalizeAssetType,
} from './referenceAssets.js';

const GEMINI_TIMEOUT_MS = 300000;

/** Parties du message utilisateur : pour chaque photo, un texte qui dit ce qu'elle montre, puis l'image. */
export function buildAssetSheetParts(type, images) {
  const total = images.length;
  const parts = [];

  images.forEach((image, index) => {
    const label = getRolePromptLabel(type, image.role) || 'other view';
    parts.push({ text: `Photo ${index + 1} of ${total}, shows: ${label}.` });
    parts.push({
      inlineData: {
        mimeType: image.mimeType || 'image/jpeg',
        data: Buffer.from(image.buffer).toString('base64'),
      },
    });
  });

  parts.push({ text: 'Generate the reference sheet from these photos.' });
  return parts;
}

function extractInlineData(response) {
  const candidate = response?.candidates?.[0];
  const parts = candidate?.content?.parts ?? [];

  if (!parts.length) {
    const error = new Error(`Gemini returned no parts. finishReason=${candidate?.finishReason || 'unknown'}`);
    error.name = 'GeminiNoPartsError';
    error.finishReason = candidate?.finishReason;
    throw error;
  }

  const imagePart = parts.find((part) => part?.inlineData?.data || part?.inline_data?.data);
  if (!imagePart) {
    const error = new Error('Gemini did not return any image part');
    error.name = 'GeminiNoPartsError';
    throw error;
  }

  return imagePart.inlineData ?? imagePart.inline_data;
}

function isRetryableNoParts(error) {
  if (error?.name !== 'GeminiNoPartsError') return false;
  const reason = String(error.finishReason || '').trim().toUpperCase();
  return !reason || reason.includes('IMAGE_SAFETY') || reason.includes('IMAGE_OTHER') || reason.includes('SAFETY');
}

/**
 * Genere la fiche de reference d'un asset a partir de ses photos sources.
 * `images` : liste ordonnee [{ buffer, mimeType, role }]. Un seul appel Gemini
 * payant ; un seul nouvel essai (prompt de repli) si Gemini ne renvoie aucune image.
 */
export async function generateAssetSheet({ type, images }) {
  const normalizedType = normalizeAssetType(type);
  if (!normalizedType) {
    throw new Error('Type d\'asset invalide');
  }
  if (!Array.isArray(images) || !images.length) {
    throw new Error('Au moins une photo source est requise');
  }

  const apiKey = String(process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey || apiKey === '...') {
    throw new Error('GEMINI_API_KEY non configurée');
  }

  const { GoogleGenAI, Modality } = await import('@google/genai');
  const genai = new GoogleGenAI({ apiKey, httpOptions: { timeout: GEMINI_TIMEOUT_MS } });
  const parts = buildAssetSheetParts(normalizedType, images);

  const run = (systemInstruction) =>
    genai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: [{ role: 'user', parts }],
      config: { systemInstruction, responseModalities: [Modality.TEXT, Modality.IMAGE] },
    });

  let inlineData;
  try {
    inlineData = extractInlineData(await run(getAssetSheetPrompt(normalizedType)));
  } catch (error) {
    if (!isRetryableNoParts(error)) throw error;
    console.warn('[asset-sheet] Gemini returned no image, retrying once with the fallback prompt.', {
      finishReason: error.finishReason || 'unknown',
    });
    inlineData = extractInlineData(await run(getAssetSheetFallbackPrompt()));
  }

  const data = String(inlineData?.data || '').trim();
  if (!data) {
    throw new Error('Image vide retournée par Gemini');
  }

  return { buffer: Buffer.from(data, 'base64') };
}
