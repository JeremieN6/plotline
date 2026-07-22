import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import { chromium } from 'playwright';

function getSessionStatePath(influencerId) {
  return path.join(process.cwd(), 'storage', 'sessions', `twitter_${String(influencerId || '').trim()}`, 'state.json');
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function isAbsoluteHttpUrl(value) {
  return /^https?:\/\//i.test(String(value || '').trim());
}

function extensionFromContentType(contentType) {
  const value = String(contentType || '').toLowerCase();
  if (value.includes('image/png')) return '.png';
  if (value.includes('image/webp')) return '.webp';
  if (value.includes('image/gif')) return '.gif';
  if (value.includes('video/mp4')) return '.mp4';
  return '.jpg';
}

function extensionFromUrl(urlValue) {
  try {
    const parsed = new URL(String(urlValue || ''));
    const ext = path.extname(parsed.pathname || '').toLowerCase();
    if (ext) {
      return ext;
    }
  } catch {
    // Fallback to default extension.
  }

  return '.jpg';
}

async function downloadRemoteUploadToTemp(imageUrl) {
  const response = await fetch(String(imageUrl), { method: 'GET' });
  if (!response.ok) {
    throw createError({ statusCode: 400, statusMessage: 'Impossible de telecharger le media distant pour publication Twitter' });
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length) {
    throw createError({ statusCode: 400, statusMessage: 'Le media distant Twitter est vide' });
  }

  const tempDir = path.join(process.cwd(), 'storage', 'temp', 'twitter');
  await fs.mkdir(tempDir, { recursive: true });

  const contentType = response.headers.get('content-type') || '';
  const extension = extensionFromContentType(contentType) || extensionFromUrl(imageUrl);
  const tempFilePath = path.join(tempDir, `${Date.now()}-${randomUUID()}${extension}`);

  await fs.writeFile(tempFilePath, bytes);
  return tempFilePath;
}

function isLoginUrl(url) {
  const value = String(url || '').toLowerCase();
  return value.includes('/login') || value.includes('/i/flow');
}

async function resolveLocalUploadPath(imageUrl) {
  const raw = String(imageUrl || '').trim();
  if (!raw) {
    return null;
  }

  if (isAbsoluteHttpUrl(raw)) {
    return downloadRemoteUploadToTemp(raw);
  }

  let normalized = raw;

  if (normalized.startsWith('/api/media/')) {
    normalized = normalized.slice('/api/media/'.length);
  } else if (normalized.startsWith('/uploads/')) {
    normalized = normalized.slice('/uploads/'.length);
  } else if (normalized.startsWith('/')) {
    normalized = normalized.slice(1);
  }

  normalized = normalized
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean)
    .join('/');

  if (!normalized) {
    return null;
  }

  const fileName = path.basename(normalized);
  const candidates = [
    path.join(process.cwd(), 'storage', 'uploads', 'generated', normalized),
    path.join(process.cwd(), 'storage', 'uploads', normalized),
    path.join(process.cwd(), 'storage', 'uploads', 'generated', fileName),
  ];

  for (const candidate of candidates) {
    if (await fileExists(candidate)) {
      return candidate;
    }
  }

  return null;
}

function throwSessionExpired() {
  const error = new Error('SESSION_EXPIRED');
  error.code = 'SESSION_EXPIRED';
  throw error;
}

export async function publishToTwitter(influencerId, content, caption) {
  const normalizedId = String(influencerId || '').trim();
  if (!normalizedId) {
    throw createError({ statusCode: 400, statusMessage: 'Influencer id requis' });
  }

  const statePath = getSessionStatePath(normalizedId);
  const hasSession = await fileExists(statePath);
  if (!hasSession) {
    const missingError = new Error('SESSION_MISSING');
    missingError.code = 'SESSION_MISSING';
    throw missingError;
  }

  const browser = await chromium.launch({ headless: true });
  let context;
  let tempUploadPath = null;

  try {
    context = await browser.newContext({ storageState: statePath });
    const page = await context.newPage();

    await page.goto('https://twitter.com/compose/tweet', { waitUntil: 'domcontentloaded' });

    if (isLoginUrl(page.url())) {
      throwSessionExpired();
    }

    try {
      await page.waitForSelector('[data-testid="tweetTextarea_0"]', { timeout: 20_000 });
    } catch (error) {
      if (isLoginUrl(page.url())) {
        throwSessionExpired();
      }
      throw error;
    }

    const safeCaption = String(caption || content?.caption || '').slice(0, 280);
    await page.fill('[data-testid="tweetTextarea_0"]', safeCaption);

    if (content?.imageUrl) {
      const localFilePath = await resolveLocalUploadPath(content.imageUrl);
      if (!localFilePath) {
        throw createError({ statusCode: 400, statusMessage: 'Image locale introuvable pour publication Twitter' });
      }

      if (isAbsoluteHttpUrl(content.imageUrl)) {
        tempUploadPath = localFilePath;
      }

      await page.setInputFiles('[data-testid="fileInput"]', localFilePath);
      await page.waitForSelector('[data-testid="attachments"]', { timeout: 30_000 });
    }

    await page.click('[data-testid="tweetButton"]');
    await page.waitForTimeout(3000);

    if (isLoginUrl(page.url())) {
      throwSessionExpired();
    }

    return { success: true };
  } finally {
    if (tempUploadPath) {
      await fs.unlink(tempUploadPath).catch(() => {});
    }

    if (context) {
      await context.close();
    }
    await browser.close();
  }
}
