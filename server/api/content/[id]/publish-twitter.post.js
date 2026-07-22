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
    const content = await prisma.generatedContent.findUnique({
      where: { id },
      select: {
        id: true,
        influencerId: true,
        imageUrl: true,
        caption: true,
        status: true,
      },
    });

    if (!content) {
      return sendError(event, createError({ statusCode: 404, statusMessage: 'Contenu introuvable' }));
    }

    if (content.status !== 'VALIDATED') {
      return sendError(event, createError({ statusCode: 403, statusMessage: 'Le contenu doit etre valide avant publication' }));
    }

    const { publishToTwitter } = await import('../../../utils/twitterPublisher.js');
    await publishToTwitter(content.influencerId, content, content.caption || '');

    await prisma.generatedContent.update({
      where: { id },
      data: {
        status: 'PUBLISHED',
        twitterPublishedAt: new Date(),
      },
      select: {
        id: true,
      },
    });

    return { success: true };
  } catch (err) {
    if (err?.message === 'SESSION_EXPIRED' || err?.code === 'SESSION_EXPIRED') {
      return sendError(event, createError({ statusCode: 401, statusMessage: 'Session expirée — reconnectez votre compte Twitter' }));
    }

    if (err?.message === 'SESSION_MISSING' || err?.code === 'SESSION_MISSING') {
      return sendError(event, createError({ statusCode: 404, statusMessage: 'Aucune session Twitter active. Connectez votre compte d abord.' }));
    }

    if (err?.code === 'P2025') {
      return sendError(event, createError({ statusCode: 404, statusMessage: 'Contenu introuvable' }));
    }

    return sendError(
      event,
      createError({
        statusCode: 500,
        statusMessage: 'Publication Twitter impossible',
        data: {
          code: err?.code,
          message: err?.message,
        },
      }),
    );
  }
});
