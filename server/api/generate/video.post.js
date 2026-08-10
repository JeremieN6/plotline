import { randomUUID } from 'node:crypto';

import { resolveVideoModelOrThrow, runVideoGenerationJob } from '../../utils/videoGeneration.js';

let prismaClient;

async function getPrisma() {
  if (prismaClient) return prismaClient;

  const module = await import('../../utils/prisma.js');
  prismaClient = module?.prisma || module?.default?.prisma;

  if (!prismaClient) {
    throw new Error('Unable to resolve prisma client from server/utils/prisma.js');
  }

  return prismaClient;
}

function normalizeErrorMessage(error) {
  if (!error) return 'Unknown error';
  if (typeof error === 'string') return error;

  const statusMessage = String(error?.statusMessage || '').trim();
  if (statusMessage) return statusMessage;

  const message = String(error?.message || '').trim();
  if (message) return message;

  try {
    return JSON.stringify(error);
  } catch {
    return 'Unknown error';
  }
}

function isMissingCampaignColumnError(error) {
  const message = normalizeErrorMessage(error).toLowerCase();
  return message.includes('campaignid') && message.includes('does not exist');
}

function isPrismaSchemaDriftError(error) {
  const message = normalizeErrorMessage(error).toLowerCase();
  return error?.code === 'P2022'
    || (message.includes('column') && message.includes('does not exist'))
    || message.includes('unknown argument')
    || message.includes('unknown field');
}

export async function createGeneratedContentRecord(prisma, data) {
  try {
    return await prisma.generatedContent.create({
      data,
      select: { id: true },
    });
  } catch (error) {
    if (isPrismaSchemaDriftError(error) && 'prompt' in data) {
      const { prompt, ...rest } = data;
      return await createGeneratedContentRecord(prisma, rest);
    }

    if (!isMissingCampaignColumnError(error)) {
      throw error;
    }

    const fallbackId = randomUUID().replace(/-/g, '');
    const rows = await prisma.$queryRaw`
      INSERT INTO "GeneratedContent" ("id", "influencerId", "brandId", "ambassadorId", "platform", "format", "status")
      VALUES (${fallbackId}, ${data.influencerId}, ${data.brandId}, ${data.ambassadorId}, ${data.platform}, ${data.format}, ${data.status})
      RETURNING "id"
    `;

    return {
      id: String(rows?.[0]?.id || fallbackId),
    };
  }
}

export default defineEventHandler(async (event) => {
  const prisma = await getPrisma();
  const authModule = await import('../../utils/auth.js');
  const user = await authModule.requireAuthUser(event);
  const body = await readBody(event);

  const prompt = String(body?.prompt || '').trim();
  const influencerId = String(body?.influencerId || '').trim();
  const ambassadorId = String(body?.ambassadorId || '').trim();
  const campaignId = String(body?.campaignId || '').trim();
  const withFaceRef = body?.withFaceRef === true;

  if (!prompt) {
    return sendError(event, createError({ statusCode: 400, statusMessage: 'prompt requis' }));
  }

  if (!influencerId) {
    return sendError(event, createError({ statusCode: 400, statusMessage: 'influencerId requis' }));
  }

  if (campaignId) {
    const campaign = await prisma.campaign.findFirst({
      where: {
        id: campaignId,
        userId: user.id,
      },
      select: { id: true },
    });

    if (!campaign) {
      return sendError(event, createError({ statusCode: 404, statusMessage: 'Campagne introuvable' }));
    }
  }

  const ownerProfile = await prisma.profile.findFirst({
    where: {
      id: influencerId,
      userId: user.id,
    },
    select: {
      id: true,
    },
  });

  if (!ownerProfile) {
    return sendError(event, createError({ statusCode: 404, statusMessage: 'Profil introuvable' }));
  }

  const requestedAmbassadorId = withFaceRef ? (ambassadorId || influencerId) : '';
  let influencer = ownerProfile;

  if (requestedAmbassadorId) {
    const ambassador = await prisma.profile.findFirst({
      where: {
        id: requestedAmbassadorId,
        userId: user.id,
      },
      select: {
        id: true,
        faceRefPath: true,
      },
    });

    if (!ambassador) {
      return sendError(event, createError({ statusCode: 404, statusMessage: 'Ambassadrice introuvable' }));
    }

    influencer = ambassador;
  } else {
    influencer = await prisma.profile.findFirst({
      where: {
        id: influencerId,
        userId: user.id,
      },
      select: {
        id: true,
      faceRefPath: true,
    },
  });
  }

  if (!influencer) {
    return sendError(event, createError({ statusCode: 404, statusMessage: 'Profil introuvable' }));
  }

  const runtimeConfig = useRuntimeConfig(event);

  // Le modele choisi dans le Studio n etait pris en compte que sur "Modifier":
  // une premiere generation retombait toujours sur la detection par mots-cles,
  // donc choisir Seedance ou Kling n avait aucun effet.
  const model = resolveVideoModelOrThrow({
    prompt,
    withFaceRef,
    influencer,
    runtimeConfig,
    forcedModel: String(body?.model || '').trim(),
  });

  const generatedContentData = {
    influencerId: influencer.id,
    brandId: ownerProfile.id,
    ambassadorId: withFaceRef ? influencer.id : null,
    campaignId: campaignId || null,
    platform: 'TIKTOK',
    format: 'REEL',
    status: 'PROCESSING',
    prompt: prompt || null,
  };

  const generatedContent = await createGeneratedContentRecord(prisma, generatedContentData);
  const contentId = generatedContent.id;

  try {
    return await runVideoGenerationJob({ prisma, runtimeConfig, contentId, prompt, model, influencerId, withFaceRef, influencer });
  } catch (error) {
    const errorMessage = error?.statusMessage || error?.message || 'Génération vidéo impossible';
    await prisma.generatedContent.update({
      where: { id: contentId },
      data: { status: 'FAILED', errorMessage },
    }).catch(() => {});

    throw error;
  }
});
