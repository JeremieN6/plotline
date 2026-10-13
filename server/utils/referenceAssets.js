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

// Le premier rôle de chaque liste est le rôle par défaut. Les identifiants sont
// stockés en base : n'en retirer aucun (un rôle inconnu retombe sur le défaut).
// Les libellés anglais alimentent le prompt de la fiche ; ceux des vues
// intérieures contiennent le mot "interior" (le bloc intérieur n'est construit
// que si une photo en porte la mention, voir assetSheetPrompts.js).
export const ASSET_SOURCE_ROLES = {
  CAR: [
    { role: 'EXTERIOR', label: 'Extérieur (général)', promptLabel: 'exterior' },
    { role: 'FRONT', label: 'Avant', promptLabel: 'exterior, front view' },
    { role: 'REAR', label: 'Arrière', promptLabel: 'exterior, rear view' },
    { role: 'SIDE', label: 'Profil', promptLabel: 'exterior, side profile' },
    { role: 'WHEEL', label: 'Jante / roue', promptLabel: 'exterior, close-up of a wheel' },
    { role: 'INTERIOR', label: 'Intérieur (général)', promptLabel: 'interior' },
    { role: 'DASHBOARD', label: 'Tableau de bord', promptLabel: 'interior, dashboard and steering wheel' },
    { role: 'FRONT_SEATS', label: 'Sièges avant', promptLabel: 'interior, front seats' },
    { role: 'REAR_SEATS', label: 'Sièges arrière', promptLabel: 'interior, rear seats' },
    { role: 'TRUNK', label: 'Coffre', promptLabel: 'trunk' },
    DETAIL,
    OTHER,
  ],
  HOUSE: [
    { role: 'EXTERIOR', label: 'Extérieur (général)', promptLabel: 'exterior' },
    { role: 'FACADE', label: 'Façade', promptLabel: 'exterior, main facade' },
    { role: 'REAR_SIDE', label: 'Arrière / côté', promptLabel: 'exterior, rear or side of the building' },
    { role: 'GARDEN', label: 'Jardin', promptLabel: 'garden' },
    { role: 'INTERIOR', label: 'Intérieur (général)', promptLabel: 'interior' },
    { role: 'LIVING', label: 'Salon / séjour', promptLabel: 'interior, living room' },
    { role: 'KITCHEN', label: 'Cuisine', promptLabel: 'interior, kitchen' },
    { role: 'BEDROOM', label: 'Chambre', promptLabel: 'interior, bedroom' },
    { role: 'BATHROOM', label: 'Salle de bain', promptLabel: 'interior, bathroom' },
    DETAIL,
    OTHER,
  ],
  STREET: [
    { role: 'WIDE', label: 'Vue large', promptLabel: 'wide view' },
    { role: 'ANGLE', label: 'Autre angle', promptLabel: 'another angle along the street' },
    { role: 'GROUND', label: 'Sol / revêtement', promptLabel: 'close-up of the ground surface' },
    { role: 'FACADES', label: 'Façades', promptLabel: 'building facades' },
    DETAIL,
    OTHER,
  ],
  JEWEL: [
    { role: 'FRONT', label: 'Pièce seule', promptLabel: 'isolated piece' },
    { role: 'SIDE', label: 'Profil', promptLabel: 'isolated piece, side view' },
    { role: 'WORN', label: 'Porté', promptLabel: 'worn' },
    { role: 'INSIDE', label: "Intérieur de l'anneau", promptLabel: 'inside of the band' },
    { role: 'DETAIL', label: 'Détail', promptLabel: 'macro detail' },
    OTHER,
  ],
  SHOES: [
    { role: 'OVERALL', label: "Vue d'ensemble", promptLabel: 'overall view' },
    { role: 'THREE_QUARTER', label: 'Trois-quarts', promptLabel: 'three-quarter view' },
    { role: 'SIDE', label: 'Profil', promptLabel: 'side view' },
    { role: 'TOP', label: 'Dessus', promptLabel: 'top view' },
    { role: 'SOLE', label: 'Semelle', promptLabel: 'sole' },
    { role: 'HEEL', label: 'Talon', promptLabel: 'heel and back view' },
    DETAIL,
    OTHER,
  ],
  HAT: [
    { role: 'OVERALL', label: "Vue d'ensemble", promptLabel: 'overall view' },
    { role: 'FRONT', label: 'Face', promptLabel: 'front view' },
    { role: 'SIDE', label: 'Profil', promptLabel: 'side view' },
    { role: 'BACK', label: 'Arrière', promptLabel: 'back view' },
    { role: 'TOP', label: 'Dessus', promptLabel: 'top view' },
    { role: 'INSIDE', label: 'Intérieur', promptLabel: 'inside lining' },
    DETAIL,
    OTHER,
  ],
  PROP: [
    { role: 'OVERALL', label: "Vue d'ensemble", promptLabel: 'overall view' },
    { role: 'FRONT', label: 'Face', promptLabel: 'front view' },
    { role: 'SIDE', label: 'Profil', promptLabel: 'side view' },
    { role: 'BACK', label: 'Arrière', promptLabel: 'back view' },
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
