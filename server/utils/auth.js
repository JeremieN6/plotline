import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { createError, deleteCookie, getCookie, setCookie } from 'h3';

const scrypt = promisify(scryptCallback);

const SESSION_COOKIE_NAME = 'plotline_session';
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 30;
const PASSWORD_KEY_LENGTH = 64;

let prismaClient;

async function getPrisma() {
  if (prismaClient) return prismaClient;

  const module = await import('./prisma.js');
  prismaClient = module?.prisma || module?.default?.prisma;

  if (!prismaClient) {
    throw new Error('Unable to resolve prisma client from server/utils/prisma.js');
  }

  return prismaClient;
}

function toHex(buffer) {
  return Buffer.from(buffer).toString('hex');
}

function fromHex(value) {
  return Buffer.from(String(value || ''), 'hex');
}

function getSessionSecret(event) {
  const config = useRuntimeConfig(event);
  return String(config.authSessionSecret || config.geminiApiKey || 'plotline-dev-session-secret');
}

function hashSessionToken(token, secret) {
  return createHash('sha256').update(`${token}:${secret}`).digest('hex');
}

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const derivedKey = await scrypt(password, salt, PASSWORD_KEY_LENGTH);
  return `${toHex(salt)}:${toHex(derivedKey)}`;
}

export async function verifyPassword(password, passwordHash) {
  if (!passwordHash || !String(passwordHash).includes(':')) {
    return false;
  }

  const [saltHex, keyHex] = String(passwordHash).split(':');
  if (!saltHex || !keyHex) return false;

  const salt = fromHex(saltHex);
  const expected = fromHex(keyHex);
  const derived = Buffer.from(await scrypt(password, salt, expected.length));

  if (derived.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(derived, expected);
}

function setSessionCookie(event, rawToken, maxAge = SESSION_DURATION_SECONDS) {
  setCookie(event, SESSION_COOKIE_NAME, rawToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge,
  });
}

export function clearSessionCookie(event) {
  deleteCookie(event, SESSION_COOKIE_NAME, { path: '/' });
}

export async function createAuthSession(event, userId) {
  const prisma = await getPrisma();
  const rawToken = randomBytes(32).toString('hex');
  const secret = getSessionSecret(event);
  const tokenHash = hashSessionToken(rawToken, secret);
  const expiresAt = new Date(Date.now() + SESSION_DURATION_SECONDS * 1000);

  await prisma.authSession.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
    },
  });

  setSessionCookie(event, rawToken);
  return { expiresAt };
}

export async function destroyAuthSession(event) {
  const rawToken = getCookie(event, SESSION_COOKIE_NAME);
  clearSessionCookie(event);

  if (!rawToken) return;

  const prisma = await getPrisma();
  const tokenHash = hashSessionToken(rawToken, getSessionSecret(event));
  await prisma.authSession.deleteMany({ where: { tokenHash } });
}

export async function resolveAuthUser(event) {
  const rawToken = getCookie(event, SESSION_COOKIE_NAME);
  if (!rawToken) return null;

  const prisma = await getPrisma();
  const tokenHash = hashSessionToken(rawToken, getSessionSecret(event));
  const session = await prisma.authSession.findUnique({
    where: { tokenHash },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          plan: true,
          createdAt: true,
        },
      },
    },
  });

  if (!session || session.expiresAt <= new Date()) {
    if (session?.id) {
      await prisma.authSession.deleteMany({ where: { id: session.id } });
    }
    clearSessionCookie(event);
    return null;
  }

  return session.user;
}

export async function requireAuthUser(event) {
  const user = await resolveAuthUser(event);
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Authentification requise' });
  }
  return user;
}

export function validatePasswordShape(password) {
  const value = String(password || '');
  return value.length >= 8;
}

export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}
