import { createError } from 'h3';
import { prisma } from '../../../utils/prisma.js';
import { clearSessionCookie, requireAuthUser, verifyPasswordWithVariants } from '../../../utils/auth.js';

const CONFIRMATION_TEXT = 'SUPPRIMER MON COMPTE';

export default defineEventHandler(async (event) => {
  const authUser = await requireAuthUser(event);
  const body = await readBody(event);

  const confirmationText = String(body?.confirmationText || '').trim();
  const password = String(body?.password || '');

  if (confirmationText !== CONFIRMATION_TEXT) {
    throw createError({ statusCode: 400, statusMessage: 'Confirmation invalide' });
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
    const validPassword = await verifyPasswordWithVariants(password, user.passwordHash);
    if (!validPassword) {
      throw createError({ statusCode: 401, statusMessage: 'Mot de passe incorrect' });
    }
  }

  const influencerRows = await prisma.profile.findMany({
    where: { userId: user.id },
    select: { id: true },
  });
  const influencerIds = influencerRows.map((row) => row.id);

  await prisma.$transaction(async (tx) => {
    if (influencerIds.length > 0) {
      await tx.generatedContent.deleteMany({
        where: { influencerId: { in: influencerIds } },
      });

      await tx.influencer.deleteMany({
        where: { id: { in: influencerIds } },
      });
    }

    await tx.user.delete({ where: { id: user.id } });
  });

  clearSessionCookie(event);

  const store = useStorage('data');
  await store.removeItem(`influencers:${user.id}`);
  await Promise.all(influencerIds.map((id) => store.removeItem(`influencer:${id}`)));

  return { ok: true };
});
