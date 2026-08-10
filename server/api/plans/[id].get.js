let prismaClient;

async function getPrisma() {
  if (prismaClient) return prismaClient;

  const module = await import('../../utils/prisma.js');
  prismaClient = module?.prisma || module?.default?.prisma;

  if (!prismaClient) {
    throw new Error('Unable to resolve prisma client from server/utils/prisma.js');
  }

  return prismaClient;
}

/** Detail d un plan et de ses idees, pour l ecran de revue. */
export default defineEventHandler(async (event) => {
  try {
    const id = String(event.context?.params?.id || '').trim();
    if (!id) {
      return sendError(event, createError({ statusCode: 400, statusMessage: 'Parametre id requis' }));
    }

    const prisma = await getPrisma();
    const authModule = await import('../../utils/auth.js');
    const user = await authModule.requireAuthUser(event);

    const plan = await prisma.contentPlan.findFirst({
      where: { id, profile: { is: { userId: user.id } } },
      select: {
        id: true,
        status: true,
        startDate: true,
        days: true,
        createdAt: true,
        campaignId: true,
        profile: { select: { id: true, name: true } },
        items: {
          orderBy: { position: 'asc' },
          select: {
            id: true,
            position: true,
            prompt: true,
            caption: true,
            hashtags: true,
            platform: true,
            format: true,
            scheduledAt: true,
            keep: true,
            contentId: true,
          },
        },
      },
    });

    if (!plan) {
      return sendError(event, createError({ statusCode: 404, statusMessage: 'Plan introuvable' }));
    }

    return { plan };
  } catch (err) {
    if (err?.statusCode) {
      return sendError(event, err);
    }

    return sendError(
      event,
      createError({
        statusCode: 500,
        statusMessage: 'Chargement du plan impossible',
        data: { code: err?.code, message: err?.message },
      }),
    );
  }
});
