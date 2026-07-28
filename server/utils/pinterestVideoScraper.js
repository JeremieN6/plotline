import fs from 'node:fs/promises';
import path from 'node:path';

import { chromium } from 'playwright';

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
];

const NAVIGATION_TIMEOUT_MS = 45000;

async function safeGoto(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAVIGATION_TIMEOUT_MS });

  // Pinterest keeps long-lived requests open, so networkidle may never settle.
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
}

function randomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)] || USER_AGENTS[0];
}

async function saveVideoBuffer(buffer) {
  const tempDir = path.join(process.cwd(), 'storage', 'temp');
  await fs.mkdir(tempDir, { recursive: true });

  const outputPath = path.join(tempDir, `video_${Date.now()}.mp4`);
  await fs.writeFile(outputPath, buffer);
  return outputPath;
}

async function downloadVideo(url, userAgent) {
  const response = await fetch(url, {
    headers: {
      'user-agent': userAgent,
      referer: 'https://www.pinterest.com/',
    },
  });

  if (!response.ok) {
    return null;
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (buffer.length <= 500 * 1024) {
    return null;
  }

  return saveVideoBuffer(buffer);
}

function isPlayableVideoUrl(value) {
  return /\.(mp4|m3u8|cmfv|cmfa)(\?|$)/i.test(String(value || '').trim());
}

function absoluteUrl(value, baseUrl) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  if (raw.startsWith('//')) {
    return `https:${raw}`;
  }

  try {
    return new URL(raw, baseUrl).toString();
  } catch {
    return raw;
  }
}

function parsePlaylistLines(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseAttributeList(raw) {
  const attributes = {};
  const input = String(raw || '').trim();
  if (!input) return attributes;

  for (const segment of input.split(',')) {
    const index = segment.indexOf('=');
    if (index === -1) continue;

    const key = segment.slice(0, index).trim();
    let value = segment.slice(index + 1).trim();

    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }

    if (key) {
      attributes[key] = value;
    }
  }

  return attributes;
}

async function fetchText(url, userAgent) {
  const response = await fetch(url, {
    headers: {
      'user-agent': userAgent,
      referer: 'https://www.pinterest.com/',
      accept: 'application/vnd.apple.mpegurl,application/x-mpegURL,text/plain,*/*',
    },
  });

  if (!response.ok) {
    throw new Error(`Unable to fetch playlist: ${url}`);
  }

  return response.text();
}

