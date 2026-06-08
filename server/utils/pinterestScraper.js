import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { chromium } from 'playwright';

import { detectFaceVisible, detectPersonInImage } from './imageValidation.js';

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
];

const NAVIGATION_TIMEOUT_MS = 45000;

async function safeGoto(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAVIGATION_TIMEOUT_MS });

  // Pinterest often keeps background requests alive for a long time.
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
}

function randomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)] || USER_AGENTS[0];
}

function normalizePinterestSrc(src) {
  return String(src || '').replace('/236x/', '/736x/').trim();
}

function isValidPinterestCandidate(url) {
  if (!url || url.length < 50) return false;
  if (url.includes('/60x60/') || url.includes('/75x75/')) return false;
  return true;
}

function getImageMimeType(response, imageUrl) {
  const headerMimeType = String(response?.headers?.get('content-type') || '')
    .split(';')[0]
    .trim()
    .toLowerCase();
  if (headerMimeType.startsWith('image/')) {
    return headerMimeType;
  }

  const normalizedUrl = String(imageUrl || '').toLowerCase();
  if (normalizedUrl.includes('.png')) return 'image/png';
  if (normalizedUrl.includes('.webp')) return 'image/webp';
  if (normalizedUrl.includes('.gif')) return 'image/gif';
  return 'image/jpeg';
}

async function saveImageBuffer(buffer) {
  const tempDir = path.join(os.tmpdir(), 'plotline', 'pinterest');
  await fs.mkdir(tempDir, { recursive: true });

  const outputPath = path.join(tempDir, `pinterest_${Date.now()}.jpg`);
  await fs.writeFile(outputPath, buffer);
  return outputPath;
}

export async function scrapePinterestImage(query) {
  const keyword = String(query || '').trim();
  if (!keyword) {
    return null;
  }

  let browser;

  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ userAgent: randomUserAgent() });
    const page = await context.newPage();

    const url = `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(keyword)}`;
    await safeGoto(page, url);

    try {
      await page.click('button[id*="cookie"]', { timeout: 3000 });
    } catch {
      // Cookie dialog is optional.
    }

    for (let i = 0; i < 3; i += 1) {
      await page.evaluate(() => {
        window.scrollBy(0, 800);
      });
      await page.waitForTimeout(1000);
    }

    const rawUrls = await page.$$eval('img[src*="pinimg.com"]', (images) => images
      .map((img) => img.getAttribute('src') || '')
      .filter(Boolean));

    const candidateUrls = Array.from(
      new Set(
        rawUrls
          .map(normalizePinterestSrc)
          .filter(isValidPinterestCandidate),
      ),
    ).slice(0, 20);

    if (candidateUrls.length === 0) {
      return null;
    }

    for (const imageUrl of candidateUrls) {
      try {
        const response = await fetch(imageUrl);
        if (!response.ok) {
          continue;
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        if (buffer.length <= 20 * 1024) {
          continue;
        }

        const mimeType = getImageMimeType(response, imageUrl);
        const hasPerson = await detectPersonInImage(buffer, mimeType);
        if (!hasPerson) {
          continue;
        }

        const hasFace = await detectFaceVisible(buffer, mimeType);
        if (!hasFace) {
          continue;
        }

        return await saveImageBuffer(buffer);
      } catch {
        // Try the next candidate image.
      }
    }

    return null;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}