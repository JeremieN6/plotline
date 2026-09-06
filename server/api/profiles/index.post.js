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

function getMissingColumnFromError(err) {
  const fromMeta = String(err?.meta?.column || '').trim();
  if (fromMeta) return fromMeta;

  const message = String(err?.message || '');
  const match = message.match(/column\s+["'`]?([^"'`\s.]+)["'`]?\s+does not exist/i);
  return match?.[1] ? String(match[1]).trim() : '';
}

function buildMissingColumnMessage(body, err) {
  const missingColumn = getMissingColumnFromError(err).toLowerCase();

  if (missingColumn.includes('silhouette')) {
    return 'La colonne silhouette est absente de la base active. Appliquez la migration silhouette sur Neon puis reessayez.';
  }

  if (missingColumn.includes('gender')) {
    return 'La colonne gender est absente de la base active. Appliquez la migration add_persona_gender sur Neon puis reessayez.';
  }

  if (missingColumn.includes('bodyprompt')) {
    return 'La colonne bodyPrompt est absente de la base active. Appliquez la migration add_body_prompt sur Neon puis reessayez.';
  }

  if (missingColumn.includes('identityprofile')) {
    return 'La colonne identityProfile est absente de la base active. Appliquez la migration add_identity_profile sur Neon puis reessayez.';
  }

  if (missingColumn.includes('plan') || missingColumn.includes('password') || missingColumn.includes('email')) {
    return `Le schema de la table User semble incomplet (${missingColumn}). Appliquez les migrations auth sur la base connectee (DATABASE_URL) puis reessayez.`;
  }

  if (typeof body?.bodyPrompt === 'string') {
    return 'La colonne bodyPrompt est absente de la base active. Appliquez la migration add_body_prompt sur Neon puis reessayez.';
  }

  if (typeof body?.silhouette === 'string') {
    return 'La colonne silhouette est absente de la base active. Appliquez la migration silhouette sur Neon puis reessayez.';
  }

  if (typeof body?.gender === 'string') {
    return 'La colonne gender est absente de la base active. Appliquez la migration add_persona_gender sur Neon puis reessayez.';
  }

  if (missingColumn) {
    return `Le schema Prisma local ne correspond pas a la base active (colonne manquante: ${missingColumn}). Appliquez les migrations manquantes sur Neon puis reessayez.`;
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

const MODERN_INFLUENCER_SELECT = {
  ...LEGACY_INFLUENCER_SELECT,
  profileType: true,
  brandId: true,
  silhouette: true,
  gender: true,
  bodyPrompt: true,
  hairPrompt: true,
  identityProfile: true,
};

const PROFILE_TYPES = new Set(['PERSONA', 'BRAND', 'ACTIVITY']);

function normalizeProfileType(value) {
  const normalized = String(value || '').trim().toUpperCase();
  return PROFILE_TYPES.has(normalized) ? normalized : '';
}

async function createInfluencerCompatible(prisma, data) {
  try {
    return await prisma.profile.create({
      data,
      select: {
        ...MODERN_INFLUENCER_SELECT,
        description: true,
        website: true,
        targetAudience: true,
      },
    });
  } catch (err) {
    if (!isPrismaSchemaDriftError(err)) {
      throw err;
    }

    const { profileType, brandId, ...restWithLegacyFields } = data;
    try {
      return await prisma.profile.create({
        data: restWithLegacyFields,
        select: LEGACY_INFLUENCER_SELECT,
      });
    } catch (innerErr) {
      if (!isPrismaSchemaDriftError(innerErr)) {
        throw innerErr;
      }
    }

    const hasDetailFields = 'description' in data || 'website' in data || 'targetAudience' in data;
    if (hasDetailFields) {
      const { description, website, targetAudience, profileType, brandId, ...rest } = data;
      try {
        return await prisma.profile.create({
          data: rest,
          select: LEGACY_INFLUENCER_SELECT,
        });
      } catch (innerErr) {
        if (!isPrismaSchemaDriftError(innerErr)) {
          throw innerErr;
        }
      }
    }

    return await prisma.profile.create({
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
    silhouette: 'VOLUPTUOUS',
    gender: 'FEMALE',
    faceRefPath: null,
    bodyPrompt: null,
    hairPrompt: null,
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
    const authModule = await import('../../utils/auth.js');
    const user = await authModule.requireAuthUser(event);
    const body = await readBody(event);
    const required = ['name', 'niche', 'style'];

    for (const field of required) {
      if (!body?.[field]) {
        return sendError(event, createError({ statusCode: 400, statusMessage: `Champ manquant: ${field}` }));
      }
    }

    const userId = String(user.id).trim();
    const userEmail = String(user.email || `${userId}@plotline.local`).toLowerCase();
    const { normalizeNicheValue } = await getNicheUtils();
    const normalizedNiche = normalizeNicheValue(body.niche);
    const allowedSilhouettes = new Set(['SLIM', 'ATHLETIC', 'CURVY', 'VOLUPTUOUS', 'MUSCULAR', 'STOCKY']);
    const resolvedSilhouette = String(body?.silhouette || 'VOLUPTUOUS').trim().toUpperCase();
    const allowedGenders = new Set(['FEMALE', 'MALE']);
    const resolvedGender = String(body?.gender || 'FEMALE').trim().toUpperCase();
    const resolvedProfileType = normalizeProfileType(body?.profileType);
    const requestedBrandId = String(body?.brandId || '').trim();
    const store = useStorage('data');
    const storeKey = `influencers:${userId}`;

    if (!normalizedNiche) {
      return sendError(event, createError({ statusCode: 400, statusMessage: 'Champ manquant: niche' }));
    }

    if (!allowedSilhouettes.has(resolvedSilhouette)) {
      return sendError(event, createError({ statusCode: 400, statusMessage: 'silhouette invalide' }));
    }

    if (!allowedGenders.has(resolvedGender)) {
      return sendError(event, createError({ statusCode: 400, statusMessage: 'gender invalide' }));
    }

    if (requestedBrandId && resolvedProfileType !== 'PERSONA') {
      return sendError(event, createError({ statusCode: 400, statusMessage: 'brandId ne peut être utilisé que pour un persona' }));
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
          profileType: resolvedProfileType || undefined,
          brandId: requestedBrandId || undefined,
          silhouette: resolvedSilhouette,
          gender: resolvedGender,
          bodyPrompt: typeof body?.bodyPrompt === 'string' ? body.bodyPrompt.trim() || null : null,
          description: typeof body?.description === 'string' ? body.description.trim() || null : null,
          website: typeof body?.website === 'string' ? body.website.trim() || null : null,
          targetAudience: typeof body?.targetAudience === 'string' ? body.targetAudience.trim() || null : null,
        }
      }.data);
    } catch (err) {
      if (isPrismaSchemaDriftError(err)) {
        return sendError(event, createError({
          statusCode: 409,
          statusMessage: buildMissingColumnMessage(body, err),
          data: {
            name: err?.name,
            code: err?.code,
            message: err?.message,
            meta: err?.meta,
          },
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
