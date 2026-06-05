import fs from 'node:fs';
import path from 'node:path';

const STORAGE_ROOT = path.join(process.cwd(), 'storage', 'uploads');

export function ensureStorageDir(...segments) {
  const dirPath = path.join(STORAGE_ROOT, ...segments);
  fs.mkdirSync(dirPath, { recursive: true });
  return dirPath;
}

export function getFaceRefsDir() {
  return ensureStorageDir('face-refs');
}

export function getGeneratedDir() {
  return ensureStorageDir('generated');
}

export function getStorageRoot() {
  return STORAGE_ROOT;
}

export function toMediaUrl(...segments) {
  return `/api/media/${segments.map((segment) => encodeURIComponent(String(segment))).join('/')}`;
}

export function resolveMediaPath(relativePath = '') {
  const normalizedSegments = String(relativePath)
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (!normalizedSegments.length) {
    return null;
  }

  const absolutePath = path.join(STORAGE_ROOT, ...normalizedSegments);
  const relativeFromRoot = path.relative(STORAGE_ROOT, absolutePath);

  if (relativeFromRoot.startsWith('..') || path.isAbsolute(relativeFromRoot)) {
    return null;
  }

  return absolutePath;
}