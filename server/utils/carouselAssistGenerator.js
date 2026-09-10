/**
 * Transforme une idee libre en une serie de prompts de slides pour un
 * carrousel image, Claude decidant lui-meme du nombre de slides pertinent
 * (borne, memes valeurs que CAROUSEL_MIN_PROMPTS/CAROUSEL_MAX_PROMPTS cote
 * client dans app/pages/studio/index.vue). Meme pattern que
 * scenarioScriptGenerator.js : pas de repli deterministe, un echec Claude
 * remonte une erreur claire.
 */

import Anthropic from '@anthropic-ai/sdk';

const DEFAULT_MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 1536;

export const CAROUSEL_ASSIST_MIN = 2;
export const CAROUSEL_ASSIST_MAX = 10;

function getAnthropicModel() {
  return String(process.env.ANTHROPIC_MODEL || DEFAULT_MODEL).trim() || DEFAULT_MODEL;
}

export function buildCarouselAssistSystemPrompt({ personaDescription, min, max } = {}) {
  const lo = Number.isFinite(min) ? min : CAROUSEL_ASSIST_MIN;
  const hi = Number.isFinite(max) ? max : CAROUSEL_ASSIST_MAX;

  const lines = [
    "Tu decoupes une idee ou un besoin en une serie de slides d'un carrousel",
    'image pour Plotline.',
    '',
    'Contraintes :',
    `- Choisis toi-meme le nombre de slides, entre ${lo} et ${hi}, selon la`,
    '  richesse de l idee : une idee simple donne peu de slides, une idee',
    '  riche en etapes/points en donne plus.',
    '- Chaque slide est un prompt de generation image en anglais, concret et',
    '  visuel : sujet, cadrage, decor, lumiere.',
    '- Les slides doivent former une sequence coherente (meme personnage,',
    '  meme univers visuel d une slide a l autre si pertinent).',
    '- Pas de texte a incruster dans les images, pas de watermark.',
  ];

  if (personaDescription) {
    lines.push('', `Persona concerne, doit rester reconnaissable : ${personaDescription}.`);
  }

  lines.push(
    '',
    'Reponds uniquement avec un tableau JSON brut, sans markdown ni commentaire.',
    'Forme exacte : [string, string, ...]',
  );

  return lines.join('\n');
}

export function buildCarouselAssistUserPrompt(idea) {
  return `Idee / besoin :\n${String(idea || '').trim()}`;
}

export function parseCarouselAssistResult(rawText, { min, max } = {}) {
  const lo = Number.isFinite(min) ? min : CAROUSEL_ASSIST_MIN;
  const hi = Number.isFinite(max) ? max : CAROUSEL_ASSIST_MAX;
  const text = String(rawText || '').trim();
  if (!text) return null;

  const withoutFence = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  const start = withoutFence.indexOf('[');
  const end = withoutFence.lastIndexOf(']');
  const candidate = start !== -1 && end > start ? withoutFence.slice(start, end + 1) : withoutFence;

  let parsed;
  try {
    parsed = JSON.parse(candidate);
  } catch {
    return null;
  }

  if (!Array.isArray(parsed)) return null;

  const slides = parsed
    .map((item) => String(item || '').trim())
    .filter(Boolean);

  if (slides.length < lo) return null;

  return slides.length > hi ? slides.slice(0, hi) : slides;
}

export async function generateCarouselSlides({ idea, personaDescription, apiKey, min, max }) {
  const key = String(apiKey || process.env.ANTHROPIC_API_KEY || '').trim();
  const trimmedIdea = String(idea || '').trim();

  if (!key) {
    throw new Error('ANTHROPIC_API_KEY non configuree');
  }
  if (!trimmedIdea) {
    throw new Error('idee requise');
  }

  const anthropic = new Anthropic({ apiKey: key });
  const response = await anthropic.messages.create({
    model: getAnthropicModel(),
    max_tokens: MAX_TOKENS,
    system: buildCarouselAssistSystemPrompt({ personaDescription, min, max }),
    messages: [{ role: 'user', content: buildCarouselAssistUserPrompt(trimmedIdea) }],
  });

  const text = (response?.content || [])
    .filter((block) => block?.type === 'text')
    .map((block) => block.text)
    .join('\n');

  const result = parseCarouselAssistResult(text, { min, max });
  if (!result) {
    throw new Error('Claude n a pas renvoye de slides exploitables');
  }

  return result;
}
