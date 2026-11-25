import { createError } from 'h3';
import {
  createAuthSession,
  hashPassword,
  normalizeEmail,
  validatePasswordShape,
} from '../../utils/auth.js';
import { SIGNUPS_CLOSED_MESSAGE, createPasswordAccount, signupsEnabled } from '../../utils/accountAccess.js';
import { prisma } from '../../utils/prisma.js';

export default defineEventHandler(async (event) => {
  // Avant toute lecture en base : ferme, la route ne dit pas quels comptes existent.
  if (!signupsEnabled()) {
    throw createError({ statusCode: 403, statusMessage: SIGNUPS_CLOSED_MESSAGE });
  }

  const body = await readBody(event);
  const email = normalizeEmail(body?.email);
  const password = String(body?.password || '');

  if (!email || !email.includes('@')) {
    throw createError({ statusCode: 400, statusMessage: 'Email invalide' });
  }

  if (!validatePasswordShape(password)) {
    throw createError({ statusCode: 400, statusMessage: 'Le mot de passe doit contenir au moins 8 caracteres' });
  }

  const passwordHash = await hashPassword(password);

  let user;
  try {
    user = await createPasswordAccount(prisma, { email, passwordHash });
  } catch (error) {
    if (error?.statusCode) {
      throw createError({ statusCode: error.statusCode, statusMessage: error.statusMessage });
    }
    throw error;
  }

  await createAuthSession(event, user.id);

  return { user };
});
