let prismaClient;

function isTransientDbError(err) {
  const code = err?.code;
  return code === 'ETIMEDOUT' || code === 'P1001' || code === 'P1002';
}

function isMissingColumnError(err) {
  if (err?.code === 'P2022') return true;
  const message = String(err?.message || '').toLowerCase();
  return message.includes('column') && message.includes('does not exist');
}

function isUnknownFieldSelectError(err) {
  const message = String(err?.message || '').toLowerCase();
  return message.includes('unknown field') && message.includes('for select statement on model');
}

function normalizeInfluencer(influencer) {
  return {
    ...influencer,
    bodyPrompt: typeof influencer?.bodyPrompt === 'string' ? influencer.bodyPrompt : null,
    hairPrompt: typeof influencer?.hairPrompt === 'string' ? influencer.hairPrompt : null,
    hairAutoPrompt: typeof influencer?.hairAutoPrompt === 'string' ? influencer.hairAutoPrompt : null,
    hairLocked: typeof influencer?.hairLocked === 'boolean' ? influencer.hairLocked : true,
    identityProfile: String(influencer?.identityProfile || 'default'),
  };
}

async function findInfluencersCompatible(prisma, userId) {
  try {
    const rows = await prisma.influencer.findMany({
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
        bodyPrompt: true,
        hairPrompt: true,
        hairAutoPrompt: true,
        hairLocked: true,
        identityProfile: true,
        instagramAccountId: true,
        tiktokEnabled: true,
        calendarStep: true,
        createdAt: true,
      },
    });

    return rows.map(normalizeInfluencer);
  } catch (err) {
    if (!isMissingColumnError(err) && !isUnknownFieldSelectError(err)) {
      throw err;
    }

    const legacyRows = await prisma.influencer.findMany({
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
        createdAt: true,
      },
    });

    return legacyRows.map(normalizeInfluencer);
  }
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
        influencers = await findInfluencersCompatible(prisma, userId);
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
