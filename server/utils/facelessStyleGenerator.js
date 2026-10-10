import Anthropic from '@anthropic-ai/sdk';

import {
  FACELESS_ACCESSORIES,
  FACELESS_BACKGROUNDS,
  FACELESS_CAPTION_STYLES,
  FACELESS_CARD_STYLES,
  FACELESS_DENSITIES,
  FACELESS_ENTERS,
  FACELESS_FONTS,
  FACELESS_HAIR_STYLES,
  FACELESS_MOTIONS,
  FACELESS_PRESETS,
} from '../data/facelessThemes.js';
import { describeFacelessPersona } from './facelessPlanGenerator.js';
import { defaultVoiceFor, normalizeFacelessStyle } from './facelessStyle.js';

/**
 * "Generer ma DA" : Claude traduit une description libre ("brutaliste, orange
 * et noir, sobre, sans sous-titres...") en champs de DA. Il peut aussi modifier
 * une DA existante ("mets le fond en rose"). Le resultat passe par
 * `normalizeFacelessStyle` : jamais une valeur que le moteur ne sait pas rendre.
 */

const DEFAULT_MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 1800;

const list = (obj) => Object.keys(obj).join(' | ');

export function buildFacelessStyleSystemPrompt({ persona = null } = {}) {
  // La DA est purement visuelle : la voix de la personnalite n y a pas sa place.
  const personaText = describeFacelessPersona(persona, { withPersonality: false });
  return [
    'Tu es directeur artistique de videos verticales "faceless" (TikTok, Reels) pour Plotline.',
    'A partir de la description de l utilisateur, tu remplis les champs de la direction artistique (DA) d une persona.',
    'Un moteur de rendu fixe lit ces champs : n invente aucune valeur hors des listes.',
    '',
    'Champs :',
    '- "name" : nom court de la DA (3 mots max).',
    `- "preset" : base de depart, ${list(FACELESS_PRESETS)}.`,
    '- "palette" : couleurs HEXADECIMALES #rrggbb : background (fond principal), backgroundAlt (fond secondaire), dark (fond sombre), text, accent (mots cles, doit contraster avec les fonds), accent2, card (cartes), cardText (texte des cartes, lisible sur card). Verifie la lisibilite : texte sombre sur fonds clairs.',
    `- "font" : ${list(FACELESS_FONTS)}.`,
    `- "card" : ${list(FACELESS_CARD_STYLES)}.`,
    `- "background" : ${list(FACELESS_BACKGROUNDS)}.`,
    '- "decor" : "shapes" (petites formes decoratives) | "none".',
    `- "motion" : ${list(FACELESS_MOTIONS)}.`,
    `- "enters" : transitions autorisees (au moins 2), parmi ${FACELESS_ENTERS.join(' | ')}.`,
    `- "captions" : { "enabled": boolean, "position": "top" | "bottom", "style": ${list(FACELESS_CAPTION_STYLES)} }.`,
    `- "density" : ${list(FACELESS_DENSITIES)}.`,
    '- "rules" : 3 a 6 regles de montage en francais, une par ligne, commencant par "- " (rythme, nombre d elements, usage des emojis, des mots cles, des transitions...).',
    '- "avatarPrompt" : description en francais du style graphique de l avatar illustre (proportions, aplats, contour...), 1 phrase.',
    `- "avatar" : { "svg": { "hair": ${list(FACELESS_HAIR_STYLES)}, "hairColor": "#rrggbb", "skin": "#rrggbb", "accessory": ${list(FACELESS_ACCESSORIES)}, "top": "#rrggbb" } } pour l avatar dessine par defaut (coherent avec la persona).`,
    personaText ? `\nPersona concernee (la DA doit lui correspondre) :\n${personaText}` : '',
    '',
    'Si une DA actuelle est fournie, applique SEULEMENT les changements demandes et recopie le reste a l identique.',
    'Reponds uniquement avec un objet JSON brut, sans markdown ni commentaire.',
  ].filter((line) => line !== '').join('\n');
}

export function buildFacelessStyleUserPrompt(description, current) {
  const lines = [`Description de la DA souhaitee :\n${String(description || '').trim()}`];
  if (current) {
    const { avatar, ...rest } = current;
    lines.push('', 'DA actuelle (a modifier) :', JSON.stringify({ ...rest, avatar: { svg: avatar?.svg } }));
  }
  return lines.join('\n');
}

/** Pur : extrait l objet JSON de la reponse. */
export function parseFacelessStyleResponse(rawText) {
  const text = String(rawText || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('Reponse de Claude sans JSON');
  return JSON.parse(text.slice(start, end + 1));
}

/**
 * Genere (ou modifie) une DA. Renvoie une DA normalisee, SANS pack d avatars.
 * `createMessage` est injectable (tests).
 */
export async function generateFacelessStyle({ description, current = null, persona = null, apiKey, createMessage } = {}) {
  if (!String(description || '').trim()) throw new Error('Description de DA vide');
  const key = String(apiKey || process.env.ANTHROPIC_API_KEY || '').trim();
  if (!createMessage && !key) throw new Error('ANTHROPIC_API_KEY non configuree');

  const request = {
    model: String(process.env.ANTHROPIC_MODEL || DEFAULT_MODEL).trim() || DEFAULT_MODEL,
    max_tokens: MAX_TOKENS,
    system: buildFacelessStyleSystemPrompt({ persona }),
    messages: [{ role: 'user', content: buildFacelessStyleUserPrompt(description, current) }],
  };
  const response = await (createMessage ? createMessage(request) : new Anthropic({ apiKey: key }).messages.create(request));
  const text = (response?.content || []).filter((b) => b?.type === 'text').map((b) => b.text).join('\n');

  const raw = parseFacelessStyleResponse(text);
  // Ce que Claude ne remplit pas reste tel que la DA actuelle (ou le preset choisi).
  const merged = current ? { ...current, ...raw, palette: { ...current.palette, ...(raw.palette || {}) } } : raw;
  const style = normalizeFacelessStyle(merged);
  // La voix n est pas decidee par Claude : celle de la DA actuelle, sinon celle qui va au genre de la persona.
  style.voiceId = current?.voiceId || defaultVoiceFor(persona?.gender === 'MALE' ? 'MALE' : 'FEMALE');
  return style;
}
