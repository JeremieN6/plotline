import { createGeneratedContentRecord } from './video.post.js';
import { getOrCreateDefaultProfile } from '../../utils/defaultProfile.js';
import { runOwnVoiceJob, detectAudioType } from '../../utils/facelessOwnVoice.js';
import { OWN_VOICE_MAX_BYTES } from '../../utils/ownVoice.js';
import { resolveElevenLabsApiKey } from '../../utils/elevenLabsTts.js';
import { defaultFacelessStyle, readyIllustrations } from '../../utils/facelessStyle.js';
import { loadPersonaStyle } from '../../utils/facelessStyleStore.js';

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
// Pas de nouvelle image payante dans ce mode : les illustrations du dossier de la persona restent utilisables.
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
  });
});
