import fs from 'node:fs/promises';
import path from 'node:path';

import { getStorageRoot, resolveMediaPath } from '../../utils/mediaStorage.js';

function getContentType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === '.png') {
    return 'image/png';
  }
  return 'image/jpeg';
}

export default defineEventHandler(async (event) => {
  const rawPath = event.context?.params?.path;
  const pathSegments = Array.isArray(rawPath) ? rawPath : [rawPath].filter(Boolean);
  const absolutePath = resolveMediaPath(pathSegments.join('/'));

  if (!absolutePath) {
    throw createError({ statusCode: 400, statusMessage: 'Chemin media invalide' });
  }

  const allowedRoot = getStorageRoot();
  const relativeFromRoot = path.relative(allowedRoot, absolutePath);
  if (!relativeFromRoot || relativeFromRoot.startsWith('..') || path.isAbsolute(relativeFromRoot)) {
    throw createError({ statusCode: 403, statusMessage: 'Acces refuse' });
  }

  try {
    const buffer = await fs.readFile(absolutePath);
    setHeader(event, 'Content-Type', getContentType(absolutePath));
    return buffer;
  } catch (error) {
    if (error?.code === 'ENOENT') {
      throw createError({ statusCode: 404, statusMessage: 'Fichier introuvable' });
    }

    throw createError({ statusCode: 500, statusMessage: 'Lecture du media impossible' });
  }
});