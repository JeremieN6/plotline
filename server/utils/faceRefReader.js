import fs from 'node:fs/promises';
import path from 'node:path';

import { isAbsoluteHttpUrl } from './blobStorage.js';

function mimeFromExt(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  return 'image/jpeg';
}

function normalizeContentTypeFromHeader(value) {
  return String(value || '').split(';')[0].trim().toLowerCase();
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function resolveFaceRefAbsolutePath(faceRefPath) {
  const rawPath = String(faceRefPath || '').trim();
  if (!rawPath) {
    throw new Error('Influencer face reference is missing. Upload a face ref first.');
  }

  const candidates = [];

  if (path.isAbsolute(rawPath)) {
    candidates.push(rawPath);
  }

  if (rawPath.startsWith('/uploads/')) {
    candidates.push(path.join(process.cwd(), 'public', rawPath.replace(/^\/+/, '')));
  }

  candidates.push(path.join(process.cwd(), rawPath.replace(/^\/+/, '')));

  const basename = path.basename(rawPath);
  candidates.push(path.join(process.cwd(), 'public', 'uploads', 'face-refs', basename));
  candidates.push(path.join(process.cwd(), 'storage', 'uploads', 'face-refs', basename));

  for (const candidatePath of candidates) {
    if (await fileExists(candidatePath)) {
      return candidatePath;
    }
  }

  throw new Error(`Face reference file not found: ${rawPath}`);
}

export async function readImageSourceBuffer(imageSource) {
  const source = String(imageSource || '').trim();
  if (!source) {
    throw new Error('Image source is missing');
  }

  if (isAbsoluteHttpUrl(source)) {
    const response = await fetch(source);
    if (!response.ok) {
      throw new Error(`Unable to download image source: ${source}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const mimeType = normalizeContentTypeFromHeader(response.headers.get('content-type')) || 'image/jpeg';

    return {
      buffer,
      mimeType,
      origin: source,
    };
  }

  const absolutePath = await resolveFaceRefAbsolutePath(source);
  const buffer = await fs.readFile(absolutePath);

  return {
    buffer,
    mimeType: mimeFromExt(absolutePath),
    origin: absolutePath,
  };
}
