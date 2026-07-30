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

function isMissingTwitterPublishedAtError(err) {
  return String(err?.message || '').includes('Unknown field `twitterPublishedAt`')
}

export default defineEventHandler(async (event) => {
  try {
    const id = event.context?.params?.id;
    if (!id) {
      return sendError(event, createError({ statusCode: 400, statusMessage: 'Parametre id requis' }));
    }

    const prisma = await getPrisma();
    const authModule = await import('../../utils/auth.js');
    const user = await authModule.requireAuthUser(event);
    let content
    try {
      content = await prisma.generatedContent.findUnique({
        where: { id },
        select: {
          id: true,
          influencerId: true,
          ambassadorId: true,
          imageUrl: true,
          caption: true,
          prompt: true,
          status: true,
          errorMessage: true,
          platform: true,
          format: true,
          scheduledAt: true,
          publishedAt: true,
          twitterPublishedAt: true,
          createdAt: true,
          campaignId: true,
          campaign: {
            select: {
              id: true,
              name: true,
              objective: true,
              channel: true,
            },
          },
          influencer: {
            select: {
              id: true,
              userId: true,
              name: true,
              niche: true,
            },
          },
        },
      })
    } catch (queryErr) {
      if (!isMissingTwitterPublishedAtError(queryErr)) {
        throw queryErr
      }

      const fallbackContent = await prisma.generatedContent.findUnique({
        where: { id },
        select: {
          id: true,
          influencerId: true,
          ambassadorId: true,
          imageUrl: true,
          caption: true,
          prompt: true,
          status: true,
          errorMessage: true,
          platform: true,
          format: true,
          scheduledAt: true,
          publishedAt: true,
          createdAt: true,
          campaignId: true,
          campaign: {
            select: {
              id: true,
              name: true,
              objective: true,
              channel: true,
            },
          },
          influencer: {
            select: {
              id: true,
              userId: true,
              name: true,
              niche: true,
            },
          },
        },
      })

      content = fallbackContent
        ? {
            ...fallbackContent,
            twitterPublishedAt: null,
          }
        : null
    }

    if (!content) {
      return sendError(event, createError({ statusCode: 404, statusMessage: 'Contenu introuvable' }));
    }

    if (String(content.influencer?.userId || '') !== String(user.id || '')) {
      return sendError(event, createError({ statusCode: 403, statusMessage: 'Accès refusé' }));
    }

    return {
      ...content,
      influencer: content.influencer
        ? {
            id: content.influencer.id,
            name: content.influencer.name,
            niche: content.influencer.niche,
          }
        : null,
    };
  } catch (err) {
    return sendError(
      event,
      createError({
        statusCode: 500,
        statusMessage: 'Recuperation du contenu impossible',
        data: {
          code: err?.code,
          message: err?.message,
        },
      }),
    );
  }
});
