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
    silhouette: String(influencer?.silhouette || 'VOLUPTUOUS'),
    faceRefPath: influencer.faceRefPath,
    bodyPrompt: typeof influencer?.bodyPrompt === 'string' ? influencer.bodyPrompt : null,
    hairPrompt: typeof influencer?.hairPrompt === 'string' ? influencer.hairPrompt : null,
    identityProfile: String(influencer?.identityProfile || 'default'),
    instagramAccountId: influencer.instagramAccountId,
    instagramAccessToken: influencer.instagramAccessToken,
    tiktokEnabled: Boolean(influencer.tiktokEnabled),
    calendarStep: influencer.calendarStep,
    createdAt: influencer.createdAt,
    brandId: influencer.brandId || null,
    brandName: String(influencer?.brand?.name || influencer?.brandName || '').trim(),
  };
}

async function findInfluencerCompatible(prisma, id) {
  try {
    return await prisma.profile.findUnique({
      where: { id },
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
        instagramAccessToken: true,
        tiktokEnabled: true,
        calendarStep: true,
        createdAt: true,
        brand: {
          select: {
            id: true,
            name: true,
            profileType: true,
          },
        },
      },
    });
  } catch (err) {
    if (!isMissingColumnError(err) && !isUnknownFieldSelectError(err)) {
      throw err;
    }

    return prisma.profile.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        name: true,
        niche: true,
        style: true,
        brandId: true,
        faceRefPath: true,
        instagramAccountId: true,
        instagramAccessToken: true,
        tiktokEnabled: true,
        calendarStep: true,
        createdAt: true,
      },
    });
  }
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
      influencer = await findInfluencerCompatible(prisma, id);
    } catch (err) {
      if (!isTransientDbError(err)) {
        throw err;
      }
      influencer = await store.getItem(`influencer:${id}`);
    }

    influencer = normalizeInfluencer(influencer);

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
