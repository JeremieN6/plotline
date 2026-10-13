/**
 * Detection automatique de ce que montre chaque photo source d'un asset
 * (exterieur, interieur, coffre...). Un seul appel Claude (vision) pour toutes
 * les photos, quelques centimes ; ne depend pas du solde Gemini.
 */

import Anthropic from '@anthropic-ai/sdk';

import { ASSET_SOURCE_ROLES, normalizeAssetType } from './referenceAssets.js';

const DEFAULT_MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 512;
const MAX_SIDE_PX = 768;

function getAnthropicModel() {
  return String(process.env.ANTHROPIC_MODEL || DEFAULT_MODEL).trim() || DEFAULT_MODEL;
}

export function buildRoleClassifierPrompt(type) {
  const roles = ASSET_SOURCE_ROLES[normalizeAssetType(type)];
  if (!roles) return null;

  const list = roles.map((item) => `- ${item.role} : ${item.promptLabel}`).join('\n');
  return [
    'Tu classes des photos d\'un meme objet ou lieu selon ce qu\'elles montrent.',
    'Pour chaque photo, choisis UN SEUL role parmi cette liste (utilise l\'identifiant exact) :',
    list,
    '',
    'Regles :',
    '- Juge uniquement ce qui est visible sur la photo, pas ce qui est probable.',
    '- Choisis le role le plus precis (ex. sieges avant plutot qu\'interieur general) ; un role general seulement si la photo en montre plusieurs parties.',
    '- Choisis OTHER seulement si aucun autre role ne convient, et ne l\'utilise jamais par defaut.',
    '- Un gros plan sur un element precis (volant, jante, logo, ecran...) est DETAIL si ce role existe.',
    '',
    'Reponds uniquement avec un objet JSON brut, sans markdown ni commentaire.',
    'Forme exacte : {"roles": [identifiant, ...]} avec exactement une entree par photo, dans l\'ordre des photos.',
  ].join('\n');
}

/** Extrait la liste de roles du texte de Claude ; null si inexploitable. Un role inconnu devient OTHER (ou le defaut du type). */
export function parseRoleClassification(rawText, type, expectedCount) {
  const roles = ASSET_SOURCE_ROLES[normalizeAssetType(type)];
  if (!roles) return null;

  const text = String(rawText || '').trim();
  if (!text) return null;

  const withoutFence = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const start = withoutFence.indexOf('{');
  const end = withoutFence.lastIndexOf('}');
  const candidate = start !== -1 && end > start ? withoutFence.slice(start, end + 1) : withoutFence;

  let parsed;
  try {
    parsed = JSON.parse(candidate);
  } catch {
    return null;
  }

  if (!Array.isArray(parsed?.roles) || parsed.roles.length !== expectedCount) return null;

  const fallback = roles.find((item) => item.role === 'OTHER')?.role || roles[0].role;
  return parsed.roles.map((value) => {
    const normalized = String(value || '').trim().toUpperCase();
    return roles.some((item) => item.role === normalized) ? normalized : fallback;
  });
}

async function shrinkForVision(buffer) {
  const sharp = (await import('sharp')).default;
  return sharp(buffer)
    .rotate()
    .resize({ width: MAX_SIDE_PX, height: MAX_SIDE_PX, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toBuffer();
}

/** `images` : [{ buffer }]. Renvoie un role par photo, dans l'ordre. */
export async function classifyAssetPhotos({ type, images, apiKey }) {
  const prompt = buildRoleClassifierPrompt(type);
  if (!prompt) throw new Error('Type d\'asset invalide');
  if (!Array.isArray(images) || !images.length) throw new Error('Au moins une photo est requise');

  const key = String(apiKey || process.env.ANTHROPIC_API_KEY || '').trim();
  if (!key) throw new Error('ANTHROPIC_API_KEY non configuree');

  const content = [];
  for (let index = 0; index < images.length; index += 1) {
    const small = await shrinkForVision(images[index].buffer);
    content.push({ type: 'text', text: `Photo ${index + 1} sur ${images.length} :` });
    content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: small.toString('base64') } });
  }
  content.push({ type: 'text', text: 'Classe ces photos.' });

  const anthropic = new Anthropic({ apiKey: key });
  const response = await anthropic.messages.create({
    model: getAnthropicModel(),
    max_tokens: MAX_TOKENS,
    system: prompt,
    messages: [{ role: 'user', content }],
  });

  const text = (response?.content || [])
    .filter((block) => block?.type === 'text')
    .map((block) => block.text)
    .join('\n');

  const roles = parseRoleClassification(text, type, images.length);
  if (!roles) throw new Error('Claude n a pas renvoye de classement exploitable');
  return roles;
}
