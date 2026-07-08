import { createError } from 'h3';
import { prisma } from '../../../utils/prisma.js';
import { hashPassword, requireAuthUser, validatePasswordShape, verifyPassword } from '../../../utils/auth.js';

export default defineEventHandler(async (event) => {
  const authUser = await requireAuthUser(event);
  const body = await readBody(event);

  const currentPassword = String(body?.currentPassword || '');
  const newPassword = String(body?.newPassword || '');

  if (!validatePasswordShape(newPassword)) {
    throw createError({ statusCode: 400, statusMessage: 'Le nouveau mot de passe doit contenir au moins 8 caracteres' });
  }

  const user = await prisma.user.findUnique({
    where: { id: authUser.id },
    select: {
      id: true,
      passwordHash: true,
    },
  });

  if (!user?.id) {
    throw createError({ statusCode: 401, statusMessage: 'Session invalide' });
  }

  if (user.passwordHash) {
    const validCurrentPassword = await verifyPassword(currentPassword, user.passwordHash);
    if (!validCurrentPassword) {
      throw createError({ statusCode: 401, statusMessage: 'Mot de passe actuel incorrect' });
    }

    const isSamePassword = await verifyPassword(newPassword, user.passwordHash);
    if (isSamePassword) {
      throw createError({ statusCode: 400, statusMessage: 'Le nouveau mot de passe doit etre different de l ancien' });
    }
  }

  const passwordHash = await hashPassword(newPassword);

  await prisma.user.update({
    where: { id: authUser.id },
    data: { passwordHash },
  });

  return { ok: true };
});
