import path from 'node:path';

import { GoogleGenAI } from '@google/genai';

function normalizeContentTypeFromHeader(value) {
  return String(value || '').split(';')[0].trim().toLowerCase();
}

function mimeFromExt(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  return 'image/jpeg';
}

function cleanJson(rawText) {
  return String(rawText || '')
    .replace(/^\s*```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
}

function getGemini() {
  const key = process.env.GEMINI_API_KEY;
  if (!key || key.trim() === '' || key.trim() === '...') {
    throw new Error('GEMINI_API_KEY non configuree dans .env');
  }

  return new GoogleGenAI({ apiKey: key });
}

async function readImageSourceBuffer(imageSource, resolveLocalPath) {
  const source = String(imageSource || '').trim();
  if (!source) {
    throw new Error('Image source is missing');
  }

  if (/^https?:\/\//i.test(source)) {
    const response = await fetch(source);
    if (!response.ok) {
      throw new Error(`Unable to download image source: ${source}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return {
      buffer: Buffer.from(arrayBuffer),
      mimeType: normalizeContentTypeFromHeader(response.headers.get('content-type')) || 'image/jpeg',
    };
  }

  const absolutePath = await resolveLocalPath(source);
  const { readFile } = await import('node:fs/promises');
  const buffer = await readFile(absolutePath);

  return {
    buffer,
    mimeType: mimeFromExt(absolutePath),
  };
}

export async function describeBodyFromImageSource(imageSource, resolveLocalPath) {
  const { buffer, mimeType } = await readImageSourceBuffer(imageSource, resolveLocalPath);

  const prompt = `Analyze this BODY REFERENCE image and extract only body/clothing-fit guidance for image generation.
Return JSON only:
{
  "body_prompt": "single concise sentence"
}

Rules:
- Focus on silhouette, proportions, posture, garment fit and visible body line only.
- Do NOT describe facial identity (face, eye color, hair specifics, age, ethnicity).
- Keep it concise and production-ready for an image prompt.`;

  const genai = getGemini();
  const response = await genai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      {
        role: 'user',
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType,
              data: buffer.toString('base64'),
            },
          },
        ],
      },
    ],
  });

  const jsonText = cleanJson(response?.text || '');
  try {
    const parsed = JSON.parse(jsonText);
    const bodyPrompt = String(parsed?.body_prompt || '').trim();
    return bodyPrompt || null;
  } catch {
    return null;
  }
}
