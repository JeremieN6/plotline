import { createGeneratedContentRecord } from '../generate/video.post.js';
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

// Endpoint service-a-service (pas de session utilisateur) : home.sassify.fr
// pousse un job video (persona + decor + script parle) vers le pipeline
// existant. Authentifie par cle partagee, jamais par cookie de session.
export default defineEventHandler(async (event) => {
  const runtimeConfig = useRuntimeConfig(event);
  const expectedApiKey = String(runtimeConfig.externalVideoJobsApiKey || '').trim();

  if (!expectedApiKey) {
    return sendError(event, createError({ statusCode: 503, statusMessage: 'EXTERNAL_VIDEO_JOBS_API_KEY non configuree' }));
  }

  const providedApiKey = String(getHeader(event, 'x-api-key') || '').trim();
  if (!providedApiKey || providedApiKey !== expectedApiKey) {
    return sendError(event, createError({ statusCode: 401, statusMessage: 'Cle API invalide' }));
  }

  const prisma = await getPrisma();
  const body = await readBody(event);

  const influencerId = String(body?.influencerId || '').trim();
  const decorPrompt = String(body?.decorPrompt || '').trim();
  const scriptText = String(body?.scriptText || '').trim();
  const hookVideo = String(body?.hookVideo || '').trim();
  const slug = String(body?.slug || '').trim();
  const sourceProject = String(body?.sourceProject || '').trim();

  if (!influencerId) {
    return sendError(event, createError({ statusCode: 400, statusMessage: 'influencerId requis' }));
  }

  if (!scriptText) {
    return sendError(event, createError({ statusCode: 400, statusMessage: 'scriptText requis' }));
  }

  const influencer = await prisma.profile.findUnique({
    where: { id: influencerId },
    select: { id: true, faceRefPath: true },
  });

  if (!influencer) {
    return sendError(event, createError({ statusCode: 404, statusMessage: 'Profil introuvable' }));
  }

  if (!String(influencer.faceRefPath || '').trim()) {
    return sendError(event, createError({ statusCode: 409, statusMessage: 'Aucune face ref disponible pour ce profil' }));
  }

  const prompt = [decorPrompt, scriptText].filter(Boolean).join('. ');

  let model;
  try {
    model = resolveVideoModelOrThrow({
      prompt,
      withFaceRef: true,
      influencer,
      runtimeConfig,
      forcedModel: 'omniflash',
    });
  } catch (error) {
    return sendError(event, error);
  }

  const generatedContentData = {
    influencerId: influencer.id,
    brandId: null,
    ambassadorId: influencer.id,
    campaignId: null,
    platform: 'TIKTOK',
    format: 'REEL',
    status: 'PROCESSING',
    prompt: prompt || null,
  };

  const generatedContent = await createGeneratedContentRecord(prisma, generatedContentData);
  const contentId = generatedContent.id;

  console.log(`[external/video-jobs] contentId=${contentId} influencerId=${influencerId} sourceProject=${sourceProject || 'inconnu'} slug=${slug || 'aucun'} model=${model}`);

  try {
    const result = await runVideoGenerationJob({
      prisma,
      runtimeConfig,
      contentId,
      prompt,
      model,
      withFaceRef: true,
      influencer,
      hookVideo,
    });

    return { contentId, ...result };
  } catch (error) {
    const errorMessage = error?.statusMessage || error?.message || 'Generation video impossible';
    await prisma.generatedContent.update({
      where: { id: contentId },
      data: { status: 'FAILED', errorMessage },
    }).catch(() => {});

    throw error;
  }
});
