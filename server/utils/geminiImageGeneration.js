import { GoogleGenAI, Modality } from '@google/genai';

// Ces classes ne sont pas exportees volontairement: Nitro auto-importe tout ce qui est
// exporte depuis server/utils/, et l'auto-import injecte alors un import en haut de ce
// fichier meme, qui entre en collision avec la declaration locale ("already declared").
// Elles ne servent qu'ici, donc on les garde internes.
class ImageSafetyError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ImageSafetyError';
  }
}

class GeminiNoPartsError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'GeminiNoPartsError';
    this.finishReason = String(options.finishReason || '');
  }
}

const SAFETY_REPLACEMENTS = [
  ['Extremely large, very full breasts causing cleavage', 'Full, prominent bust'],
  ['significantly enlarged breasts', 'full bust'],
  ['very full breasts', 'full bust'],
  ['visible cleavage', 'natural neckline'],
  ['Voluptuous hourglass figure with significantly enlarged breasts', 'Hourglass figure with full bust'],
  ['NON-NEGOTIABLE', 'important'],
  ['stretching the top garment', 'filling the top garment'],
  ['stretching the attire', 'filling the attire'],
  ['filling the bikini top', 'complementing the attire'],
  ['cleavage and stretching', 'fitting naturally'],
  ['prominent glutes', 'balanced lower silhouette'],
  ['rounded glutes', 'balanced lower silhouette'],
  ['Pronounced hourglass', 'balanced silhouette'],
  ['full bust', 'natural upper silhouette'],
  ['Hourglass figure with full bust', 'balanced silhouette'],
  ['extreme waist-to-hip ratio', 'balanced proportions'],
  ['wide hips and rounded glutes', 'defined hips'],
];

function sanitizePromptForSafety(prompt) {
  let sanitized = String(prompt || '');

  for (const [from, to] of SAFETY_REPLACEMENTS) {
    sanitized = sanitized.split(from).join(to);
  }

  sanitized = sanitized
    .replace(/significantly enlarged breasts[^.\n]*/gi, 'full bust')
    .replace(/extremely large[^.\n]*breasts[^.\n]*/gi, 'full bust')
    .replace(/causing cleavage[^.\n]*/gi, 'filling the garment')
    .replace(/stretching the (?!top garment)[\w][\w\s]+(?=[.,"\n])/gi, 'filling the attire')
    .replace(/(?:fill|filling) the [\w][\w\s]+(?=[.,"\n])/gi, 'complementing the attire')
    .replace(/voluptuous hourglass figure[^.\n]*/gi, 'balanced silhouette')
    .replace(/full and rounded high-set glutes[^.\n]*/gi, 'rounded hips')
    .replace(/\b(?:glutes?|butt|breasts?|cleavage|busty|buxom)\b/gi, 'silhouette')
    .replace(/\b(?:voluptuous|hourglass|curvy)\b/gi, 'balanced')
    .replace(/\b(?:extremely|very|significantly|prominent|huge|enlarged)\b/gi, 'natural');

  return sanitized;
}

function isRetryableNoPartsFinishReason(finishReason) {
  const normalized = String(finishReason || '').trim().toUpperCase();
  return normalized.includes('IMAGE_OTHER');
}

function isTransientGeminiError(error) {
  const message = String(error?.message || '').toUpperCase();
  return (
    message.includes('500 INTERNAL')
    || message.includes('INTERNAL ERROR ENCOUNTERED')
    || message.includes('503 UNAVAILABLE')
    || message.includes('RESOURCE_EXHAUSTED')
    || message.includes('OVERLOADED')
    || message.includes('TRY AGAIN LATER')
    || message.includes('HIGH DEMAND')
    || message.includes('DEADLINE_EXCEEDED')
  );
}

async function retryWithSanitizedPrompt(prompt, extraParts, error, reasonLabel) {
  const sanitizedPrompt = sanitizePromptForSafety(prompt);
  if (sanitizedPrompt === prompt) {
    throw error;
  }

  console.warn(`[gemini-image] ${reasonLabel}, retrying with sanitized prompt.`);
  return await generateImageFromGemini(sanitizedPrompt, extraParts);
}

function extractInlineDataFromResponse(imageResponse) {
  const candidate = imageResponse?.candidates?.[0];
  const parts = candidate?.content?.parts ?? [];

  if (parts.length === 0) {
    const finishReason = candidate?.finishReason;
    const safetyRatings = JSON.stringify(candidate?.safetyRatings ?? []);

    if (String(finishReason || '').toUpperCase().includes('IMAGE_SAFETY')) {
      throw new ImageSafetyError(
        `Gemini blocked generation for IMAGE_SAFETY. finishReason=${finishReason} safetyRatings=${safetyRatings}`,
      );
    }

    throw new GeminiNoPartsError(
      `Gemini returned no parts. finishReason=${finishReason} safetyRatings=${safetyRatings} rawKeys=${Object.keys(imageResponse ?? {}).join(',')}`,
      { finishReason },
    );
  }

  const imagePart = parts.find(
    (part) => part?.inlineData?.data || part?.inline_data?.data,
  );

  if (!imagePart) {
    const partsSummary = parts
      .map((part, index) => `[${index}] keys=${Object.keys(part ?? {}).join(',')} text=${part?.text ? part.text.slice(0, 80) : ''}`)
      .join(' | ');
    throw new Error(`Gemini did not return an image part. Parts: ${partsSummary}`);
  }

  return imagePart.inlineData ?? imagePart.inline_data;
}

async function generateImageFromGemini(prompt, extraParts = []) {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey || geminiKey.trim() === '...' || geminiKey.trim() === '') {
    throw new Error('GEMINI_API_KEY non configuree dans .env');
  }

  const genai = new GoogleGenAI({ apiKey: geminiKey });
  const imageResponse = await genai.models.generateContent({
    model: 'gemini-3-pro-image-preview',
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }, ...extraParts],
      },
    ],
    config: {
      responseModalities: [Modality.TEXT, Modality.IMAGE],
    },
  });

  return extractInlineDataFromResponse(imageResponse);
}

export async function generateImageFromGeminiWithSafetyFallback(prompt, extraParts = []) {
  try {
    return await generateImageFromGemini(prompt, extraParts);
  } catch (error) {
    if (error instanceof ImageSafetyError) {
      return await retryWithSanitizedPrompt(prompt, extraParts, error, 'IMAGE_SAFETY detected');
    }

    if (isTransientGeminiError(error)) {
      console.warn('[gemini-image] transient Gemini error detected, retrying image generation once.');
      return await generateImageFromGemini(prompt, extraParts);
    }

    if (!(error instanceof GeminiNoPartsError) || !isRetryableNoPartsFinishReason(error.finishReason)) {
      throw error;
    }

    console.warn(`[gemini-image] ${error.finishReason || 'IMAGE_NO_PARTS'} detected, retrying image generation once.`);

    try {
      return await generateImageFromGemini(prompt, extraParts);
    } catch (retryError) {
      if (retryError instanceof ImageSafetyError) {
        return await retryWithSanitizedPrompt(prompt, extraParts, retryError, 'IMAGE_SAFETY detected after no-parts retry');
      }

      if (retryError instanceof GeminiNoPartsError && isRetryableNoPartsFinishReason(retryError.finishReason)) {
        return await retryWithSanitizedPrompt(prompt, extraParts, retryError, `${retryError.finishReason || 'IMAGE_NO_PARTS'} persisted`);
      }

      throw retryError;
    }
  }
}
