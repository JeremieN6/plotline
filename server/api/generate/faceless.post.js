import { createGeneratedContentRecord } from './video.post.js';
import { getOrCreateDefaultProfile } from '../../utils/defaultProfile.js';
import { runFacelessVideoJob } from '../../utils/facelessVideoJob.js';
import { normalizeFacelessDuration } from '../../utils/facelessPlanGenerator.js';
import { resolveElevenLabsApiKey } from '../../utils/elevenLabsTts.js';
import { findFacelessVoice } from '../../data/facelessCatalog.js';
import { defaultFacelessStyle } from '../../utils/facelessStyle.js';
import { loadPersonaStyle } from '../../utils/facelessStyleStore.js';

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
// La persona (facultative) apporte son ton ET sa DA (style, avatar, voix par defaut).
export default defineEventHandler(async (event) => {
  const prisma = await getPrisma();
  const authModule = await import('../../utils/auth.js');
  const user = await authModule.requireAuthUser(event);
  const body = await readBody(event);

  const idea = String(body?.idea || '').trim().slice(0, MAX_IDEA_LENGTH);
  const profileId = String(body?.profileId || '').trim();
  const targetSeconds = normalizeFacelessDuration(body?.durationSeconds);

  if (!idea) {
    return sendError(event, createError({ statusCode: 400, statusMessage: 'idee requise' }));
  }
  if (!resolveElevenLabsApiKey()) {
    return sendError(event, createError({ statusCode: 503, statusMessage: 'ELEVEN_LABS_API_KEY non configuree' }));
  }

  let persona = null;
  let style = defaultFacelessStyle();
  if (profileId) {
    const loaded = await loadPersonaStyle(prisma, profileId, user.id);
    if (!loaded) {
      return sendError(event, createError({ statusCode: 404, statusMessage: 'Profil introuvable' }));
    }
    persona = loaded.persona;
    style = loaded.style;
  }

  // Voix et sous-titres : ce que dit le formulaire, sinon les reglages de la DA.
  const voiceId = String(body?.voiceId || '').trim() || style.voiceId;
  if (!findFacelessVoice(voiceId)) {
    return sendError(event, createError({ statusCode: 400, statusMessage: 'Voix inconnue' }));
  }
  const captions = body?.captions === undefined ? style.captions.enabled : body.captions !== false;

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
    style,
  });
});
