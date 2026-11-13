// Import de contenus produits ailleurs (videos et images deja faites) dans « Mes creations ».
// Fonctions pures : le televersement part directement du navigateur vers Vercel Blob (nginx limite les requetes a 25 Mo),
// le serveur ne fait que delivrer le jeton, verifier les adresses recues et creer les contenus.
import { MANUAL_PLATFORM_IDS } from './manualPublication.js';

export const IMPORT_PREFIX = 'imports';
export const IMPORT_MAX_VIDEO_BYTES = 150 * 1024 * 1024;
export const IMPORT_MAX_IMAGE_BYTES = 20 * 1024 * 1024;
export const IMPORT_MAX_FILES_PER_BATCH = 20;
// Le plan gratuit de Vercel Blob inclut 1 Go : au-dela, le stockage est bloque pour tout le projet.
export const BLOB_STORAGE_BUDGET_BYTES = 900 * 1024 * 1024;

export const IMPORT_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];
export const IMPORT_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const IMPORT_ALLOWED_TYPES = [...IMPORT_VIDEO_TYPES, ...IMPORT_IMAGE_TYPES];

export function importKindOf(contentType) {
  const type = String(contentType || '').toLowerCase();
  if (IMPORT_VIDEO_TYPES.includes(type)) return 'video';
  if (IMPORT_IMAGE_TYPES.includes(type)) return 'image';
  return null;
}

export function importMaxBytes(contentType) {
  const kind = importKindOf(contentType);
  if (kind === 'video') return IMPORT_MAX_VIDEO_BYTES;
  if (kind === 'image') return IMPORT_MAX_IMAGE_BYTES;
  return 0;
}

/** Message destine a l utilisateur, ou chaine vide si le fichier est acceptable. */
export function validateImportFile({ contentType, size }) {
  const kind = importKindOf(contentType);
  if (!kind) return 'Format non pris en charge (MP4, MOV, WebM, JPG, PNG ou WebP).';
  const bytes = Number(size);
  if (!Number.isFinite(bytes) || bytes <= 0) return 'Fichier vide.';
  if (bytes > importMaxBytes(contentType)) {
    const mb = Math.round(importMaxBytes(contentType) / 1048576);
    return `Fichier trop lourd (${mb} Mo maximum pour ${kind === 'video' ? 'une vidéo' : 'une image'}).`;
  }
  return '';
}

/** Dossier de televersement d un compte : un utilisateur ne peut importer que sous son propre identifiant. */
export function importPathPrefix(userId) {
  return `${IMPORT_PREFIX}/${String(userId || '').trim()}/`;
}

/** Vrai seulement pour une adresse de fichier public Vercel Blob rangee dans le dossier d import DE CE COMPTE. */
export function isOwnImportUrl(url, userId) {
  if (!String(userId || '').trim()) return false;
  let parsed;
  try {
    parsed = new URL(String(url || ''));
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:') return false;
  if (!parsed.hostname.endsWith('.public.blob.vercel-storage.com')) return false;
  if (parsed.username || parsed.password) return false;
  let path;
  try {
    path = decodeURIComponent(parsed.pathname);
  } catch {
    return false;
  }
  if (path.includes('..')) return false;
  return path.startsWith(`/${importPathPrefix(userId)}`) && path.length > importPathPrefix(userId).length + 1;
}

/** Image ou video : deduit de l extension de l adresse (le type reel a deja ete verifie au televersement). */
export function importKindFromUrl(url) {
  const path = String(url || '').split('?')[0].toLowerCase();
  if (/\.(mp4|mov|webm)$/.test(path)) return 'video';
  if (/\.(jpe?g|png|webp)$/.test(path)) return 'image';
  return null;
}

/** Une video importee est un Reel, une image un post. */
export function formatForKind(kind) {
  return kind === 'video' ? 'REEL' : 'FEED';
}

/** Nom de fichier sur : lettres, chiffres, point, tiret, tiret bas. */
export function safeImportName(name) {
  const base = String(name || 'fichier').split(/[\\/]/).pop();
  const cleaned = base
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(-80);
  return cleaned || 'fichier';
}

/** Reste-t-il de la place ? `used` = octets deja stockes, `incoming` = octets a ajouter. */
export function storageVerdict(used, incoming, budget = BLOB_STORAGE_BUDGET_BYTES) {
  const total = Number(used) + Number(incoming);
  return {
    ok: Number.isFinite(total) && total <= budget,
    usedBytes: Number(used) || 0,
    incomingBytes: Number(incoming) || 0,
    budgetBytes: budget,
    remainingBytes: Math.max(0, budget - (Number(used) || 0)),
  };
}

function cleanPlatforms(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => String(item || '').trim().toUpperCase()))].filter((item) => MANUAL_PLATFORM_IDS.includes(item));
}

/**
 * Normalise une ligne d import recue du navigateur. Renvoie `{ error }` (message pour l utilisateur) ou `{ row }`.
 * La date est facultative ; une date invalide est refusee plutot qu ignoree.
 */
export function normalizeImportRow(raw, userId) {
  const url = String(raw?.url || '').trim();
  if (!isOwnImportUrl(url, userId)) return { error: 'Adresse de fichier non reconnue.' };
  const kind = importKindFromUrl(url);
  if (!kind) return { error: 'Type de fichier non reconnu.' };

  let scheduledAt = null;
  const rawDate = String(raw?.scheduledAt || '').trim();
  if (rawDate) {
    const parsed = new Date(rawDate);
    if (Number.isNaN(parsed.getTime())) return { error: 'Date invalide.' };
    scheduledAt = parsed;
  }

  const caption = String(raw?.caption || '').trim().slice(0, 4000);
  return {
    row: {
      url,
      kind,
      format: formatForKind(kind),
      caption: caption || null,
      scheduledAt,
      platforms: cleanPlatforms(raw?.platforms),
    },
  };
}
