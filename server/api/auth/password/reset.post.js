import { createError } from 'h3';
import { prisma } from '../../../utils/prisma.js';
import { hashOpaqueToken, hashPassword, validatePasswordShape } from '../../../utils/auth.js';

function resolveSecret(event) {
  const config = useRuntimeConfig(event);
  return String(config.authSessionSecret || config.geminiApiKey || 'plotline-dev-session-secret');
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const rawToken = String(body?.token || '').trim();
  const newPassword = String(body?.password || '');

  if (!rawToken) {
    throw createError({ statusCode: 400, statusMessage: 'Token invalide' });
  }

  if (!validatePasswordShape(newPassword)) {
    throw createError({ statusCode: 400, statusMessage: 'Le mot de passe doit contenir au moins 8 caracteres' });
  }

  const tokenHash = hashOpaqueToken(rawToken, resolveSecret(event));
  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      userId: true,
      expiresAt: true,
      usedAt: true,
    },
  });

  if (!resetToken || resetToken.usedAt || resetToken.expiresAt <= new Date()) {
    throw createError({ statusCode: 400, statusMessage: 'Lien de reinitialisation invalide ou expire' });
  }

  const passwordHash = await hashPassword(newPassword);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash },
    }),
    prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() },
    }),
    prisma.authSession.deleteMany({ where: { userId: resetToken.userId } }),
    prisma.passwordResetToken.deleteMany({
      where: {
        userId: resetToken.userId,
        id: { not: resetToken.id },
      },
    }),
  ]);

  return { ok: true };
});
