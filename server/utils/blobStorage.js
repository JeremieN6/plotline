// Point d entree UNIQUE du stockage partage des medias : disque du serveur (MEDIA_STORAGE=disk) ou Vercel Blob.
// Le nom du fichier est historique ; `isBlobStorageEnabled` veut dire « passer par le stockage partage ».
import { put } from '@vercel/blob';

import { isDiskStorageEnabled, writeDiskMedia } from './diskStorage.js';

export const DEV_WRITE_BLOCKED_MESSAGE = 'Enregistrement de médias désactivé en local : la base est partagée avec le site en ligne. '
  + 'Utilise le site en ligne, ou MEDIA_ALLOW_DEV_WRITES=true pour un test que tu supprimeras.';

function randomSuffix() {
  return Math.random().toString(36).slice(2, 10);
}

/**
 * Pur : en serveur de developpement, un fichier ecrit sur le PC finirait dans la base partagee sous une adresse que
 * le site en ligne ne peut pas lire. `dev` vaut `import.meta.dev` (indefini dans les tests et en production).
 */
export function isDevWriteBlocked(env = process.env, dev = Boolean(import.meta.dev)) {
  return dev && String(env.MEDIA_ALLOW_DEV_WRITES || '').trim().toLowerCase() !== 'true';
}

export function isBlobStorageEnabled() {
  // En developpement bloque, on repond oui : aucun appelant ne retombe sur son repli disque local.
  if (isDiskStorageEnabled() || isDevWriteBlocked()) return true;
  const token = String(process.env.BLOB_READ_WRITE_TOKEN || '').trim();
  return Boolean(token);
}

export function isAbsoluteHttpUrl(value) {
  return /^https?:\/\//i.test(String(value || '').trim());
}

export async function uploadPublicMediaBuffer(prefix, extension, buffer, contentType) {
  if (isDevWriteBlocked()) {
    throw new Error(DEV_WRITE_BLOCKED_MESSAGE);
  }
  if (!isBlobStorageEnabled()) {
    throw new Error('BLOB_READ_WRITE_TOKEN is missing');
  }

  const safePrefix = String(prefix || 'media').replace(/[^a-zA-Z0-9/_-]/g, '-');
  const safeExt = String(extension || 'jpg').replace(/[^a-zA-Z0-9]/g, '') || 'jpg';
  const pathname = `${safePrefix}/${Date.now()}-${randomSuffix()}.${safeExt}`;

  if (isDiskStorageEnabled()) {
    return writeDiskMedia(pathname, buffer);
  }

  const result = await put(pathname, buffer, {
    access: 'public',
    addRandomSuffix: false,
    contentType: contentType || 'image/jpeg',
  });

  return {
    pathname: result.pathname,
    url: result.url,
  };
}
