import {
  ASSET_SHEET_COMMON_PROMPT,
  ASSET_SHEET_FALLBACK_PROMPT,
  ASSET_SHEET_TYPE_PROMPTS,
} from '../data/assetSheetPrompts.js';

export const MAX_ASSETS_PER_ACCOUNT = 100;
export const MAX_SOURCE_IMAGES = 8;
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const MAX_SLUG_LENGTH = 40;

export const ASSET_TYPES = [
  { type: 'CAR', label: 'Voiture' },
  { type: 'HOUSE', label: 'Lieu (maison)' },
  { type: 'STREET', label: 'Lieu (rue)' },
  { type: 'JEWEL', label: 'Bijou' },
  { type: 'SHOES', label: 'Chaussures' },
  { type: 'HAT', label: 'Chapeau' },
  { type: 'PROP', label: 'Accessoire' },
];

const OTHER = { role: 'OTHER', label: 'Autre', promptLabel: 'other view' };
const DETAIL = { role: 'DETAIL', label: 'Détail', promptLabel: 'close-up detail' };

// Le premier rôle de chaque liste est le rôle par défaut.
export const ASSET_SOURCE_ROLES = {
  CAR: [
    { role: 'EXTERIOR', label: 'Extérieur', promptLabel: 'exterior' },
    { role: 'INTERIOR', label: 'Intérieur', promptLabel: 'interior' },
    { role: 'TRUNK', label: 'Coffre', promptLabel: 'trunk' },
    DETAIL,
    OTHER,
  ],
  HOUSE: [
    { role: 'EXTERIOR', label: 'Extérieur', promptLabel: 'exterior' },
    { role: 'INTERIOR', label: 'Intérieur', promptLabel: 'interior' },
    { role: 'GARDEN', label: 'Jardin', promptLabel: 'garden' },
    DETAIL,
    OTHER,
  ],
  STREET: [
    { role: 'WIDE', label: 'Vue large', promptLabel: 'wide view' },
    DETAIL,
    OTHER,
  ],
  JEWEL: [
    { role: 'FRONT', label: 'Pièce seule', promptLabel: 'isolated piece' },
    { role: 'WORN', label: 'Porté', promptLabel: 'worn' },
    { role: 'DETAIL', label: 'Détail', promptLabel: 'macro detail' },
    OTHER,
  ],
  SHOES: [
    { role: 'OVERALL', label: 'Vue d\'ensemble', promptLabel: 'overall view' },
    { role: 'SIDE', label: 'Profil', promptLabel: 'side view' },
    { role: 'SOLE', label: 'Semelle', promptLabel: 'sole' },
    DETAIL,
    OTHER,
  ],
  HAT: [
    { role: 'OVERALL', label: 'Vue d\'ensemble', promptLabel: 'overall view' },
    { role: 'SIDE', label: 'Profil', promptLabel: 'side view' },
    { role: 'INSIDE', label: 'Intérieur', promptLabel: 'inside lining' },
    DETAIL,
    OTHER,
  ],
  PROP: [
    { role: 'OVERALL', label: 'Vue d\'ensemble', promptLabel: 'overall view' },
    DETAIL,
    OTHER,
  ],
};

export function normalizeAssetType(value) {
  const normalized = String(value || '').trim().toUpperCase();
  return ASSET_TYPES.some((item) => item.type === normalized) ? normalized : null;
}

/** Rôle valide pour ce type, sinon le rôle par défaut du type ; null si le type est invalide. */
export function normalizeSourceRole(type, role) {
  const roles = ASSET_SOURCE_ROLES[normalizeAssetType(type)];
  if (!roles) return null;
  const normalized = String(role || '').trim().toUpperCase();
  return roles.some((item) => item.role === normalized) ? normalized : roles[0].role;
}

/** Libellé anglais d'un rôle, pour dire à Gemini ce que montre une photo. */
export function getRolePromptLabel(type, role) {
  const roles = ASSET_SOURCE_ROLES[normalizeAssetType(type)];
  if (!roles) return null;
  const normalized = normalizeSourceRole(type, role);
  return roles.find((item) => item.role === normalized)?.promptLabel || null;
}

export function slugifyAssetName(name) {
  const slug = String(name || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/_+$/g, '');
  return slug || null;
}

export function buildAssetCode(type, name) {
  const normalizedType = normalizeAssetType(type);
  const slug = slugifyAssetName(name);
  if (!normalizedType || !slug) return null;
  return `${normalizedType}_${slug}`;
}

export function getAssetSheetPrompt(type) {
  const normalizedType = normalizeAssetType(type);
  if (!normalizedType) return null;
  return `${ASSET_SHEET_COMMON_PROMPT}\n\n${ASSET_SHEET_TYPE_PROMPTS[normalizedType]}`;
}

export function getAssetSheetFallbackPrompt() {
  return ASSET_SHEET_FALLBACK_PROMPT;
}

/** Valide le contenu JSON de `sources` : tableau d'objets { url, role }, entrées sans url écartées. */
export function parseSources(value) {
  let parsed = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed)) return [];

  return parsed
    .filter((entry) => entry && typeof entry === 'object' && typeof entry.url === 'string' && entry.url.trim())
    .map((entry) => ({ url: entry.url.trim(), role: String(entry.role || '').trim().toUpperCase() }));
}
