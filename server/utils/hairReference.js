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

function buildHairPrompt(parsed) {
  const color = String(parsed?.hair_color || '').trim();
  if (color) {
    return `Hair color from reference: ${color}`;
  }

  const explicitPrompt = String(parsed?.hair_prompt || '').trim();
  if (explicitPrompt) {
    return explicitPrompt;
  }

  const fragments = [
    parsed?.hair_length,
    parsed?.hair_cut,
    parsed?.hair_color,
    parsed?.hair_texture,
    parsed?.hair_part,
    parsed?.hair_bangs,
  ]
    .map((value) => String(value || '').trim())
    .filter(Boolean);

  if (fragments.length === 0) {
    return null;
  }

  return fragments.join(', ');
}

export async function describeHairFromImageSource(imageSource, resolveLocalPath) {
  const { buffer, mimeType } = await readImageSourceBuffer(imageSource, resolveLocalPath);

  const prompt = `Analyze this CHARACTER REFERENCE image and extract only hair guidance for image generation.
Return JSON only:
{
  "hair_prompt": "single concise sentence (optional)",
  "hair_length": "",
  "hair_cut": "",
  "hair_color": "",
  "hair_texture": "",
  "hair_part": "",
  "hair_bangs": ""
}

Rules:
- Focus only on visible hair attributes: length, cut, color, texture, part, fringe/bangs.
- Prioritize hair_color extraction accuracy over every other attribute.
- Be agnostic to gender and hair length; describe exactly what is visible.
- Do NOT describe face, skin, age, body or clothing.
- Keep the result concise and production-ready for an image prompt.`;

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
    return buildHairPrompt(parsed);
  } catch {
    return null;
  }
}
