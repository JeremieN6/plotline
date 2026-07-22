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

    const contents = await prisma.generatedContent.findMany({
      where: {
        influencerId: id,
        status: statuses.length === 1 ? statuses[0] : { in: statuses },
      },
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
    });

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
