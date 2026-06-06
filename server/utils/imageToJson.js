import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { GoogleGenAI } from '@google/genai';

import { PROMPT_IMAGE_TO_JSON } from './promptTemplates.js';

function cleanMarkdownJson(rawText) {
  return String(rawText || '')
    .replace(/^\s*```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
}

function getMimeType(imagePath) {
  const ext = path.extname(imagePath).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  return 'image/jpeg';
}

export async function imageToJson(imagePath) {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey || geminiKey.trim() === '...' || geminiKey.trim() === '') {
    throw new Error('GEMINI_API_KEY non configuree dans .env');
  }

  const absolutePath = path.resolve(String(imagePath || ''));
  const imageBuffer = await readFile(absolutePath);
  const imageBase64 = imageBuffer.toString('base64');

  const genai = new GoogleGenAI({ apiKey: geminiKey });
  const response = await genai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      {
        role: 'user',
        parts: [
          { text: PROMPT_IMAGE_TO_JSON },
          {
            inlineData: {
              mimeType: getMimeType(absolutePath),
              data: imageBase64,
            },
          },
        ],
      },
    ],
  });

  const text = response?.text;
  const cleaned = cleanMarkdownJson(text);

  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error('Gemini returned invalid JSON for imageToJson');
  }
}