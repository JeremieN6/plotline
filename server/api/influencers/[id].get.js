let prismaClient;

async function getMediaStorage() {
  return import('../../utils/mediaStorage.js');
}

function isAbsoluteHttpUrl(value) {
  return /^https?:\/\//i.test(String(value || '').trim());
}

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
    const prisma = await getPrisma();
    const { toMediaUrl } = await getMediaStorage();
    const store = useStorage('data');
    const id = event.context?.params?.id;
    if (!id) {
      return sendError(event, createError({ statusCode: 400, statusMessage: 'Paramètre id requis' }));
    }

    let influencer;

    try {
      influencer = await prisma.influencer.findUnique({
        where: { id },
        select: {
          id: true,
          userId: true,
          name: true,
          niche: true,
          style: true,
          faceRefPath: true,
          bodyRefPath: true,
          instagramAccountId: true,
          instagramAccessToken: true,
          tiktokEnabled: true,
          calendarStep: true,
          createdAt: true
        }
      });
    } catch (err) {
      if (!isTransientDbError(err)) {
        throw err;
      }
      influencer = await store.getItem(`influencer:${id}`);
    }

    if (!influencer) {
      const storedInfluencer = await store.getItem(`influencer:${id}`);
      if (storedInfluencer) {
        return storedInfluencer;
      }
      return sendError(event, createError({ statusCode: 404, statusMessage: 'Influencer non trouvé' }));
    }

    await store.setItem(`influencer:${id}`, influencer);

    const faceRefPath = String(influencer?.faceRefPath || '').trim();
    const faceRefFilename = faceRefPath.split(/[\\/]/).pop();
    const faceRefUrl = !faceRefPath
      ? null
      : isAbsoluteHttpUrl(faceRefPath)
        ? faceRefPath
        : toMediaUrl('face-refs', faceRefFilename);

    return {
      ...influencer,
      faceRefUrl,
    };
  } catch (err) {
    return sendError(event, createError({ statusCode: 500, statusMessage: 'Erreur serveur', data: err }));
  }
});
