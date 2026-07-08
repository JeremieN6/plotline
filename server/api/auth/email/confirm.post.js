import { createError } from 'h3';
import { prisma } from '../../../utils/prisma.js';
import { hashOpaqueToken } from '../../../utils/auth.js';

function resolveSecret(event) {
  const config = useRuntimeConfig(event);
  return String(config.authSessionSecret || config.geminiApiKey || 'plotline-dev-session-secret');
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const rawToken = String(body?.token || '').trim();

  if (!rawToken) {
    throw createError({ statusCode: 400, statusMessage: 'Token invalide' });
  }

  const tokenHash = hashOpaqueToken(rawToken, resolveSecret(event));
  const emailToken = await prisma.emailChangeToken.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      userId: true,
      newEmail: true,
      expiresAt: true,
      usedAt: true,
    },
  });

  if (!emailToken || emailToken.usedAt || emailToken.expiresAt <= new Date()) {
    throw createError({ statusCode: 400, statusMessage: 'Lien de confirmation invalide ou expire' });
  }

  const emailOwner = await prisma.user.findUnique({
    where: { email: emailToken.newEmail },
    select: { id: true },
  });

  if (emailOwner?.id && emailOwner.id !== emailToken.userId) {
    throw createError({ statusCode: 409, statusMessage: 'Cette adresse email est deja utilisee' });
  }

  const user = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id: emailToken.userId },
      data: { email: emailToken.newEmail },
      select: {
        id: true,
        email: true,
        plan: true,
        createdAt: true,
      },
    });

    await tx.emailChangeToken.update({
      where: { id: emailToken.id },
      data: { usedAt: new Date() },
    });

    await tx.emailChangeToken.deleteMany({
      where: {
        userId: emailToken.userId,
        id: { not: emailToken.id },
      },
    });

    return updated;
  });

  return { ok: true, user };
});
