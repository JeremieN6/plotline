import { createGeneratedContentRecord } from './video.post.js';
import { getOrCreateDefaultProfile } from '../../utils/defaultProfile.js';
import { runFacelessVideoJob } from '../../utils/facelessVideoJob.js';
import { normalizeFacelessDuration } from '../../utils/facelessPlanGenerator.js';
import { resolveElevenLabsApiKey } from '../../utils/elevenLabsTts.js';
import { DEFAULT_FACELESS_VOICE_ID, findFacelessVoice } from '../../data/facelessCatalog.js';
import { FACELESS_PERSONA_SELECT } from '../../utils/facelessContent.js';

const MAX_IDEA_LENGTH = 2000;

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

// Video faceless : montage code (HTML capture image par image), voix
// ElevenLabs, aucun modele de generation video. Reponse immediate en
// "processing", suivi par /api/content/:id/status comme les autres videos.
export default defineEventHandler(async (event) => {
  const prisma = await getPrisma();
  const authModule = await import('../../utils/auth.js');
  const user = await authModule.requireAuthUser(event);
  const body = await readBody(event);

  const idea = String(body?.idea || '').trim().slice(0, MAX_IDEA_LENGTH);
  const profileId = String(body?.profileId || '').trim();
  const voiceId = String(body?.voiceId || '').trim() || DEFAULT_FACELESS_VOICE_ID;
  const targetSeconds = normalizeFacelessDuration(body?.durationSeconds);
  const captions = body?.captions !== false;

  if (!idea) {
    return sendError(event, createError({ statusCode: 400, statusMessage: 'idee requise' }));
  }
  if (!findFacelessVoice(voiceId)) {
    return sendError(event, createError({ statusCode: 400, statusMessage: 'Voix inconnue' }));
  }
  if (!resolveElevenLabsApiKey()) {
    return sendError(event, createError({ statusCode: 503, statusMessage: 'ELEVEN_LABS_API_KEY non configuree' }));
  }

  // La persona est facultative : elle donne le ton et range la video chez elle.
  let persona = null;
  if (profileId) {
    persona = await prisma.profile.findFirst({ where: { id: profileId, userId: user.id }, select: FACELESS_PERSONA_SELECT });
    if (!persona) {
      return sendError(event, createError({ statusCode: 404, statusMessage: 'Profil introuvable' }));
    }
  }
  const ownerId = persona?.id || (await getOrCreateDefaultProfile(prisma, user.id)).id;

  const generatedContent = await createGeneratedContentRecord(prisma, {
    influencerId: ownerId,
    brandId: null,
    ambassadorId: null,
    campaignId: null,
    platform: 'INSTAGRAM',
    format: 'REEL',
    status: 'PROCESSING',
    prompt: idea,
  });

  return runFacelessVideoJob({
    prisma,
    contentId: generatedContent.id,
    idea,
    persona,
    targetSeconds,
    captions,
    voiceId,
  });
});
