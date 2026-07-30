let prismaClient;

async function getPrisma() {
  if (prismaClient) return prismaClient;

  const module = await import('../../../utils/prisma.js');
  prismaClient = module?.prisma || module?.default?.prisma;

  if (!prismaClient) {
    throw new Error('Unable to resolve prisma client from server/utils/prisma.js');
  }

  return prismaClient;
}

export default defineEventHandler(async (event) => {
  try {
    const id = event.context?.params?.id;
    if (!id) {
      return sendError(event, createError({ statusCode: 400, statusMessage: 'Parametre id requis' }));
    }

    const prisma = await getPrisma();
    const authModule = await import('../../../utils/auth.js');
    const user = await authModule.requireAuthUser(event);
    const influencer = await prisma.influencer.findFirst({
      where: {
        id,
        userId: user.id,
      },
      select: {
        id: true,
        twitterUsername: true,
      },
    });

    if (!influencer) {
      return sendError(event, createError({ statusCode: 404, statusMessage: 'Influenceuse introuvable' }));
    }

    const { getTwitterSession } = await import('../../../utils/twitterSession.js');
    const connected = await getTwitterSession(id);

    return {
      connected,
      username: influencer.twitterUsername || null,
    };
  } catch (err) {
    return sendError(
      event,
      createError({
        statusCode: 500,
        statusMessage: 'Verification du statut Twitter impossible',
        data: {
          code: err?.code,
          message: err?.message,
        },
      }),
    );
  }
});
