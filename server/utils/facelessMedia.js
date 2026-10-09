import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { isAbsoluteHttpUrl, isBlobStorageEnabled, uploadPublicMediaBuffer } from './blobStorage.js';
import { ensureStorageDir, resolveMediaPath, toMediaUrl } from './mediaStorage.js';

/**
 * Medias du format faceless (voix, images d avatar) : Blob en production,
 * disque local en repli (meme principe que les autres medias du projet).
 */

/**
 * Enregistre un buffer. `folder` : "generated" pour une voix, ou
 * "faceless-avatars/<profileId>" pour le pack d avatars.
 * @returns {Promise<string>} URL du media
 */
export async function saveFacelessMedia(buffer, { folder = 'generated', extension = 'png', contentType = 'image/png' } = {}) {
  if (isBlobStorageEnabled()) {
    return (await uploadPublicMediaBuffer(folder, extension, buffer, contentType)).url;
  }
  const segments = folder.split('/').filter(Boolean);
  const dir = ensureStorageDir(...segments);
  const filename = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${extension}`;
  await writeFile(join(dir, filename), buffer);
  return toMediaUrl(...segments, filename);
}

/** Lit un media enregistre par saveFacelessMedia (URL absolue ou chemin /api/media/...). */
export async function readFacelessMedia(mediaUrl) {
  const url = String(mediaUrl || '').trim();
  if (!url) throw new Error('Adresse de media vide');

  if (isAbsoluteHttpUrl(url)) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Media introuvable (${response.status})`);
    return Buffer.from(await response.arrayBuffer());
  }

  const relative = url.replace(/^\/api\/media\//, '').split('/').map(decodeURIComponent).join('/');
  const absolute = resolveMediaPath(relative);
  if (!absolute) throw new Error('Adresse de media invalide');
  return readFile(absolute);
}

/** Pur : id des images d avatar reellement utilisees par un plan. */
export function usedPackIds(plan, packEntries) {
  const used = new Set();
  for (const scene of plan?.scenes || []) {
    for (const beat of scene?.avatar?.beats || []) {
      if (packEntries[beat?.expr]) used.add(beat.expr);
    }
  }
  return [...used];
}

/** Telecharge les images d avatar utilisees : Map "/avatar/<id>.png" -> Buffer (servies a Chromium). */
export async function loadPackAssets(plan, packEntries, read = readFacelessMedia) {
  const assets = new Map();
  for (const id of usedPackIds(plan, packEntries)) {
    assets.set(`/avatar/${id}.png`, await read(packEntries[id].url));
  }
  return assets;
}
