let prismaClient;
let nicheUtils;

function isTransientDbError(err) {
  const code = err?.code;
  return code === 'ETIMEDOUT' || code === 'P1001' || code === 'P1002';
}

function createOfflineInfluencer({ userId, name, niche, style }) {
  return {
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    userId,
    name,
    niche,
    style,
    faceRefPath: null,
    bodyRefPath: null,
    bodyPrompt: null,
    hairPrompt: null,
    hairAutoPrompt: null,
    hairLocked: true,
    identityProfile: 'default',
    instagramAccountId: null,
    instagramAccessToken: null,
    tiktokEnabled: false,
    calendarStep: 1,
    createdAt: new Date().toISOString(),
    offline: true,
  };
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

async function getNicheUtils() {
  if (nicheUtils) return nicheUtils;
  nicheUtils = await import('../../utils/niche.js');
  return nicheUtils;
}

module.exports = defineEventHandler(async (event) => {
  try {
    const prisma = await getPrisma();
    const body = await readBody(event);
    const required = ['userId', 'name', 'niche', 'style'];

    for (const field of required) {
      if (!body?.[field]) {
        return sendError(event, createError({ statusCode: 400, statusMessage: `Champ manquant: ${field}` }));
      }
    }

    const userId = String(body.userId).trim();
    const userEmail = `${userId}@plotline.local`;
    const { normalizeNicheValue } = await getNicheUtils();
    const normalizedNiche = normalizeNicheValue(body.niche);
    const store = useStorage('data');
    const storeKey = `influencers:${userId}`;

    if (!normalizedNiche) {
      return sendError(event, createError({ statusCode: 400, statusMessage: 'Champ manquant: niche' }));
    }

    let influencer;

    try {
      await prisma.user.upsert({
        where: { id: userId },
        update: {},
        create: {
          id: userId,
          email: userEmail
        }
      });

      influencer = await prisma.influencer.create({
        data: {
          userId,
          name: body.name,
          niche: normalizedNiche,
          style: body.style,
          bodyPrompt: typeof body?.bodyPrompt === 'string' ? body.bodyPrompt.trim() || null : null,
        }
      });
    } catch (err) {
      if (!isTransientDbError(err)) {
        throw err;
      }

      influencer = createOfflineInfluencer({
        userId,
        name: body.name,
        niche: normalizedNiche,
        style: body.style,
      });
    }

    const cached = await store.getItem(storeKey);
    const nextCached = Array.isArray(cached)
      ? [influencer, ...cached.filter((item) => item?.id !== influencer.id)]
      : [influencer];
    await store.setItem(storeKey, nextCached);
    await store.setItem(`influencer:${influencer.id}`, influencer);

    return influencer;
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
