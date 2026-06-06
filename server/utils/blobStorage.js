import { put } from '@vercel/blob';

function randomSuffix() {
  return Math.random().toString(36).slice(2, 10);
}

export function isBlobStorageEnabled() {
  const token = String(process.env.BLOB_READ_WRITE_TOKEN || '').trim();
  return Boolean(token);
}

export function isAbsoluteHttpUrl(value) {
  return /^https?:\/\//i.test(String(value || '').trim());
}

export async function uploadPublicMediaBuffer(prefix, extension, buffer, contentType) {
  if (!isBlobStorageEnabled()) {
    throw new Error('BLOB_READ_WRITE_TOKEN is missing');
  }

  const safePrefix = String(prefix || 'media').replace(/[^a-zA-Z0-9/_-]/g, '-');
  const safeExt = String(extension || 'jpg').replace(/[^a-zA-Z0-9]/g, '') || 'jpg';
  const pathname = `${safePrefix}/${Date.now()}-${randomSuffix()}.${safeExt}`;

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