import { createGeneratedContentRecord } from '../generate/video.post.js';
import { runFacelessVideoJob } from '../../utils/facelessVideoJob.js';
import { parseExternalFacelessBody } from '../../utils/facelessExternal.js';
import { resolveElevenLabsApiKey } from '../../utils/elevenLabsTts.js';
import { loadPersonaStyle } from '../../utils/facelessStyleStore.js';
import { readyIllustrations } from '../../utils/facelessStyle.js';
import { resolveOwnerCloneVoice } from '../../utils/facelessVoiceChoice.js';

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

// Endpoint service-a-service (pas de session) : home.sassify.fr envoie le texte d un
// article, Plotline en fait une video FACELESS avec la persona choisie (sa DA, son avatar,
// sa voix par defaut, sa personnalite). Meme cle partagee que /api/external/video-jobs ;
// le suivi se fait avec GET /api/external/video-jobs/:id/status.
// Aucune image payante : seules les illustrations deja rangees dans le dossier de la persona servent.
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

  const parsed = parseExternalFacelessBody(await readBody(event));
  if (parsed.error) {
    return sendError(event, createError({ statusCode: 400, statusMessage: parsed.error }));
  }
  const { profileId, sourceText, idea, targetSeconds, slug, sourceProject } = parsed.value;

  // Refus AVANT toute creation de contenu : sans voix de synthese, la video ne peut pas se faire.
  if (!resolveElevenLabsApiKey()) {
    return sendError(event, createError({ statusCode: 503, statusMessage: 'ELEVEN_LABS_API_KEY non configuree' }));
  }

  const prisma = await getPrisma();
  const profile = await prisma.profile.findUnique({ where: { id: profileId }, select: { id: true, userId: true } });
  if (!profile) {
    return sendError(event, createError({ statusCode: 404, statusMessage: 'Profil introuvable' }));
  }

  const loaded = await loadPersonaStyle(prisma, profile.id, profile.userId);
  if (!loaded) {
    return sendError(event, createError({ statusCode: 404, statusMessage: 'Profil introuvable' }));
  }
  const { persona, style } = loaded;

  // Voix clonee du proprietaire par defaut ; repli sur la voix de la DA si le compte n est pas
  // proprietaire ou si aucune voix clonee n existe.
  const owner = await prisma.user.findUnique({ where: { id: profile.userId }, select: { email: true } });
  const cloneVoice = await resolveOwnerCloneVoice({ ownerEmail: owner?.email });

  const generatedContent = await createGeneratedContentRecord(prisma, {
    influencerId: persona.id,
    brandId: null,
    ambassadorId: null,
    campaignId: null,
    platform: 'INSTAGRAM',
    format: 'REEL',
    status: 'PROCESSING',
    prompt: idea || sourceText.slice(0, 200),
  });

  console.log(`[external/faceless-jobs] contentId=${generatedContent.id} profileId=${profile.id} sourceProject=${sourceProject || 'inconnu'} slug=${slug || 'aucun'} duree=${targetSeconds}s voix=${cloneVoice ? 'clonee' : 'synthese'}`);

  return runFacelessVideoJob({
    prisma,
    contentId: generatedContent.id,
    idea,
    sourceText,
    persona,
    targetSeconds,
    captions: style.captions.enabled,
    voiceId: cloneVoice?.voiceId || style.voiceId,
    voiceMode: cloneVoice?.voiceMode || 'synth',
    stability: cloneVoice?.stability,
    style,
    userId: profile.userId,
    illustrations: readyIllustrations(style),
    maxNew: 0,
  });
});
