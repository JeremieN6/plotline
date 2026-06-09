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

function buildMissingColumnMessage(payload) {
  if ('bodyPrompt' in payload) {
    return 'La colonne bodyPrompt est absente de la base active. Appliquez la migration add_body_prompt sur Neon puis reessayez.';
  }

  if ('hairPrompt' in payload || 'hairLocked' in payload) {
    return 'Les colonnes hairPrompt/hairLocked sont absentes de la base active. Appliquez la migration add_hair_profile_fields sur Neon puis reessayez.';
  }

  if ('identityProfile' in payload) {
    return 'La colonne identityProfile est absente de la base active. Appliquez la migration add_identity_profile sur Neon puis reessayez.';
  }

  return 'Le schema Prisma local ne correspond pas a la base active. Appliquez les migrations manquantes sur Neon puis reessayez.';
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

async function updateStoredInfluencer(id, payload) {
  const store = useStorage('data');
  const existing = await store.getItem(`influencer:${id}`);
  if (!existing) return null;

  const updated = { ...existing, ...payload };
  await store.setItem(`influencer:${id}`, updated);

  if (updated.userId) {
    const listKey = `influencers:${updated.userId}`;
    const cached = await store.getItem(listKey);
    if (Array.isArray(cached)) {
      await store.setItem(
        listKey,
        cached.map((item) => (item?.id === id ? updated : item)),
      );
    }
  }

  return updated;
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

async function updateInfluencerCompatible(prisma, id, data) {
  try {
    return await prisma.influencer.update({
      where: { id },
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

    return await prisma.influencer.update({
      where: { id },
      data,
      select: LEGACY_INFLUENCER_SELECT,
    });
  }
}

module.exports = defineEventHandler(async (event) => {
  try {
    const id = event.context?.params?.id;
    const body = await readBody(event);
    const { normalizeNicheValue } = await getNicheUtils();

    if (!id) {
      return sendError(event, createError({ statusCode: 400, statusMessage: 'Paramètre id requis' }));
    }

    const payload = {
      name: String(body?.name || '').trim(),
      niche: normalizeNicheValue(body?.niche || ''),
      style: String(body?.style || '').trim(),
    };

    if (typeof body?.identityProfile === 'string' && body.identityProfile.trim()) {
      const normalizedProfile = String(body.identityProfile).trim().toLowerCase();
      const allowedProfiles = new Set(['default', 'madison']);

      if (!allowedProfiles.has(normalizedProfile)) {
        return sendError(event, createError({ statusCode: 400, statusMessage: 'identityProfile invalide' }));
      }

      payload.identityProfile = normalizedProfile;
    }

    if (typeof body?.bodyPrompt === 'string') {
      const normalizedBodyPrompt = body.bodyPrompt.trim();
      payload.bodyPrompt = normalizedBodyPrompt ? normalizedBodyPrompt : null;
    }

    if (typeof body?.hairPrompt === 'string') {
      const normalizedHairPrompt = body.hairPrompt.trim();
      payload.hairPrompt = normalizedHairPrompt ? normalizedHairPrompt : null;
    }

    if (typeof body?.hairLocked === 'boolean') {
      payload.hairLocked = body.hairLocked;
    }

    if (!payload.name || !payload.niche || !payload.style) {
      return sendError(event, createError({ statusCode: 400, statusMessage: 'name, niche et style requis' }));
    }

    if (String(id).startsWith('local-')) {
      const updatedStored = await updateStoredInfluencer(id, payload);
      if (!updatedStored) {
        return sendError(event, createError({ statusCode: 404, statusMessage: 'Influenceuse non trouvée' }));
      }
      return updatedStored;
    }

    const prisma = await getPrisma();

    try {
      const influencer = await updateInfluencerCompatible(prisma, id, payload);

      await updateStoredInfluencer(id, influencer);
      return influencer;
    } catch (err) {
      if (isPrismaSchemaDriftError(err) && 'bodyPrompt' in payload) {
        return sendError(event, createError({
          statusCode: 409,
          statusMessage: buildMissingColumnMessage(payload),
        }));
      }

      if (isPrismaSchemaDriftError(err) && ('hairPrompt' in payload || 'hairLocked' in payload)) {
        const legacyPayload = { ...payload };
        delete legacyPayload.hairPrompt;
        delete legacyPayload.hairLocked;

        const influencer = await updateInfluencerCompatible(prisma, id, legacyPayload);

        await updateStoredInfluencer(id, influencer);
        return influencer;
      }

      if (isPrismaSchemaDriftError(err)) {
        const influencer = await updateInfluencerCompatible(prisma, id, {
          name: payload.name,
          niche: payload.niche,
          style: payload.style,
        });

        await updateStoredInfluencer(id, influencer);
        return influencer;
      }

      if (isPrismaSchemaDriftError(err) && 'identityProfile' in payload) {
        return sendError(event, createError({
          statusCode: 409,
          statusMessage: buildMissingColumnMessage(payload),
        }));
      }

      if (isTransientDbError(err)) {
        const updatedStored = await updateStoredInfluencer(id, payload);
        if (updatedStored) {
          return updatedStored;
        }
      }

      if (err?.code === 'P2025') {
        return sendError(event, createError({ statusCode: 404, statusMessage: 'Influenceuse non trouvée' }));
      }

      throw err;
    }
  } catch (err) {
    console.error('[influencer:patch] failure', {
      name: err?.name,
      code: err?.code,
      message: err?.message,
      stack: err?.stack,
    });

    return sendError(
      event,
      createError({
        statusCode: 500,
        statusMessage: `Erreur serveur: ${err?.message || 'erreur inconnue'}`,
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