import { createError } from 'h3';
import {
  createAuthSession,
  hashPassword,
  normalizeEmail,
  validatePasswordShape,
} from '../../utils/auth.js';
import { prisma } from '../../utils/prisma.js';

export default defineEventHandler(async (event) => {
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
  const existing = await prisma.user.findUnique({ where: { email } });

  let user;
  if (existing?.id) {
    if (existing.passwordHash) {
      throw createError({ statusCode: 409, statusMessage: 'Un compte existe deja avec cet email' });
    }

    user = await prisma.user.update({
      where: { id: existing.id },
      data: { passwordHash },
      select: {
        id: true,
        email: true,
        plan: true,
        createdAt: true,
      },
    });
  } else {
    user = await prisma.user.create({
      data: {
        email,
        passwordHash,
      },
      select: {
        id: true,
        email: true,
        plan: true,
        createdAt: true,
      },
    });
  }

  await createAuthSession(event, user.id);

  return { user };
});
