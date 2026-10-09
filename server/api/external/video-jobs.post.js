import { createGeneratedContentRecord } from '../generate/video.post.js';
import { resolveVideoModelOrThrow, runVideoGenerationJob } from '../../utils/videoGeneration.js';
import { normalizeBrollCount } from '../../utils/brollGeneration.js';

import { normalizeArtDirectionId, resolveExternalScene } from '../../utils/artDirections.js';

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
// pousse un job video (decor + script parle) vers le pipeline existant.
// Authentifie par cle partagee, jamais par cookie de session. Le personnage
// n est plus verrouille sur la fiche de reference du persona (voir decision
// du 2026-09-09 plus bas) : le modele choisit librement qui apparait a l ecran.
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

  // Profil qui RECOIT la video dans Plotline (marque, persona...): un simple
  // dossier de rangement, jamais la personne a l ecran (withFaceRef: false plus
  // bas). `influencerId` reste accepte: c est l ancien nom du parametre, encore
  // envoye par les versions de sassify deja deployees.
  // Direction artistique optionnelle (voir server/data/artDirections.js) : sans
  // elle, le decor du pilier puis la scene par defaut s appliquent comme avant.
  const artDirectionRaw = String(body?.artDirection || '').trim();
  const artDirection = artDirectionRaw ? normalizeArtDirectionId(artDirectionRaw) : null;
  const profileId = String(body?.profileId || body?.influencerId || '').trim();
  const decorPrompt = String(body?.decorPrompt || '').trim();
  const scriptText = String(body?.scriptText || '').trim();
  // Plans de coupe (images B-roll posees par ffmpeg, payantes) : jamais actifs sans demande explicite.
  const brollCount = normalizeBrollCount(body?.brollCount);
  const slug = String(body?.slug || '').trim();
  const sourceProject = String(body?.sourceProject || '').trim();

  if (!profileId) {
    return sendError(event, createError({ statusCode: 400, statusMessage: 'profileId requis' }));
  }

  if (!scriptText) {
    return sendError(event, createError({ statusCode: 400, statusMessage: 'scriptText requis' }));
  }

  if (artDirectionRaw && !artDirection) {
    return sendError(event, createError({ statusCode: 400, statusMessage: 'artDirection inconnue' }));
  }

  const sceneText = resolveExternalScene({ artDirection, decorPrompt });

  const influencer = await prisma.profile.findUnique({
    where: { id: profileId },
    select: { id: true, faceRefPath: true },
  });

  if (!influencer) {
    return sendError(event, createError({ statusCode: 404, statusMessage: 'Profil introuvable' }));
  }

  // Decision du 2026-09-09 : ce endpoint ne verrouille plus l identite sur la
  // fiche de reference du persona. Sur Omni Flash, verrouiller l identite via
  // une image de depart supprime le lip-sync (voix off) ou, avec le flux a
  // deux tours qui le restaure, introduit une derive d identite et des
  // artefacts de raccord audio/bouche en debut et fin de clip -- constate sur
  // plusieurs tests reels, pas corrige par l ajustement de prompt tente. Pour
  // ce format (illustrer un article de blog, pas un compte influenceur ou la
  // continuite visuelle importe), on laisse desormais le modele inventer un
  // personnage librement : resultat plus propre, moins cher, deja valide par
  // le tout premier test de cette integration.
  const prompt = [artDirection ? sceneText : decorPrompt, scriptText].filter(Boolean).join('. ');

  let model;
  try {
    model = resolveVideoModelOrThrow({
      prompt,
      withFaceRef: false,
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
    ambassadorId: null,
    campaignId: null,
    // REEL n est pas specifique a TikTok: Instagram publie deja les Reels
    // nativement, et TikTok n a aucune route de publication automatique
    // (voir scheduledPublisher.js resolvePublishTarget) -- ces videos restaient
    // condamnees a ne jamais pouvoir etre publiees depuis l app.
    platform: 'INSTAGRAM',
    format: 'REEL',
    status: 'PROCESSING',
    prompt: prompt || null,
  };

  const generatedContent = await createGeneratedContentRecord(prisma, generatedContentData);
  const contentId = generatedContent.id;

  console.log(`[external/video-jobs] contentId=${contentId} profileId=${profileId} sourceProject=${sourceProject || 'inconnu'} slug=${slug || 'aucun'} model=${model}`);

  try {
    const result = await runVideoGenerationJob({
      prisma,
      runtimeConfig,
      contentId,
      prompt,
      model,
      withFaceRef: false,
      influencer,
      // Omni Flash utilise ces deux champs separement seulement si une image
      // de depart est fournie (voir requestOmniFlashVideo) -- sans elle
      // (withFaceRef: false), un seul appel texte les combine directement.
      // Jamais le script en repli : sans decor, le script entier se retrouvait
      // dans la description de scene ET dans les repliques, et le modele en
      // reprenait des phrases hors de leur segment.
      scenePrompt: sceneText,
      dialogueText: scriptText,
      brollCount,
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
