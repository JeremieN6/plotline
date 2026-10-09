/**
 * Fonctions PURES de la personnalite d un profil : normalisation, fusion, tirage
 * des graines. Aucun acces reseau ni base ; le registre vit dans
 * server/data/personalityBlocks.js et les graines dans personalitySeeds.js.
 *
 * Forme stockee (colonne JSON `personality`) :
 *   { version, kind, eccentricity, seeds, blocks: { <bloc>: { <champ>: { value, origin, locked? } } }, updatedAt }
 * `origin` : 'user' (jamais ecrase par une generation) ou 'generated'.
 * `locked` : verrou explicite sur un champ genere que l on veut figer.
 */

import { PERSONALITY_BLOCKS } from '../data/personalityBlocks.js';
import { PERSONALITY_CONTEXT_SEEDS, PERSONALITY_SEEDS } from '../data/personalitySeeds.js';

export const PERSONALITY_VERSION = 1;
export const PERSONALITY_MAX_BYTES = 32 * 1024;
export const DEFAULT_ECCENTRICITY = 3;

const ORIGINS = new Set(['user', 'generated']);
const MAX_SEED_KEYS = 40;

export const PLATFORM_BIO_FIELDS = {
  instagram: 'bioInstagram',
  tiktok: 'bioTiktok',
  x: 'bioX',
};

// --- Registre ---------------------------------------------------------------

export function normalizeKind(value) {
  const key = String(value || '').trim().toUpperCase();
  return PERSONALITY_BLOCKS[key] ? key : null;
}

export function getKindBlocks(kind) {
  return PERSONALITY_BLOCKS[normalizeKind(kind) || 'PERSONA'];
}

export function getFieldDefinition(kind, blockKey, fieldKey) {
  const block = getKindBlocks(kind).find((item) => item.key === blockKey);
  return block?.fields.find((field) => field.key === fieldKey) || null;
}

export function fieldId(blockKey, fieldKey) {
  return `${blockKey}.${fieldKey}`;
}

export function normalizeEccentricity(value) {
  const number = Math.round(Number(value));
  if (!Number.isFinite(number)) return DEFAULT_ECCENTRICITY;
  return Math.min(5, Math.max(1, number));
}

// --- Valeurs ----------------------------------------------------------------

/** Tronque proprement : a la limite, en reculant jusqu a un espace si c est raisonnable. */
export function truncateClean(text, max) {
  const value = String(text ?? '').trim();
  if (!Number.isFinite(max) || max <= 0 || value.length <= max) return value;

  const cut = value.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  const base = lastSpace >= Math.floor(max * 0.6) ? cut.slice(0, lastSpace) : cut;
  return base.replace(/[\s,;:\-–—]+$/u, '').trim();
}

function toList(rawValue) {
  if (Array.isArray(rawValue)) return rawValue;
  if (typeof rawValue === 'string') return rawValue.split(/\r?\n/);
  return [];
}

/** Renvoie la valeur nettoyee du champ, ou null si elle est vide ou inexploitable. */
export function normalizeFieldValue(field, rawValue) {
  if (!field) return null;

  if (field.type === 'number') {
    if (rawValue === '' || rawValue === null || rawValue === undefined) return null;
    const number = Math.round(Number(rawValue));
    if (!Number.isFinite(number)) return null;
    const min = Number.isFinite(field.min) ? field.min : -Infinity;
    const max = Number.isFinite(field.max) ? field.max : Infinity;
    return Math.min(max, Math.max(min, number));
  }

  if (field.type === 'list') {
    const seen = new Set();
    const items = [];
    for (const entry of toList(rawValue)) {
      if (typeof entry !== 'string' && typeof entry !== 'number') continue;
      const item = truncateClean(String(entry).replace(/\s+/g, ' '), field.itemMax || 120);
      const key = item.toLowerCase();
      if (!item || seen.has(key)) continue;
      seen.add(key);
      items.push(item);
      if (items.length >= (field.max || 8)) break;
    }
    return items.length ? items : null;
  }

  if (typeof rawValue !== 'string' && typeof rawValue !== 'number') return null;
  const text = field.type === 'longtext'
    ? String(rawValue).replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n')
    : String(rawValue).replace(/\s+/g, ' ');
  const value = truncateClean(text, field.max || 200);
  return value || null;
}

