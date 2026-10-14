import { createGeneratedContentRecord } from './video.post.js';
import { getOrCreateDefaultProfile } from '../../utils/defaultProfile.js';
import { runOwnVoiceJob, detectAudioType } from '../../utils/facelessOwnVoice.js';
import { OWN_VOICE_MAX_BYTES } from '../../utils/ownVoice.js';
import { resolveElevenLabsApiKey } from '../../utils/elevenLabsTts.js';
import { defaultFacelessStyle, readyIllustrations } from '../../utils/facelessStyle.js';
import { loadPersonaStyle } from '../../utils/facelessStyleStore.js';
import { describeIllustrationCost } from '../../utils/facelessIllustration.js';
import { MAX_NEW_PER_VIDEO } from '../../data/facelessIllustrations.js';

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

// Video faceless avec la VRAIE voix du createur (formulaire multipart : `audio`, `idea`, `profileId`, `captions`).
// Transcription (ElevenLabs Scribe, quelques centimes), nettoyage par Claude, montage par code.
// Illustrations : celles du dossier de la persona sont gratuites ; de NOUVELLES images (payantes) ne sont
// generees que si l utilisateur en autorise un nombre precis ET le confirme (memes garde-fous que la voix de synthese).
export default defineEventHandler(async (event) => {
  const prisma = await getPrisma();
  const authModule = await import('../../utils/auth.js');
  const user = await authModule.requireAuthUser(event);

  if (!resolveElevenLabsApiKey()) {
    return sendError(event, createError({ statusCode: 503, statusMessage: 'ELEVEN_LABS_API_KEY non configuree' }));
  }

  const parts = (await readMultipartFormData(event)) || [];
  const field = (name) => String(parts.find((p) => p.name === name && !p.filename)?.data?.toString('utf8') || '').trim();
  const file = parts.find((p) => p.name === 'audio' && p.filename);

  if (!file?.data?.length) {
    return sendError(event, createError({ statusCode: 400, statusMessage: 'enregistrement audio requis' }));
  }
  if (file.data.length > OWN_VOICE_MAX_BYTES) {
    return sendError(event, createError({ statusCode: 400, statusMessage: 'Enregistrement trop volumineux (25 Mo maximum)' }));
  }
  if (!detectAudioType(file.data)) {
    return sendError(event, createError({ statusCode: 400, statusMessage: 'Format audio non reconnu (mp3, wav, m4a, ogg, flac ou webm)' }));
  }

  const idea = field('idea').slice(0, 2000);
  const profileId = field('profileId');

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
  const captions = field('captions') === '' ? style.captions.enabled : field('captions') !== 'false';

  const maxNew = Math.max(0, Math.min(MAX_NEW_PER_VIDEO, Math.floor(Number(field('maxNewImages')) || 0)));
  if (maxNew > 0) {
    if (!persona) {
      return sendError(event, createError({ statusCode: 400, statusMessage: 'Choisis une persona : les illustrations sont rangees dans son dossier' }));
    }
    if (field('confirmCost') !== 'true') {
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
    prompt: idea || 'Vidéo faceless avec ma voix',
  });

  return runOwnVoiceJob({
    prisma,
    contentId: generatedContent.id,
    audio: file.data,
    idea,
    persona,
    captions,
    style,
    illustrations: persona ? readyIllustrations(style) : {},
    maxNew,
    userId: user.id,
  });
});
