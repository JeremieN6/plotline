import { GoogleGenAI } from '@google/genai';

import {
  PROMPT_BODY_PROPORTIONS_DETECTION,
  PROMPT_FACE_VISIBILITY_DETECTION,
  PROMPT_PERSON_DETECTION,
  PROMPT_UPPER_BODY_DETECTION,
} from './promptTemplates.js';

function getGemini() {
  const key = process.env.GEMINI_API_KEY;
  if (!key || key.trim() === '' || key.trim() === '...') {
    throw new Error('GEMINI_API_KEY non configuree dans .env');
  }

  return new GoogleGenAI({ apiKey: key });
}

function cleanJson(rawText) {
  return String(rawText || '')
    .replace(/^\s*```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
}

function cleanText(rawText) {
  return String(rawText || '').trim().toUpperCase();
}

async function askYesNoQuestion(imageBuffer, mimeType, prompt) {
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
              data: imageBuffer.toString('base64'),
            },
          },
        ],
      },
    ],
  });

  const answer = cleanText(response?.text || '');
  return answer.startsWith('YES');
}

export function extractMimeTypeFromPath(filePath = '') {
  const normalized = String(filePath || '').trim().toLowerCase();
  if (normalized.endsWith('.png')) return 'image/png';
  if (normalized.endsWith('.webp')) return 'image/webp';
  if (normalized.endsWith('.gif')) return 'image/gif';
  return 'image/jpeg';
}

export async function detectPersonInImage(imageBuffer, mimeType = 'image/jpeg') {
  return askYesNoQuestion(imageBuffer, mimeType, PROMPT_PERSON_DETECTION);
}

export async function detectUpperBodyVisible(imageBuffer, mimeType = 'image/jpeg') {
  return askYesNoQuestion(imageBuffer, mimeType, PROMPT_UPPER_BODY_DETECTION);
}

export async function detectFaceVisible(imageBuffer, mimeType = 'image/jpeg') {
  return askYesNoQuestion(imageBuffer, mimeType, PROMPT_FACE_VISIBILITY_DETECTION);
}

export async function validateBodyProportions(imageBuffer, mimeType = 'image/jpeg') {
  return askYesNoQuestion(imageBuffer, mimeType, PROMPT_BODY_PROPORTIONS_DETECTION);
}

export async function validatePersonAndUpperBody(imageBuffer, mimeType = 'image/jpeg') {
  const prompt = `You are a strict visual QA checker.
Return JSON only:
{
  "person_count": 0,
  "upper_body_visible": false,
  "pass": false,
  "reason": ""
}

Rules:
- person_count: visible real people count in foreground.
- upper_body_visible: true only if the main subject's torso/chest area is clearly visible.
- pass must be true only when person_count is exactly 1 AND upper_body_visible is true.
- reason: concise explanation.`;

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
              data: imageBuffer.toString('base64'),
            },
          },
        ],
      },
    ],
  });

  const raw = cleanJson(response?.text || '');
  try {
    const parsed = JSON.parse(raw);
    const personCount = Number(parsed?.person_count || 0);
    const upperBodyVisible = Boolean(parsed?.upper_body_visible);
    const pass = Boolean(parsed?.pass) && personCount === 1 && upperBodyVisible;

    return {
      personCount,
      upperBodyVisible,
      pass,
      reason: String(parsed?.reason || '').trim(),
    };
  } catch {
    return {
      personCount: 0,
      upperBodyVisible: false,
      pass: false,
      reason: 'Validation JSON parse failed',
    };
  }
}
