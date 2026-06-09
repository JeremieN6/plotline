let prismaClient;
let nicheUtils;

function isTransientDbError(err) {
  const code = err?.code;
  return code === 'ETIMEDOUT' || code === 'P1001' || code === 'P1002';
}

function isPrismaSchemaDriftError(err) {
  const message = String(err?.message || '').toLowerCase();
  return err?.code === 'P2022'
    || (message.includes('column') && message.includes('does not exist'))
    || message.includes('unknown arg')
    || message.includes('unknown argument')
    || message.includes('unknown field');
}

function buildMissingColumnMessage(body) {
  if (typeof body?.bodyPrompt === 'string') {
    return 'La colonne bodyPrompt est absente de la base active. Appliquez la migration add_body_prompt sur Neon puis reessayez.';
  }

  return 'Le schema Prisma local ne correspond pas a la base active. Appliquez les migrations manquantes sur Neon puis reessayez.';
}

const LEGACY_INFLUENCER_SELECT = {
  id: true,
  userId: true,
  name: true,
  niche: true,
  style: true,
  faceRefPath: true,
  instagramAccountId: true,
  instagramAccessToken: true,
  tiktokEnabled: true,
  calendarStep: true,
  createdAt: true,
};

async function createInfluencerCompatible(prisma, data) {
  try {
    return await prisma.influencer.create({
      data,
      select: {
        ...LEGACY_INFLUENCER_SELECT,
        bodyPrompt: true,
        hairPrompt: true,
        hairAutoPrompt: true,
        hairLocked: true,
        identityProfile: true,
      },
    });
  } catch (err) {
    if (!isPrismaSchemaDriftError(err)) {
      throw err;
    }

    return await prisma.influencer.create({
      data: {
        userId: data.userId,
        name: data.name,
        niche: data.niche,
        style: data.style,
      },
      select: LEGACY_INFLUENCER_SELECT,
    });
  }
}

function createOfflineInfluencer({ userId, name, niche, style }) {
  return {
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    userId,
    name,
    niche,
    style,
    faceRefPath: null,
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

      influencer = await createInfluencerCompatible(prisma, {
        data: {
          userId,
          name: body.name,
          niche: normalizedNiche,
          style: body.style,
          bodyPrompt: typeof body?.bodyPrompt === 'string' ? body.bodyPrompt.trim() || null : null,
        }
      }.data);
    } catch (err) {
      if (isPrismaSchemaDriftError(err)) {
        return sendError(event, createError({
          statusCode: 409,
          statusMessage: buildMissingColumnMessage(body),
        }));
      }

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
