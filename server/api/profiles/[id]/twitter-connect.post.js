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

    const ownerMatch = await prisma.profile.findFirst({
      where: {
        id,
        userId: user.id,
      },
      select: { id: true },
    });

    if (!ownerMatch) {
      return sendError(event, createError({ statusCode: 404, statusMessage: 'Influenceuse introuvable' }));
    }

    const { connectTwitter } = await import('../../../utils/twitterSession.js');
    const result = await connectTwitter(id);

    const updated = await prisma.profile.update({
      where: { id },
      data: {
        twitterConnected: true,
        twitterUsername: result?.username || null,
      },
      select: {
        id: true,
        twitterConnected: true,
        twitterUsername: true,
      },
    });

    return {
      success: true,
      connected: updated.twitterConnected,
      username: updated.twitterUsername,
    };
  } catch (err) {
    if (err?.code === 'P2025') {
      return sendError(event, createError({ statusCode: 404, statusMessage: 'Influenceuse introuvable' }));
    }

    if (err?.code === 'TWITTER_LOGIN_TIMEOUT') {
      return sendError(event, createError({ statusCode: 408, statusMessage: 'Connexion Twitter non terminee dans le delai' }));
    }

    return sendError(
      event,
      createError({
        statusCode: 500,
        statusMessage: 'Connexion Twitter impossible',
        data: {
          code: err?.code,
          message: err?.message,
        },
      }),
    );
  }
});
