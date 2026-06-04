let prismaClient;

function isTransientDbError(err) {
  const code = err?.code;
  return code === 'ETIMEDOUT' || code === 'P1001' || code === 'P1002';
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getPrisma() {
  if (prismaClient) return prismaClient;

  const module = await import('../../utils/prisma.js');
  prismaClient = module?.prisma || module?.default?.prisma;

  if (!prismaClient) {
    throw new Error('Unable to resolve prisma client from server/utils/prisma.js');
  }

  return prismaClient;
}

module.exports = defineEventHandler(async (event) => {
  try {
    const prisma = await getPrisma();
    const userId = getQuery(event).userId;
    if (!userId) {
      return sendError(event, createError({ statusCode: 400, statusMessage: 'Paramètre userId requis' }));
    }
    const store = useStorage('data');
    const storeKey = `influencers:${userId}`;

    let influencers;
    let lastError;

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        influencers = await prisma.influencer.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            userId: true,
            name: true,
            niche: true,
            style: true,
            faceRefPath: true,
            bodyRefPath: true,
            instagramAccountId: true,
            tiktokEnabled: true,
            calendarStep: true,
            createdAt: true
          }
        });
        break;
      } catch (err) {
        lastError = err;
        if (!isTransientDbError(err) || attempt === 3) {
          throw err;
        }
        await sleep(200 * attempt);
      }
    }

    if (!influencers && lastError) {
      throw lastError;
    }

    await store.setItem(storeKey, influencers);
    return influencers;
  } catch (err) {
    if (isTransientDbError(err)) {
      const userId = getQuery(event).userId;
      const store = useStorage('data');
      const storeKey = `influencers:${userId}`;
      const cached = await store.getItem(storeKey);
      if (Array.isArray(cached)) {
        return cached;
      }
    }

    return sendError(
      event,
      createError({
        statusCode: 500,
        statusMessage: 'Erreur serveur',
        data: {
          name: err?.name,
          code: err?.code,
          message: err?.message,
          meta: err?.meta,
        },
      }),
    );
  }
});
