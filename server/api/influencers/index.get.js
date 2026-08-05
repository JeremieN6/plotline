let prismaClient;

function normalizeProfileType(profileType, faceRefPath) {
  const normalized = String(profileType || '').trim().toUpperCase();
  if (normalized === 'PERSONA' || normalized === 'BRAND' || normalized === 'ACTIVITY') {
    return normalized;
  }

  if (String(faceRefPath || '').trim()) {
    return 'PERSONA';
  }

  return 'BRAND';
}

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
  if (!influencer) return influencer;

  return {
    id: influencer.id,
    userId: influencer.userId,
    name: influencer.name,
    niche: influencer.niche,
    style: influencer.style,
    profileType: normalizeProfileType(influencer.profileType, influencer.faceRefPath),
    silhouette: String(influencer?.silhouette || 'VOLUPTUOUS'),
    brandId: influencer.brandId || null,
    faceRefPath: influencer.faceRefPath,
    bodyPrompt: typeof influencer?.bodyPrompt === 'string' ? influencer.bodyPrompt : null,
    hairPrompt: typeof influencer?.hairPrompt === 'string' ? influencer.hairPrompt : null,
    identityProfile: String(influencer?.identityProfile || 'default'),
    instagramAccountId: influencer.instagramAccountId,
    tiktokEnabled: Boolean(influencer.tiktokEnabled),
    calendarStep: influencer.calendarStep,
    createdAt: influencer.createdAt,
  };
}

async function findInfluencersCompatible(prisma, userId) {
  try {
    const rows = await prisma.profile.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        userId: true,
        name: true,
        niche: true,
        style: true,
        profileType: true,
        brandId: true,
        silhouette: true,
        faceRefPath: true,
        bodyPrompt: true,
        hairPrompt: true,
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

    const legacyRows = await prisma.profile.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        userId: true,
        name: true,
        niche: true,
        style: true,
        faceRefPath: true,
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
    const authModule = await import('../../utils/auth.js');
    const user = await authModule.requireAuthUser(event);
    const userId = user.id;
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
      const authModule = await import('../../utils/auth.js');
      const user = await authModule.requireAuthUser(event);
      const userId = user.id;
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
