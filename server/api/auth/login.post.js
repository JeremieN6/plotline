import { createError } from 'h3';
import {
  createAuthSession,
  normalizeEmail,
  verifyPassword,
} from '../../utils/auth.js';
import { prisma } from '../../utils/prisma.js';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const email = normalizeEmail(body?.email);
  const password = String(body?.password || '');

  if (!email || !password) {
    throw createError({ statusCode: 400, statusMessage: 'Email et mot de passe requis' });
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      passwordHash: true,
      plan: true,
      accountType: true,
      createdAt: true,
    },
  });

  if (!user?.passwordHash) {
    throw createError({ statusCode: 401, statusMessage: 'Identifiants invalides' });
  }

  const isValid = await verifyPassword(password, user.passwordHash);
  if (!isValid) {
    throw createError({ statusCode: 401, statusMessage: 'Identifiants invalides' });
  }

  await createAuthSession(event, user.id);

  return {
    user: {
      id: user.id,
      email: user.email,
      plan: user.plan,
      accountType: user.accountType,
      createdAt: user.createdAt,
    },
  };
});
