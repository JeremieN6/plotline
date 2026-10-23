import { createGeneratedContentRecord } from './video.post.js';
import { getOrCreateDefaultProfile } from '../../utils/defaultProfile.js';
import { runFacelessVideoJob } from '../../utils/facelessVideoJob.js';
import { MAX_DIRECTION, MAX_SOURCE_TEXT, normalizeFacelessDuration, normalizeSourceText, sanitizeFacelessPlan } from '../../utils/facelessPlanGenerator.js';
import { resolveVoiceChoice } from '../../utils/facelessVoiceChoice.js';
import { resolveElevenLabsApiKey } from '../../utils/elevenLabsTts.js';
import { defaultFacelessStyle, pickStyleSlot } from '../../utils/facelessStyle.js';
import { loadPersonaStyle } from '../../utils/facelessStyleStore.js';
import { describeIllustrationCost } from '../../utils/facelessIllustration.js';
import { readyIllustrations, readyPackEntries } from '../../utils/facelessStyle.js';
import { MAX_NEW_PER_VIDEO } from '../../data/facelessIllustrations.js';

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

  // Texte source (article, notes) : matiere premiere pour le script. Refuse s il est trop long
  // plutot que de le couper en silence (la fin d un article est souvent sa conclusion).
  const sourceText = normalizeSourceText(body?.sourceText);
  if (sourceText.length > MAX_SOURCE_TEXT) {
    return sendError(event, createError({ statusCode: 400, statusMessage: `Texte source trop long (${MAX_SOURCE_TEXT.toLocaleString('fr-FR')} caracteres maximum, ${sourceText.length.toLocaleString('fr-FR')} recus)` }));
  }

  // Plan deja ecrit et valide par le createur (etape "plan a valider") : Claude n est pas rappele.
  const hasPlan = body?.plan && typeof body.plan === 'object';
  if (!idea && !sourceText && !hasPlan) {
    return sendError(event, createError({ statusCode: 400, statusMessage: 'idee ou texte source requis' }));
  }
  const direction = String(body?.direction || '').slice(0, MAX_DIRECTION);
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
    // DA choisie pour CETTE video (0 = principale, 1 et 2 = options) ; la DA par defaut de la persona ne change pas.
    style = pickStyleSlot(loaded.style, body?.styleSlot);
  }

  // Voix et sous-titres : ce que dit le formulaire, sinon les reglages de la DA.
  // Voix de synthese du catalogue, ou voix CLONEE du proprietaire (modele v3, balises de ton).
  const voice = await resolveVoiceChoice({ body, user, style });
  if (voice.error) {
    return sendError(event, createError({ statusCode: voice.error.statusCode, statusMessage: voice.error.message }));
  }
  const { voiceId, voiceMode, stability } = voice;
  const captions = body?.captions === undefined ? style.captions.enabled : body.captions !== false;

  let plan = null;
  if (hasPlan) {
    try {
      plan = sanitizeFacelessPlan(body.plan, {
        captions,
        packIds: Object.keys(readyPackEntries(style)),
        illustrationIds: persona ? Object.keys(readyIllustrations(style)) : [],
        maxNew: Math.max(0, Math.min(MAX_NEW_PER_VIDEO, Math.floor(Number(body?.illustrations?.maxNew) || 0))),
        allowTags: voiceMode === 'clone',
      });
    } catch {
      return sendError(event, createError({ statusCode: 400, statusMessage: 'Plan invalide (2 scènes au moins, avec du texte dit)' }));
    }
  }

  // Illustrations : celles du dossier de la persona sont gratuites ; de NOUVELLES images (payantes)
  // ne sont generees que si l utilisateur en autorise un nombre precis ET le confirme.
  const maxNew = Math.max(0, Math.min(MAX_NEW_PER_VIDEO, Math.floor(Number(body?.illustrations?.maxNew) || 0)));
  if (maxNew > 0) {
    if (!persona) {
      return sendError(event, createError({ statusCode: 400, statusMessage: 'Choisis une persona : les illustrations sont rangees dans son dossier' }));
    }
    if (body?.illustrations?.confirmCost !== true) {
      return sendError(event, createError({ statusCode: 400, statusMessage: `Confirmation requise : jusqu a ${maxNew} image(s) payante(s), environ ${describeIllustrationCost(maxNew).usd} $ au maximum` }));
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
    prompt: idea || sourceText.slice(0, 200) || String(plan?.title || '').slice(0, 200),
  });

  return runFacelessVideoJob({
    prisma,
    contentId: generatedContent.id,
    idea,
    sourceText,
    direction,
    plan,
    persona,
    targetSeconds,
    captions,
    voiceId,
    voiceMode,
    stability,
    style,
    userId: user.id,
    illustrations: persona ? readyIllustrations(style) : {},
    maxNew,
  });
});