async function fetchBinary(url, userAgent) {
  const response = await fetch(url, {
    headers: {
      'user-agent': userAgent,
      referer: 'https://www.pinterest.com/',
      accept: '*/*',
    },
  });

  if (!response.ok) {
    throw new Error(`Unable to fetch media segment: ${url}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function downloadPinterestHlsAsMp4(playlistUrl, userAgent) {
  let currentPlaylistUrl = playlistUrl;
  let playlistText = await fetchText(currentPlaylistUrl, userAgent);

  for (let safety = 0; safety < 3; safety += 1) {
    const lines = parsePlaylistLines(playlistText);
    const variantLine = lines.find((line) => line.startsWith('#EXT-X-STREAM-INF:'));

    if (!variantLine) {
      break;
    }

    const variantIndex = lines.indexOf(variantLine);
    const variantPath = lines[variantIndex + 1];
    if (!variantPath) {
      break;
    }

    currentPlaylistUrl = absoluteUrl(variantPath, currentPlaylistUrl);
    playlistText = await fetchText(currentPlaylistUrl, userAgent);
  }

  const lines = parsePlaylistLines(playlistText);
  const baseUrl = currentPlaylistUrl;
  const parts = [];
  let totalSize = 0;

  const mapLine = lines.find((line) => line.startsWith('#EXT-X-MAP:'));
  if (mapLine) {
    const attributes = parseAttributeList(mapLine.replace('#EXT-X-MAP:', ''));
    const mapUrl = attributes.URI ? absoluteUrl(attributes.URI, baseUrl) : '';
    if (mapUrl) {
      const initBuffer = await fetchBinary(mapUrl, userAgent);
      parts.push(initBuffer);
      totalSize += initBuffer.length;
    }
  }

  for (const line of lines) {
    if (!line || line.startsWith('#')) {
      continue;
    }

    const segmentUrl = absoluteUrl(line, baseUrl);
    if (!segmentUrl) {
      continue;
    }

    const segmentBuffer = await fetchBinary(segmentUrl, userAgent);
    parts.push(segmentBuffer);
    totalSize += segmentBuffer.length;

    if (totalSize > 500 * 1024) {
      break;
    }
  }

  if (totalSize <= 500 * 1024) {
    return null;
  }

  return saveVideoBuffer(Buffer.concat(parts));
}

function normalizeHref(href) {
  const value = String(href || '').trim();
  if (!value) return '';

  try {
    const url = new URL(value, 'https://www.pinterest.com');
    const normalizedPath = `${url.pathname}${url.search}${url.hash}`;
    return normalizedPath.includes('/pin/') ? normalizedPath : '';
  } catch {
    return value.includes('/pin/') ? value : '';
  }
}

function normalizeVideoUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) {
    return '';
  }

  if (raw.startsWith('//')) {
    return `https:${raw}`;
  }

  if (raw.startsWith('/')) {
    return `https://www.pinterest.com${raw}`;
  }

  return raw;
}

function getVideoUrlType(value) {
  const normalized = normalizeVideoUrl(value);
  if (!isPlayableVideoUrl(normalized)) {
    return '';
  }

  try {
    const url = new URL(normalized);
    const ext = path.extname(url.pathname || '').toLowerCase();
    if (ext === '.mp4') return 'mp4';
    if (ext === '.m3u8' || ext === '.cmfv' || ext === '.cmfa') return 'hls';
  } catch {
    // Keep conservative fallback below.
  }

  return /\.mp4(\?|$)/i.test(normalized) ? 'mp4' : 'hls';
}

export async function scrapePinterestVideo(query) {
  const keyword = String(query || '').trim();
  if (!keyword) {
    return null;
  }

  let browser;
  const userAgent = randomUserAgent();

  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ userAgent });
    const page = await context.newPage();

    const searchUrl = `https://www.pinterest.com/search/videos/?q=${encodeURIComponent(keyword)}`;
    await safeGoto(page, searchUrl);

    try {
      await page.getByRole('button', { name: /accept|agree|tout accepter|accepter|reject|refuser/i }).first().click({ timeout: 3000 });
    } catch {
      // Cookie dialog is optional.
    }

    for (let i = 0; i < 2; i += 1) {
      await page.evaluate(() => {
        window.scrollBy(0, 800);
      });
      await page.waitForTimeout(1000);
    }

    const searchPageCandidates = await page.evaluate(() => {
      const urls = new Set();

      const add = (value) => {
        const raw = String(value || '').trim();
        if (!raw) return;
        if (/\.(mp4|m3u8|cmfv|cmfa)(\?|$)/i.test(raw)) {
          urls.add(raw);
        }
      };

      for (const element of document.querySelectorAll('video, source, meta[property="og:video"], meta[property="og:video:url"]')) {
        add(element.getAttribute('src'));
        add(element.getAttribute('content'));
        add(element.getAttribute('data-src'));
        add(element.currentSrc);
      }

      const resources = performance.getEntriesByType('resource') || [];
      for (const entry of resources) {
        add(entry.name);
      }

      const dataElement = document.getElementById('__PWS_DATA__');
      if (dataElement?.textContent) {
        const matches = dataElement.textContent.match(/https?:\/\/[^\"'\s<>]+?\.(?:mp4|m3u8|cmfv|cmfa)[^\"'\s<>]*/gi) || [];
        for (const match of matches) {
          add(match);
        }
      }

      return Array.from(urls);
    });

    for (const candidateUrl of searchPageCandidates.map(normalizeVideoUrl).filter(Boolean).slice(0, 10)) {
      try {
        const videoType = getVideoUrlType(candidateUrl);
        if (videoType === 'mp4') {
          const savedPath = await downloadVideo(candidateUrl, userAgent);
          if (savedPath) {
            return savedPath;
          }
          continue;
        }

        if (videoType === 'hls') {
          const savedPath = await downloadPinterestHlsAsMp4(candidateUrl, userAgent);
          if (savedPath) {
            return savedPath;
          }
        }
      } catch {
        // Try next direct candidate URL.
      }
    }

    const hrefs = await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll('a[href*="/pin/"]'));

      const durationPattern = /\b\d+:(?:\d{2})\b/;

      const videoLike = anchors
        .filter((anchor) => {
          const text = `${anchor.textContent || ''} ${anchor.getAttribute('aria-label') || ''}`;
          return Boolean(
            anchor.querySelector('video, source[src*=".mp4"], meta[property="og:video"], meta[property="og:video:url"]')
            || durationPattern.test(text)
            || /play/i.test(text),
          );
        })
        .map((anchor) => anchor.getAttribute('href') || '')
        .filter((href) => href.includes('/pin/'));

      const allPins = anchors
        .map((anchor) => anchor.getAttribute('href') || '')
        .filter((href) => href.includes('/pin/'));

      return Array.from(new Set(videoLike.length ? videoLike : allPins));
    });

    for (const href of hrefs.map(normalizeHref).filter(Boolean).slice(0, 12)) {
      const pinUrl = `https://www.pinterest.com${href}`;

      try {
        await safeGoto(page, pinUrl);
        await page.waitForTimeout(2500);

        const candidateUrls = await page.evaluate(() => {
          const urls = new Set();

          const add = (value) => {
            const raw = String(value || '').trim();
            if (!raw) return;
            if (/\.(mp4|m3u8|cmfv|cmfa)(\?|$)/i.test(raw)) {
              urls.add(raw);
            }
          };

          for (const element of document.querySelectorAll('video, source, meta[property="og:video"], meta[property="og:video:url"]')) {
            add(element.getAttribute('src'));
            add(element.getAttribute('content'));
            add(element.getAttribute('data-src'));
            add(element.currentSrc);
          }

          const resources = performance.getEntriesByType('resource') || [];
          for (const entry of resources) {
            add(entry.name);
          }

          const dataElement = document.getElementById('__PWS_DATA__');
          if (dataElement?.textContent) {
            const text = dataElement.textContent;
            const matches = text.match(/https?:\/\/[^\"'\s<>]+?\.(?:mp4|m3u8|cmfv|cmfa)[^\"'\s<>]*/gi) || [];
            for (const match of matches) {
              add(match);
            }
          }

          return Array.from(urls);
        });

        if (!candidateUrls.length) {
          continue;
        }

        for (const candidateUrl of candidateUrls.map(normalizeVideoUrl).filter(Boolean)) {
          try {
            const videoType = getVideoUrlType(candidateUrl);

            if (videoType === 'mp4') {
              const savedPath = await downloadVideo(candidateUrl, userAgent);
              if (savedPath) {
                return savedPath;
              }
              continue;
            }

            if (videoType === 'hls') {
              const savedPath = await downloadPinterestHlsAsMp4(candidateUrl, userAgent);
              if (savedPath) {
                return savedPath;
              }
            }
          } catch {
            // Try the next candidate URL.
          }
        }
      } catch {
        // Try the next pin.
      }
    }

    return null;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}