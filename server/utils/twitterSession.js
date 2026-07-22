import fs from 'node:fs/promises';
import path from 'node:path';

import { chromium } from 'playwright';

const SESSION_ROOT = path.join(process.cwd(), 'storage', 'sessions');

function getSessionDir(influencerId) {
  return path.join(SESSION_ROOT, `twitter_${String(influencerId || '').trim()}`);
}

function getStatePath(influencerId) {
  return path.join(getSessionDir(influencerId), 'state.json');
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function isLoginUrl(url) {
  const value = String(url || '').toLowerCase();
  return value.includes('/login') || value.includes('/i/flow');
}

function isHomeUrl(url) {
  const value = String(url || '').toLowerCase();
  return value.includes('/home');
}

function parseUsernameFromHref(href) {
  const value = String(href || '').trim();
  if (!value) return null;

  try {
    const parsed = new URL(value, 'https://twitter.com');
    const segment = parsed.pathname.split('/').filter(Boolean)[0] || '';
    const forbidden = new Set(['home', 'explore', 'notifications', 'messages', 'search', 'compose', 'i', 'settings']);
    if (!segment || forbidden.has(segment.toLowerCase())) {
      return null;
    }
    return segment;
  } catch {
    return null;
  }
}

async function extractUsername(page, context) {
  try {
    const profileHref = await page.locator('a[data-testid="AppTabBar_Profile_Link"]').first().getAttribute('href', { timeout: 4000 });
    const profileUsername = parseUsernameFromHref(profileHref);
    if (profileUsername) {
      return profileUsername;
    }
  } catch {
    // Fallback below.
  }

  try {
    const domUsername = await page.evaluate(() => {
      const forbidden = new Set(['home', 'explore', 'notifications', 'messages', 'search', 'compose', 'i', 'settings']);
      const links = Array.from(document.querySelectorAll('a[href^="/"]'));

      for (const link of links) {
        const href = String(link.getAttribute('href') || '').trim();
        const segment = href.split('?')[0].split('/').filter(Boolean)[0] || '';
        if (!segment) continue;
        if (forbidden.has(segment.toLowerCase())) continue;
        return segment;
      }

      return null;
    });

    if (domUsername) {
      return String(domUsername);
    }
  } catch {
    // Continue to cookie fallback.
  }

  try {
    const cookies = await context.cookies(['https://twitter.com', 'https://x.com']);
    const cookie = cookies.find((item) => {
      const name = String(item?.name || '').toLowerCase();
      return name === 'screen_name' || name === 'username';
    });

    if (cookie?.value) {
      return String(cookie.value);
    }
  } catch {
    // Ignore cookie parsing errors.
  }

  return null;
}

export async function connectTwitter(influencerId) {
  const normalizedId = String(influencerId || '').trim();
  if (!normalizedId) {
    throw createError({ statusCode: 400, statusMessage: 'Influencer id requis' });
  }

  const sessionDir = getSessionDir(normalizedId);
  const statePath = getStatePath(normalizedId);

  await fs.mkdir(sessionDir, { recursive: true });

  const browser = await chromium.launch({ headless: false });
  const hasState = await fileExists(statePath);

  let context;
  try {
    context = await browser.newContext(hasState ? { storageState: statePath } : {});
    const page = await context.newPage();

    await page.goto('https://twitter.com/home', { waitUntil: 'domcontentloaded' });

    if (isLoginUrl(page.url())) {
      try {
        await page.waitForURL((url) => isHomeUrl(url.href), { timeout: 120_000 });
      } catch {
        const error = new Error('TWITTER_LOGIN_TIMEOUT');
        error.code = 'TWITTER_LOGIN_TIMEOUT';
        throw error;
      }
    }

    if (!isHomeUrl(page.url())) {
      const error = new Error('TWITTER_NOT_ON_HOME');
      error.code = 'TWITTER_NOT_ON_HOME';
      throw error;
    }

    const username = await extractUsername(page, context);

    await context.storageState({ path: statePath });

    return {
      success: true,
      username: username || null,
    };
  } finally {
    if (context) {
      await context.close();
    }
    await browser.close();
  }
}

export async function getTwitterSession(influencerId) {
  const normalizedId = String(influencerId || '').trim();
  if (!normalizedId) {
    return false;
  }

  return fileExists(getStatePath(normalizedId));
}
