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

function isMissingTwitterPublishedAtError(err) {
  return String(err?.message || '').includes('Unknown field `twitterPublishedAt`')
}

export default defineEventHandler(async (event) => {
  try {
    const id = event.context?.params?.id;
    if (!id) {
      return sendError(event, createError({ statusCode: 400, statusMessage: 'Parametre id requis' }));
    }

    const query = getQuery(event);
    const statusValue = query.statuses || query.status || 'PENDING';
    const statuses = String(statusValue)
      .split(',')
      .map((status) => status.trim())
      .filter(Boolean);

    const validStatuses = ['PROCESSING', 'PENDING', 'VALIDATED', 'PUBLISHED', 'REJECTED', 'FAILED'];
    if (!statuses.length || statuses.some((status) => !validStatuses.includes(status))) {
      return sendError(event, createError({ statusCode: 400, statusMessage: 'Statut invalide' }));
    }

    const prisma = await getPrisma();

    const where = {
      influencerId: id,
      status: statuses.length === 1 ? statuses[0] : { in: statuses },
    }

    let contents
    try {
      contents = await prisma.generatedContent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          imageUrl: true,
          caption: true,
          errorMessage: true,
          platform: true,
          format: true,
          status: true,
          scheduledAt: true,
          publishedAt: true,
          twitterPublishedAt: true,
          createdAt: true,
        },
      })
    } catch (queryErr) {
      if (!isMissingTwitterPublishedAtError(queryErr)) {
        throw queryErr
      }

      const fallbackContents = await prisma.generatedContent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          imageUrl: true,
          caption: true,
          errorMessage: true,
          platform: true,
          format: true,
          status: true,
          scheduledAt: true,
          publishedAt: true,
          createdAt: true,
        },
      })

      contents = fallbackContents.map((item) => ({
        ...item,
        twitterPublishedAt: null,
      }))
    }

    return { contents };
  } catch (err) {
    return sendError(
      event,
      createError({
        statusCode: 500,
        statusMessage: 'Impossible de charger les contenus',
        data: {
          code: err?.code,
          message: err?.message,
        },
      }),
    );
  }
});
