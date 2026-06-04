let prismaClient;

function isTransientDbError(err) {
  const code = err?.code;
  return code === 'ETIMEDOUT' || code === 'P1001' || code === 'P1002';
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
    const id = event.context?.params?.id;
    if (!id) {
      return sendError(event, createError({ statusCode: 400, statusMessage: 'Paramètre id requis' }));
    }

    const store = useStorage('data');
    const cachedInfluencer = await store.getItem(`influencer:${id}`);
    const prisma = await getPrisma();

    let influencer = null;

    try {
      influencer = await prisma.influencer.findUnique({
        where: { id },
        select: {
          id: true,
          userId: true,
        },
      });

      if (!influencer && cachedInfluencer) {
        influencer = cachedInfluencer;
      }

      if (!influencer) {
        return sendError(event, createError({ statusCode: 404, statusMessage: 'Influenceuse non trouvée' }));
      }

      await prisma.generatedContent.deleteMany({
        where: { influencerId: id },
      });

      await prisma.influencer.delete({
        where: { id },
      });
    } catch (err) {
      if (!isTransientDbError(err)) {
        throw err;
      }

      influencer = cachedInfluencer;

      if (!influencer) {
        return sendError(event, createError({ statusCode: 404, statusMessage: 'Influenceuse non trouvée' }));
      }
    }

    if (influencer?.userId) {
      const storeKey = `influencers:${influencer.userId}`;
      const cachedList = await store.getItem(storeKey);
      if (Array.isArray(cachedList)) {
        await store.setItem(
          storeKey,
          cachedList.filter((item) => item?.id !== id),
        );
      }
    }

    await store.removeItem(`influencer:${id}`);

    return { success: true, id };
  } catch (err) {
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