function parseJsonSafe(raw) {
  if (typeof raw !== 'string') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeSeeds(rawSeeds) {
  if (!isPlainObject(rawSeeds)) return {};
  const seeds = {};
  for (const [key, value] of Object.entries(rawSeeds).slice(0, MAX_SEED_KEYS)) {
    const cleanKey = String(key).slice(0, 40);
    if (typeof value === 'number' && Number.isFinite(value)) seeds[cleanKey] = value;
    else if (typeof value === 'string' && value.trim()) seeds[cleanKey] = value.trim().slice(0, 200);
  }
  return seeds;
}

function isValidIso(value) {
  return typeof value === 'string' && value.length < 40 && !Number.isNaN(Date.parse(value));
}

/**
 * Valide et nettoie une personnalite quelconque (objet, texte JSON, rien) :
 * ignore les cles inconnues, tronque aux limites du registre, force les types.
 * Ne leve jamais d exception.
 */
export function normalizePersonality(raw, kind) {
  const parsed = parseJsonSafe(raw);
  const source = isPlainObject(parsed) ? parsed : {};
  const resolvedKind = normalizeKind(kind) || normalizeKind(source.kind) || 'PERSONA';
  const blocks = {};

  for (const block of getKindBlocks(resolvedKind)) {
    const rawBlock = isPlainObject(source.blocks) ? source.blocks[block.key] : null;
    if (!isPlainObject(rawBlock)) continue;

    const cleanBlock = {};
    for (const field of block.fields) {
      const rawField = rawBlock[field.key];
      if (rawField === undefined || rawField === null) continue;

      const wrapped = isPlainObject(rawField) && 'value' in rawField;
      const value = normalizeFieldValue(field, wrapped ? rawField.value : rawField);
      if (value === null) continue;

      const entry = {
        value,
        origin: wrapped && ORIGINS.has(rawField.origin) ? rawField.origin : 'generated',
      };
      if (wrapped && rawField.locked === true) entry.locked = true;
      cleanBlock[field.key] = entry;
    }

    if (Object.keys(cleanBlock).length) blocks[block.key] = cleanBlock;
  }

  return {
    version: PERSONALITY_VERSION,
    kind: resolvedKind,
    eccentricity: normalizeEccentricity(source.eccentricity),
    seeds: normalizeSeeds(source.seeds),
    blocks,
    updatedAt: isValidIso(source.updatedAt) ? source.updatedAt : new Date().toISOString(),
  };
}

// --- Champs fournis par l admin ---------------------------------------------

/**
 * `provided` = { <bloc>: { <champ>: valeur } } (valeurs nues saisies dans le
 * formulaire). Renvoie la meme forme en blocs normalises, origin 'user'.
 */
export function normalizeProvided(provided, kind) {
  const resolvedKind = normalizeKind(kind) || 'PERSONA';
  const source = isPlainObject(provided) ? provided : {};
  const blocks = {};

  for (const block of getKindBlocks(resolvedKind)) {
    const rawBlock = source[block.key];
    if (!isPlainObject(rawBlock)) continue;

    const cleanBlock = {};
    for (const field of block.fields) {
      const raw = isPlainObject(rawBlock[field.key]) && 'value' in rawBlock[field.key]
        ? rawBlock[field.key].value
        : rawBlock[field.key];
      const value = normalizeFieldValue(field, raw);
      if (value !== null) cleanBlock[field.key] = { value, origin: 'user' };
    }
    if (Object.keys(cleanBlock).length) blocks[block.key] = cleanBlock;
  }

  return blocks;
}

/**
 * Valeurs des champs relies a une colonne du profil (lecture seule, origin
 * 'user') : la colonne fait foi, la personnalite ne l ecrit jamais.
 */
export function buildProvidedFromProfile(profile, kind) {
  const provided = {};
  if (!profile) return provided;

  for (const block of getKindBlocks(kind)) {
    for (const field of block.fields) {
      if (!field.column) continue;
      const raw = profile[field.column];
      if (raw === null || raw === undefined || String(raw).trim() === '') continue;

      let value = raw;
      if (field.column === 'niche') {
        const parts = String(raw).split(',').map((item) => item.trim()).filter(Boolean);
        value = field.columnPart === 'rest' ? parts.slice(1) : parts[0];
        if (!value || (Array.isArray(value) && !value.length)) continue;
      }

      provided[block.key] = { ...(provided[block.key] || {}), [field.key]: value };
    }
  }

  return normalizeProvided(provided, kind);
}

const GENDER_LABELS = { FEMALE: 'femme', MALE: 'homme' };

function clipText(value, max) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

/**
 * Faits du profil existant que la personnalite ne doit pas contredire (genre,
 * physique deja fige par la fiche de reference visage). Renvoie des phrases
 * imposees a Claude ; rien n est copie dans la personnalite stockee.
 * Un profil neuf ou sans ces colonnes renvoie une liste vide.
 */
export function buildProfileConstraints(profile) {
  if (!profile) return [];
  const lines = [];

  const gender = GENDER_LABELS[String(profile.gender || '').toUpperCase()];
  if (gender) {
    lines.push(`Genre du personnage : ${gender} (prénom, pronoms et accords cohérents avec ce genre)`);
  }
  if (clipText(profile.ethnicity, 120)) lines.push(`Origine / apparence déjà définie : ${clipText(profile.ethnicity, 120)}`);
  if (clipText(profile.eyeColor, 60)) lines.push(`Couleur des yeux déjà définie : ${clipText(profile.eyeColor, 60)}`);
  if (clipText(profile.hairPrompt, 240)) lines.push(`Cheveux déjà définis : ${clipText(profile.hairPrompt, 240)}`);
  // Volontairement ignores : `bodyPrompt` (prompt d image technique, pas un
  // texte de personnalite) et `silhouette` (valeur par defaut de la plupart des
  // profils, pas un choix) ; les transmettre pousserait des descriptions
  // corporelles dans la voix et la biographie.
  if (String(profile.faceRefPath || '').trim()) {
    lines.push('Une fiche de référence visage existe déjà : l apparence est figée, la section apparence doit rester compatible avec les éléments ci-dessus sans inventer de traits qui les contredisent');
  }

  return lines;
}

// --- Fusion -----------------------------------------------------------------

export function isProtectedField(entry) {
  return Boolean(entry) && (entry.origin === 'user' || entry.locked === true);
}

/**
 * Fusionne une generation dans une personnalite existante :
 *  - un champ 'user' ou verrouille de `existing` n est JAMAIS ecrase par `generated` ;
 *  - un champ 'generated' non verrouille est remplace par la nouvelle valeur ;
 *  - un champ absent de `generated` est conserve ;
 *  - `provided` (saisie courante de l admin) l emporte sur tout, en origin 'user'.
 */
export function mergePersonality(existing, generated, provided, kind) {
  const resolvedKind = normalizeKind(kind)
    || normalizeKind(existing?.kind)
    || normalizeKind(generated?.kind)
    || 'PERSONA';

  const base = normalizePersonality(existing, resolvedKind);
  const incoming = normalizePersonality(generated, resolvedKind);
  const typed = normalizeProvided(provided, resolvedKind);
  const blocks = JSON.parse(JSON.stringify(base.blocks));

  for (const [blockKey, fields] of Object.entries(incoming.blocks)) {
    for (const [fieldKey, entry] of Object.entries(fields)) {
      if (isProtectedField(blocks[blockKey]?.[fieldKey])) continue;
      blocks[blockKey] = { ...(blocks[blockKey] || {}), [fieldKey]: { value: entry.value, origin: 'generated' } };
    }
  }

  for (const [blockKey, fields] of Object.entries(typed)) {
    for (const [fieldKey, entry] of Object.entries(fields)) {
      const locked = blocks[blockKey]?.[fieldKey]?.locked === true;
      blocks[blockKey] = { ...(blocks[blockKey] || {}), [fieldKey]: { value: entry.value, origin: 'user', ...(locked ? { locked: true } : {}) } };
    }
  }

  const generatedHasEccentricity = isPlainObject(generated) && generated.eccentricity !== undefined;

  return {
    version: PERSONALITY_VERSION,
    kind: resolvedKind,
    eccentricity: generatedHasEccentricity ? incoming.eccentricity : base.eccentricity,
    seeds: { ...base.seeds, ...incoming.seeds },
    blocks,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Retire les champs relies a une colonne du profil avant d ecrire en base : la
 * colonne fait foi, en garder une copie dans le JSON creerait deux sources de
 * verite qui divergent des qu on modifie le profil. Renvoie une nouvelle
 * personnalite normalisee (l argument n est pas modifie).
 */
export function stripColumnFields(personality, kind) {
  const clean = normalizePersonality(personality, kind);
  for (const block of getKindBlocks(clean.kind)) {
    for (const field of block.fields) {
      if (field.column && clean.blocks[block.key]) delete clean.blocks[block.key][field.key];
    }
    if (clean.blocks[block.key] && !Object.keys(clean.blocks[block.key]).length) delete clean.blocks[block.key];
  }
  return clean;
}

/** Champs proteges (user ou verrouilles) d une personnalite : ensemble de "bloc.champ". */
export function collectProtectedFields(personality) {
  const result = new Set();
  for (const [blockKey, fields] of Object.entries(personality?.blocks || {})) {
    for (const [fieldKey, entry] of Object.entries(fields)) {
      if (isProtectedField(entry)) result.add(fieldId(blockKey, fieldKey));
    }
  }
  return result;
}

// --- Graines ----------------------------------------------------------------

// Poids des niveaux de decalage (1 credible, 2 inattendu, 3 decale) selon l excentricite.
export const ECCENTRICITY_LEVEL_WEIGHTS = {
  1: [1, 0, 0],
  2: [0.7, 0.3, 0],
  3: [0.3, 0.5, 0.2],
  4: [0.1, 0.4, 0.5],
  5: [0, 0.2, 0.8],
};

/** Generateur pseudo-aleatoire deterministe (mulberry32), pour les tests. */
export function createSeededRng(seed) {
  let state = Number(seed) >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function drawFromList(list, eccentricity, rng = Math.random) {
  if (!Array.isArray(list) || !list.length) return null;

  const weights = ECCENTRICITY_LEVEL_WEIGHTS[normalizeEccentricity(eccentricity)];
  const levels = [1, 2, 3]
    .map((level, index) => ({ level, weight: weights[index], items: list.filter((item) => item.level === level) }))
    .filter((entry) => entry.weight > 0 && entry.items.length);
  if (!levels.length) return null;

  const total = levels.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = rng() * total;
  let chosen = levels[levels.length - 1];
  for (const entry of levels) {
    if (roll < entry.weight) {
      chosen = entry;
      break;
    }
    roll -= entry.weight;
  }

  return chosen.items[Math.min(chosen.items.length - 1, Math.floor(rng() * chosen.items.length))].value;
}

/**
 * Tire les graines AVANT l appel a Claude. Aucune graine pour un champ protege
 * (saisi par l admin ou verrouille). `only` restreint a certains blocs.
 * @returns {Record<string, string|number>} cle = cle du champ (ou categorie de contexte)
 */
export function drawSeeds(kind, eccentricity, rng = Math.random, { protectedFields = new Set(), only = null } = {}) {
  const resolvedKind = normalizeKind(kind) || 'PERSONA';
  const seeds = {};

  for (const block of getKindBlocks(resolvedKind)) {
    if (Array.isArray(only) && !only.includes(block.key)) continue;
    for (const field of block.fields) {
      if (!field.seedable || protectedFields.has(fieldId(block.key, field.key))) continue;
      const value = drawFromList(PERSONALITY_SEEDS[field.seedCategory], eccentricity, rng);
      if (value !== null) seeds[field.key] = value;
    }
  }

  if (!Array.isArray(only) || only.includes('backstory')) {
    for (const category of PERSONALITY_CONTEXT_SEEDS[resolvedKind] || []) {
      const value = drawFromList(PERSONALITY_SEEDS[category], eccentricity, rng);
      if (value !== null) seeds[category] = value;
    }
  }

  return seeds;
}

// --- Acces ------------------------------------------------------------------

/** Statut HTTP de refus pour un utilisateur de session (null = autorise). */
export function getAdminGuardStatus(user) {
  if (!user) return 401;
  if (!user.isAdmin) return 403;
  return null;
}
