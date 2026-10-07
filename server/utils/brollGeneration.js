import Anthropic from '@anthropic-ai/sdk';

import { addBrollToVideo } from './brollOverlay.js';
import { generateImageFromGeminiWithSafetyFallback } from './geminiImageGeneration.js';

// Chaque image est une generation Gemini payante (quelques dizaines de centimes) :
// le plafond est volontairement bas.
export const MAX_BROLL_IMAGES = 3;

const DEFAULT_MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 1024;
const MIN_PROMPT_LENGTH = 20;
const MAX_PROMPT_LENGTH = 500;

/** Pur : nombre de plans de coupe demande, entier entre 0 et MAX_BROLL_IMAGES (0 si invalide). */
export function normalizeBrollCount(value) {
  const parsed = Number.parseInt(String(value ?? '').trim(), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 0;
  return Math.min(parsed, MAX_BROLL_IMAGES);
}

export function buildBrollPlanSystemPrompt(count) {
  return [
    'Tu prepares des plans de coupe (B-roll) pour une courte video verticale ou une personne parle a la camera.',
    `Tu dois proposer exactement ${count} image(s), chacune illustrant un moment DIFFERENT du texte parle, dans l ordre du texte.`,
    '',
    'Pour chaque image, ecris un prompt de generation d image EN ANGLAIS :',
    '- un objet, un lieu, un geste ou une scene concrete que le texte evoque (jamais une idee abstraite) ;',
    '- photo realiste vue au telephone ou documentaire, format vertical 9:16, lumiere naturelle ;',
    '- aucun visage reconnaissable (des mains, un objet, un decor ou une silhouette de dos conviennent) ;',
    '- aucun texte lisible, aucun logo, aucune marque, aucun filigrane ;',
    '- 25 a 60 mots, un seul sujet clair.',
    '',
    'Reponds uniquement avec un objet JSON brut, sans markdown ni commentaire.',
    `Forme exacte : {"shots":[${Array.from({ length: count }, () => '{"moment": string, "prompt": string}').join(', ')}]}`,
  ].join('\n');
}

export function buildBrollPlanUserPrompt(scriptText) {
  return `Texte parle :\n${String(scriptText || '').trim()}`;
}

/** Pur : extrait les prompts valides de la reponse de Claude (au plus `count`), [] si rien d exploitable. */
export function parseBrollPlan(rawText, count) {
  const text = String(rawText || '').trim();
  if (!text || !(count > 0)) return [];

  const withoutFence = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const start = withoutFence.indexOf('{');
  const end = withoutFence.lastIndexOf('}');
  const candidate = start !== -1 && end > start ? withoutFence.slice(start, end + 1) : withoutFence;

  let parsed;
  try {
    parsed = JSON.parse(candidate);
  } catch {
    return [];
  }

  if (!Array.isArray(parsed?.shots)) return [];

  return parsed.shots
    .map((shot) => String(shot?.prompt || '').trim())
    .filter((prompt) => prompt.length >= MIN_PROMPT_LENGTH && prompt.length <= MAX_PROMPT_LENGTH)
    .slice(0, count);
}

/** Demande a Claude une image B-roll par moment du texte. `createMessage` est injectable (tests). */
export async function planBrollPrompts({ scriptText, count, apiKey, createMessage } = {}) {
  const key = String(apiKey || process.env.ANTHROPIC_API_KEY || '').trim();
  if (!createMessage && !key) {
    throw new Error('ANTHROPIC_API_KEY non configuree');
  }

  const request = {
    model: String(process.env.ANTHROPIC_MODEL || DEFAULT_MODEL).trim() || DEFAULT_MODEL,
    max_tokens: MAX_TOKENS,
    system: buildBrollPlanSystemPrompt(count),
    messages: [{ role: 'user', content: buildBrollPlanUserPrompt(scriptText) }],
  };
  const response = await (createMessage ? createMessage(request) : new Anthropic({ apiKey: key }).messages.create(request));

  const text = (response?.content || [])
    .filter((block) => block?.type === 'text')
    .map((block) => block.text)
    .join('\n');

  return parseBrollPlan(text, count);
}

/** Genere les images une a une ; une image qui echoue est ignoree (les autres sont gardees). */
export async function generateBrollImages(prompts, generate = generateImageFromGeminiWithSafetyFallback) {
  const images = [];

  for (const prompt of prompts) {
    try {
      const inlineData = await generate(`${prompt} Vertical 9:16 photo, no text, no logos.`);
      const data = String(inlineData?.data || '').trim();
      if (data) images.push({ buffer: Buffer.from(data, 'base64'), mimeType: inlineData?.mimeType || 'image/jpeg' });
    } catch (error) {
      console.warn(`[broll] image ignoree : ${error?.message || error}`);
    }
  }

  return images;
}

/**
 * Etape finale d une video qui parle : plan -> images -> pose par ffmpeg.
 * Ne leve jamais : au moindre probleme, la video d origine est renvoyee.
 * `deps` permet d injecter les maillons (tests).
 */
export async function applyBrollToBuffer(videoBuffer, { count, scriptText } = {}, deps = {}) {
  const wanted = normalizeBrollCount(count);
  if (!wanted || !String(scriptText || '').trim()) return videoBuffer;

  const plan = deps.planBrollPrompts || planBrollPrompts;
  const makeImages = deps.generateBrollImages || generateBrollImages;
  const overlay = deps.addBrollToVideo || addBrollToVideo;

  try {
    const prompts = await plan({ scriptText, count: wanted });
    if (!prompts.length) {
      console.warn('[broll] aucun plan exploitable renvoye par Claude, video conservee telle quelle.');
      return videoBuffer;
    }

    const images = await makeImages(prompts);
    if (!images.length) return videoBuffer;

    const result = await overlay(videoBuffer, images);
    return result.applied > 0 ? result.buffer : videoBuffer;
  } catch (error) {
    console.warn(`[broll] etape ignoree, video conservee telle quelle : ${error?.message || error}`);
    return videoBuffer;
  }
}
