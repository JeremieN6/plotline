import { buildPersonalityBrief } from './personalityBrief.js';
import { normalizePersonality } from './personality.js';

/**
 * Personnalite -> planificateur editorial (pur).
 *
 * Trois apports, tous derives de la personnalite DEJA enregistree :
 *  - le bloc de voix + ligne editoriale (meme brief que la video faceless) ;
 *  - une rotation des piliers de contenu : chaque creneau recoit un pilier, la
 *    rotation continue d un plan a l autre (aucune idee ne depend du hasard de
 *    Claude pour varier les themes) ;
 *  - l univers visuel (palette, decors, lieux) pour les scenes d image.
 * Aucun pilier n est filtre ni juge : tout ce que la persona declare est traite.
 * Sans personnalite, tout renvoie vide et le planificateur reste identique.
 */

const MAX_PILLAR_CHARS = 180;
const MAX_UNIVERSE_CHARS = 420;

function oneLine(value, max) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

function listValue(normalized, block, key, itemMax, limit) {
  const value = normalized.blocks?.[block]?.[key]?.value;
  return Array.isArray(value) ? value.map((item) => oneLine(item, itemMax)).filter(Boolean).slice(0, limit) : [];
}

function textValue(normalized, block, key, max) {
  const value = normalized.blocks?.[block]?.[key]?.value;
  return typeof value === 'string' ? oneLine(value, max) : '';
}

/** Piliers de contenu declares (liste vide si aucun). */
export function getContentPillars(personality) {
  if (!personality) return [];
  return listValue(normalizePersonality(personality), 'editorial', 'contentPillars', MAX_PILLAR_CHARS, 8);
}

/**
 * Pilier d un creneau : rotation reguliere sur la liste, reprise la ou le plan
 * precedent s est arrete (`offset` = nombre de creneaux deja planifies).
 */
export function pillarForSlot(pillars, position, offset = 0) {
  if (!Array.isArray(pillars) || !pillars.length) return '';
  const index = (Math.max(0, Number(position) - 1) + Math.max(0, Number(offset) || 0)) % pillars.length;
  return pillars[index];
}

/**
 * Mots-cles de recherche Pinterest choisis pour les STORY de la persona (liste vide si aucun).
 * Saisis a la main apres essai, jamais generes : s ils existent, ils remplacent la banque par categorie.
 */
export function getStoryKeywords(personality) {
  if (!personality) return [];
  return listValue(normalizePersonality(personality), 'editorial', 'storyKeywords', 40, 8);
}

/** Univers visuel de la persona (palette, decors recurrents, lieux) ; '' si rien. */
export function buildVisualUniverse(personality) {
  if (!personality) return '';
  const normalized = normalizePersonality(personality);
  const parts = [];

  const palette = textValue(normalized, 'appearance', 'palette', 120);
  if (palette) parts.push(`palette : ${palette}`);
  const sets = listValue(normalized, 'appearance', 'recurringSets', 90, 4);
  if (sets.length) parts.push(`décors récurrents : ${sets.join(' ; ')}`);
  const places = listValue(normalized, 'lore', 'places', 90, 3);
  if (places.length) parts.push(`lieux : ${places.join(' ; ')}`);

  const text = parts.join(' | ');
  return text.length > MAX_UNIVERSE_CHARS ? `${text.slice(0, MAX_UNIVERSE_CHARS - 1).trimEnd()}…` : text;
}

/** Formes de publication preferees (texte libre de la persona) ; '' si rien. */
export function buildPreferredForms(personality) {
  if (!personality) return '';
  const forms = listValue(normalizePersonality(personality), 'editorial', 'preferredFormats', 90, 5);
  return forms.join(' ; ');
}

/**
 * Bloc injecte dans le prompt systeme du planificateur. '' si la personnalite
 * est absente ou ne contient rien d utile.
 */
export function buildPlannerPersonalityBlock(personality) {
  const brief = buildPersonalityBrief(personality);
  const universe = buildVisualUniverse(personality);
  const forms = buildPreferredForms(personality);
  if (!brief && !universe && !forms) return '';

  const lines = [];
  if (brief) lines.push(brief);
  if (universe) lines.push(`Univers visuel (pour les scènes d'image) : ${universe}`);
  if (forms) {
    lines.push(
      `Formes de publication appréciées (à adapter au format du créneau, sans jamais proposer un format absent de la liste des créneaux, comme un carrousel ou un thread) : ${forms}`,
    );
  }
  return lines.join('\n');
}
