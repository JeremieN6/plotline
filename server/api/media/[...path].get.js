import fs from 'node:fs/promises';
import path from 'node:path';

import { getStorageRoot, resolveMediaPath } from '../../utils/mediaStorage.js';

function getContentType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === '.png') {
    return 'image/png';
  }
  if (extension === '.webp') {
    return 'image/webp';
  }
  if (extension === '.gif') {
    return 'image/gif';
  }
  if (extension === '.mp4') {
    return 'video/mp4';
  }
  return 'image/jpeg';
}

function resolvePublicUploadPath(relativePath) {
  const normalized = String(relativePath || '')
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (!normalized.length) {
    return null;
  }

  const absolutePath = path.join(process.cwd(), 'public', 'uploads', ...normalized);
  const allowedRoot = path.join(process.cwd(), 'public', 'uploads');
  const relativeFromRoot = path.relative(allowedRoot, absolutePath);

  if (!relativeFromRoot || relativeFromRoot.startsWith('..') || path.isAbsolute(relativeFromRoot)) {
    return null;
  }

  return absolutePath;
}

export default defineEventHandler(async (event) => {
  const rawPath = event.context?.params?.path;
  const pathSegments = Array.isArray(rawPath) ? rawPath : [rawPath].filter(Boolean);
  const relativePath = pathSegments.join('/');
  const storageAbsolutePath = resolveMediaPath(relativePath);
  const publicAbsolutePath = resolvePublicUploadPath(relativePath);

  if (!storageAbsolutePath && !publicAbsolutePath) {
    throw createError({ statusCode: 400, statusMessage: 'Chemin media invalide' });
  }

  const candidates = [];

  if (storageAbsolutePath) {
    const allowedStorageRoot = getStorageRoot();
    const storageRelative = path.relative(allowedStorageRoot, storageAbsolutePath);
    if (storageRelative && !storageRelative.startsWith('..') && !path.isAbsolute(storageRelative)) {
      candidates.push(storageAbsolutePath);
    }
  }

  if (publicAbsolutePath) {
    candidates.push(publicAbsolutePath);
  }

  if (!candidates.length) {
    throw createError({ statusCode: 403, statusMessage: 'Acces refuse' });
  }

  for (const absolutePath of candidates) {
    try {
      const buffer = await fs.readFile(absolutePath);
      setHeader(event, 'Content-Type', getContentType(absolutePath));
      return buffer;
    } catch (error) {
      if (error?.code === 'ENOENT') {
        continue;
      }

      throw createError({ statusCode: 500, statusMessage: 'Lecture du media impossible' });
    }
  }

  throw createError({ statusCode: 404, statusMessage: 'Fichier introuvable' });
});