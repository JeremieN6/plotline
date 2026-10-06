import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createError } from 'h3';

import { isBlobStorageEnabled, isAbsoluteHttpUrl, uploadPublicMediaBuffer } from './blobStorage.js';
import { readImageSourceBuffer } from './faceRefReader.js';
import { deleteMediaByUrl } from './mediaCleanup.js';
import { MAX_UPLOAD_BYTES, parseSources } from './referenceAssets.js';

const LOCAL_URL_PREFIX = '/uploads/reference-assets/';
const LOCAL_DIR = path.join(process.cwd(), 'public', 'uploads', 'reference-assets');

/** Le type declare par le client ne prouve rien : on lit la signature du fichier. */
export function detectImageType(buffer) {
  if (buffer.length > 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { mime: 'image/png', extension: 'png' };
  }
  if (buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mime: 'image/jpeg', extension: 'jpg' };
  }
  return null;
}

/** Extrait et valide la photo d'un envoi multipart (JPG/PNG par signature, 10 Mo max). */
export function readImagePart(formData) {
  const filePart = formData?.find((part) => part.name === 'file');
  if (!filePart?.data?.length) {
    throw createError({ statusCode: 400, statusMessage: 'Fichier requis' });
  }

  const buffer = Buffer.from(filePart.data);
  if (buffer.length > MAX_UPLOAD_BYTES) {
    throw createError({ statusCode: 413, statusMessage: 'Fichier trop lourd (10 Mo maximum)' });
  }

  const detected = detectImageType(buffer);
  if (!detected) {
    throw createError({ statusCode: 400, statusMessage: 'Seuls les fichiers JPG/PNG sont acceptés' });
  }

  return { buffer, ...detected };
}

export function readTextField(formData, name) {
  const part = formData?.find((item) => item.name === name);
  return part?.data ? part.data.toString('utf8').trim() : '';
}

/**
 * Stocke une image (photo source ou fiche) : Blob si actif, repli disque local
 * sinon. Le nom de fichier est toujours genere cote serveur.
 */
export async function storeAssetImage(userId, buffer, { extension, mime }, { sheet = false } = {}) {
  if (isBlobStorageEnabled()) {
    const prefix = sheet ? `reference-assets/${userId}/sheets` : `reference-assets/${userId}`;
    const uploaded = await uploadPublicMediaBuffer(prefix, extension, buffer, mime);
    return uploaded.url;
  }

  const dir = sheet ? path.join(LOCAL_DIR, 'sheets') : LOCAL_DIR;
  await fs.mkdir(dir, { recursive: true });
  const filename = `${crypto.randomBytes(12).toString('hex')}.${extension}`;
  await fs.writeFile(path.join(dir, filename), buffer);
  return `${LOCAL_URL_PREFIX}${sheet ? 'sheets/' : ''}${filename}`;
}

/** Supprime un fichier de la bibliotheque (Blob ou disque local). Ne leve jamais. */
export async function deleteAssetFile(url) {
  const raw = String(url || '').trim();
  if (!raw) return false;

  if (isAbsoluteHttpUrl(raw)) {
    return deleteMediaByUrl(raw);
  }

  if (!raw.startsWith(LOCAL_URL_PREFIX)) return false;

  const rest = raw.slice(LOCAL_URL_PREFIX.length);
  const segments = rest.split('/');
  const isSheet = segments.length === 2 && segments[0] === 'sheets';
  const filename = isSheet ? segments[1] : rest;

  // Nom de fichier seul : jamais de segment de chemin.
  if (!/^[a-zA-Z0-9._-]+$/.test(filename) || filename.includes('..')) return false;

  try {
    await fs.unlink(path.join(isSheet ? path.join(LOCAL_DIR, 'sheets') : LOCAL_DIR, filename));
    return true;
  } catch {
    return false;
  }
}

/** Relit les photos d'un asset, dans l'ordre, UNIQUEMENT depuis les URLs enregistrees en base. */
export async function loadAssetImages(sources) {
  const list = parseSources(sources);
  const images = [];
  for (const source of list) {
    const { buffer, mimeType } = await readImageSourceBuffer(source.url);
    images.push({ buffer, mimeType, role: source.role });
  }
  return images;
}

export function serializeAsset(row) {
  return {
    id: row.id,
    type: row.type,
    code: row.code,
    name: row.name,
    description: row.description || '',
    sources: parseSources(row.sources),
    sheetUrl: row.sheetUrl || null,
    sheetOutdated: Boolean(row.sheetOutdated),
    createdAt: row.createdAt,
  };
}

export async function getPrisma() {
  const module = await import('./prisma.js');
  const client = module?.prisma || module?.default?.prisma;
  if (!client) {
    throw new Error('Unable to resolve prisma client from server/utils/prisma.js');
  }
  return client;
}

export function toErrorResponse(err, fallbackMessage) {
  if (err?.statusCode) return err;
  console.error('[reference-assets] failure', { name: err?.name, code: err?.code, message: err?.message });
  return createError({
    statusCode: 500,
    statusMessage: fallbackMessage,
    data: { code: err?.code, message: err?.message },
  });
}
