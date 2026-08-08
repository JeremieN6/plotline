import fs from 'node:fs/promises';

import { isAbsoluteHttpUrl, isBlobStorageEnabled } from './blobStorage.js';
import { resolveMediaPath } from './mediaStorage.js';

const MEDIA_URL_PREFIX = '/api/media/';

/**
 * Traduit une URL de media generee en chemin disque local, ou null si l URL ne
 * correspond pas a un fichier servi depuis storage/uploads.
 */
function toLocalMediaPath(mediaUrl) {
  const raw = String(mediaUrl || '').trim();
  if (!raw || !raw.startsWith(MEDIA_URL_PREFIX)) {
    return null;
  }

  const relativePath = raw
    .slice(MEDIA_URL_PREFIX.length)
    .split('/')
    .map((segment) => {
      try {
        return decodeURIComponent(segment);
      } catch {
        return segment;
      }
    })
    .join('/');

  return resolveMediaPath(relativePath);
}

/**
 * Supprime le media reference par une URL, qu il soit sur Vercel Blob ou sur le
 * disque local. Ne leve jamais: un media deja absent n est pas une erreur, et un
 * echec de suppression ne doit pas bloquer l operation metier appelante.
 *
 * @returns {Promise<boolean>} true si un fichier a effectivement ete supprime
 */
export async function deleteMediaByUrl(mediaUrl) {
  const raw = String(mediaUrl || '').trim();
  if (!raw) {
    return false;
  }

  try {
    if (isAbsoluteHttpUrl(raw)) {
      if (!isBlobStorageEnabled()) {
        return false;
      }

      const { del } = await import('@vercel/blob');
      await del(raw);
      return true;
    }

    const localPath = toLocalMediaPath(raw);
    if (!localPath) {
      return false;
    }

    await fs.unlink(localPath);
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return false;
    }

    console.warn('[media-cleanup] suppression impossible', {
      mediaUrl: raw,
      message: error?.message,
    });
    return false;
  }
}

/**
 * Supprime en lot, en ignorant les doublons et les valeurs vides.
 */
export async function deleteMediaUrls(mediaUrls = []) {
  const unique = [...new Set(
    (Array.isArray(mediaUrls) ? mediaUrls : [])
      .map((url) => String(url || '').trim())
      .filter(Boolean),
  )];

  let deleted = 0;
  for (const url of unique) {
    if (await deleteMediaByUrl(url)) {
      deleted += 1;
    }
  }

  return deleted;
}
