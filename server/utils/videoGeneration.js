import fs from 'node:fs/promises';
import path from 'node:path';

import { GoogleGenAI } from '@google/genai';

import { isAbsoluteHttpUrl, isBlobStorageEnabled, uploadPublicMediaBuffer } from './blobStorage.js';
import { finalizeContentWithVersion, markGenerationFailure } from './contentVersions.js';
import { readImageSourceBuffer } from './faceRefReader.js';
import { generateImageFromGeminiWithSafetyFallback } from './geminiImageGeneration.js';
import { validatePersonAndUpperBody } from './imageValidation.js';
import { generateVideoFromImageAndPrompt, generateVideoFromTextPrompt } from './klingGenerator.js';
import { getGeneratedDir, resolveMediaPath, toMediaUrl } from './mediaStorage.js';
import { resolveAspectRatio } from './aspectRatio.js';
import { generateSeedanceVideo, isSeedanceEnabled } from './seedanceGenerator.js';
import { selectVideoModel } from './videoModelSelector.js';
import { applyHookTextOverlay } from './videoTextOverlay.js';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function normalizeErrorMessage(error, providerLabel = '') {
  if (!error) return 'Unknown error';
  if (typeof error === 'string') return error;

  const statusMessage = String(error?.statusMessage || '').trim();
  if (statusMessage) return statusMessage;

  const message = String(error?.message || '').trim();

  // "fetch failed" ne dit pas quel service est injoignable: on le precise, avec
  // la cause reseau sous-jacente quand elle est disponible.
  if (message.toLowerCase() === 'fetch failed') {
    const cause = String(error?.cause?.code || error?.cause?.message || '').trim();
    const target = providerLabel ? ` (${providerLabel})` : '';
    return `Service de generation video injoignable${target}${cause ? ` — ${cause}` : ''}`;
  }

  if (message) return message;

  try {
    return JSON.stringify(error);
  } catch {
    return 'Unknown error';
  }
}

function isModelAvailabilityError(error) {
  const message = normalizeErrorMessage(error).toLowerCase();
  return (
    message.includes('not found')
    || message.includes('is not supported')
    || message.includes('unsupported')
    || message.includes('permission')
    || message.includes('access')
    || message.includes('failed precondition')
  );
}

export function resolveGeminiApiKey(runtimeConfig) {
  return String(
    runtimeConfig?.geminiApiKey
    || runtimeConfig?.veoApiKey
    || process.env.GEMINI_API_KEY
    || process.env.VEO_API_KEY
    || ''
  ).trim();
}

function withApiKeyInUrl(rawUrl, apiKey) {
  const url = String(rawUrl || '').trim();
  if (!url) return '';

  try {
    const parsed = new URL(url);
    if (!parsed.searchParams.has('key')) {
      parsed.searchParams.set('key', apiKey);
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

// Sans ce passage par le Blob, la video restait sur le disque de la machine
// qui genere: avec une base partagee entre local et prod, elle etait
// introuvable depuis l autre environnement.
async function saveGeneratedVideoBuffer(buffer, filePrefix = 'video') {
  if (isBlobStorageEnabled()) {
    const uploaded = await uploadPublicMediaBuffer('generated', 'mp4', buffer, 'video/mp4');
    return uploaded.url;
  }

  const filename = `${filePrefix}_${Date.now()}.mp4`;
  const outputPath = path.join(getGeneratedDir(), filename);
  await fs.writeFile(outputPath, buffer);
  return toMediaUrl('generated', filename);
}

async function downloadVeoVideoToGenerated(videoUri, apiKey) {
  const attempts = [videoUri, withApiKeyInUrl(videoUri, apiKey)].filter(Boolean);
  let lastStatus = 0;

  for (const attemptUrl of attempts) {
    const response = await fetch(attemptUrl);
    lastStatus = response.status;
    if (!response.ok) {
      continue;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    return saveGeneratedVideoBuffer(buffer, 'video_veo');
  }

  throw new Error(`Veo video download failed (status ${lastStatus})`);
}

async function requestVeoVideo({ prompt, apiKey, faceRefImage, aspectRatio }) {
  const ai = new GoogleGenAI({ apiKey });
  const modelCandidates = [
    'veo-3.1-generate-001',
    'veo-3.1-generate-preview',
    'veo-3.1-fast-generate-preview',
    'veo-3.1-lite-generate-preview',
  ];

  let operation;
  let usedModel = modelCandidates[0];
  let lastModelError = null;

  for (const modelName of modelCandidates) {
    try {
      operation = await ai.models.generateVideos({
        model: modelName,
        prompt,
        image: faceRefImage
          ? { imageBytes: faceRefImage.base64, mimeType: faceRefImage.mimeType }
          : undefined,
        config: {
          aspectRatio,
          durationSeconds: 8,
        },
      });
      usedModel = modelName;
      lastModelError = null;
      break;
    } catch (error) {
      lastModelError = error;
      if (!isModelAvailabilityError(error) || modelName === modelCandidates[modelCandidates.length - 1]) {
        throw error;
      }
    }
  }

  if (!operation) {
    throw lastModelError || new Error('Veo generation could not be started');
  }

  const operationName = String(operation?.name || '').trim();
  if (!operationName) {
    throw new Error('Veo generation did not return an operation name');
  }

  while (!operation?.done) {
    await sleep(5000);
    operation = await ai.operations.getVideosOperation({ operation });
  }

  if (operation?.error) {
    throw new Error(`Veo generation failed: ${JSON.stringify(operation.error)}`);
  }

  const responsePayload = operation?.response || {};
  const videoUri = String(
    responsePayload?.videos?.[0]?.uri
    || responsePayload?.generatedVideos?.[0]?.video?.uri
    || ''
  ).trim();

  if (!videoUri) {
    throw new Error(`Veo response missing video uri: ${JSON.stringify(responsePayload)}`);
  }

  const localVideoUrl = await downloadVeoVideoToGenerated(videoUri, apiKey);

  return {
    jobId: String(operation?.name || ''),
    videoUrl: localVideoUrl,
    status: 'completed',
    model: usedModel,
  };
}

// Modele sorti le 27/08/2026 (disponibilite generale) : gestion d erreur plus
// explicite que pour Veo/Kling, car quota et activation du modele sur le
// projet Google Cloud sont les deux causes d echec les plus probables dans les
// premieres semaines suivant sa sortie.
function describeOmniFlashError(error) {
  const rawMessage = normalizeErrorMessage(error, 'Omni Flash');
  const message = rawMessage.toLowerCase();

  if (message.includes('quota') || message.includes('rate limit') || message.includes('429') || message.includes('resource_exhausted')) {
    return `Quota Omni Flash depasse — reessayer plus tard ou verifier les quotas du projet Google Cloud (${rawMessage})`;
  }

  if (isModelAvailabilityError(error)) {
    return `Modele gemini-omni-1.1-flash indisponible ou pas encore active sur ce projet Google Cloud (${rawMessage})`;
  }

  return rawMessage;
}

async function requestOmniFlashVideo({ prompt, apiKey, aspectRatio }) {
  const ai = new GoogleGenAI({ apiKey });
  const model = 'gemini-omni-1.1-flash';

  let interaction;
  try {
    interaction = await ai.interactions.create({
      model,
      input: prompt,
      response_format: { type: 'video', aspect_ratio: aspectRatio },
    });
  } catch (error) {
    throw new Error(describeOmniFlashError(error));
  }

  // L API Interactions peut repondre de facon synchrone ou asynchrone selon la
  // charge: on gere les deux, sans supposer que `interactions.get` existe.
  let attempts = 0;
  while (interaction && interaction.status && interaction.status !== 'completed' && attempts < 60) {
    if (interaction.status === 'failed' || interaction.status === 'error') {
      throw new Error(`Omni Flash generation failed: ${JSON.stringify(interaction?.error || interaction).slice(0, 500)}`);
    }

    if (typeof ai.interactions.get !== 'function' || !interaction.name) {
      break;
    }

    await sleep(5000);
    attempts += 1;

    try {
      interaction = await ai.interactions.get({ name: interaction.name });
    } catch (error) {
      throw new Error(describeOmniFlashError(error));
    }
  }

  const base64Video = String(interaction?.output_video?.data || '').trim();
  if (!base64Video) {
    throw new Error(`Reponse Omni Flash sans output_video.data exploitable: ${JSON.stringify(interaction).slice(0, 500)}`);
  }

  const buffer = Buffer.from(base64Video, 'base64');
  const videoUrl = await saveGeneratedVideoBuffer(buffer, 'video_omniflash');

  return {
    jobId: String(interaction?.name || ''),
    videoUrl,
    status: 'completed',
    model,
  };
}

export const SUPPORTED_VIDEO_MODELS = ['veo', 'kling', 'seedance', 'omniflash'];

export function isSupportedVideoModel(value) {
  return SUPPORTED_VIDEO_MODELS.includes(String(value || '').trim().toLowerCase());
}

export function resolveVideoModelOrThrow({ prompt, withFaceRef, influencer, runtimeConfig, forcedModel }) {
  // Un modele impose (choisi depuis "Modifier") court-circuite la detection
  // automatique par mots-cles, qui reste le comportement par defaut.
  const normalizedForced = String(forcedModel || '').trim().toLowerCase();
  const model = isSupportedVideoModel(normalizedForced)
    ? normalizedForced
    : selectVideoModel(prompt);

  if (withFaceRef && !String(influencer?.faceRefPath || '').trim()) {
    throw createError({ statusCode: 409, statusMessage: 'Aucune face ref disponible pour ce profil actif' });
  }

  if (model === 'veo' || model === 'omniflash') {
    const geminiApiKey = resolveGeminiApiKey(runtimeConfig);
    if (!geminiApiKey) {
      throw createError({ statusCode: 500, statusMessage: 'GEMINI_API_KEY non configuree' });
    }
  }

  if (model === 'seedance') {
    // Garde serveur meme si le studio ne propose plus le choix: une requete
    // forgee ne doit pas partir consommer des credits qui n existent pas.
    if (!isSeedanceEnabled()) {
      throw createError({
        statusCode: 503,
        statusMessage: 'Seedance est hors service (credits epuises). Choisissez Veo ou Kling.',
      });
    }

    const seedanceApiKey = String(runtimeConfig.seedanceApiKey || process.env.SEEDANCE_API_KEY || '').trim();
    if (!seedanceApiKey) {
      throw createError({ statusCode: 500, statusMessage: 'SEEDANCE_API_KEY non configuree' });
    }
  }

  return model;
}

// L'image de reference brute (fiche 3 panneaux front/45°/profil) n'est pas exploitable
// telle quelle comme premiere image d'une video: le modele video tente d'animer la
// composition entiere (glitchs, cadrage qui saute d'un panneau a l'autre). Exactement
// comme le fait deja le workflow Reel/Pinterest, on genere d'abord une SEULE photo nette
// (le visage de l'ambassadrice appliqué a la scene decrite), validee comme un portrait
// unique, et c'est CETTE image propre qui sert de point de depart a la video.
async function generateCleanStartFrame({ prompt, faceRefImage }) {
  const framePrompt = `Generate a single photorealistic still photograph capturing the opening moment of the scene described below. This must be ONE natural static photo — not a sequence, not a multi-panel composite, not a collage, not a reference sheet. Render it exactly as a single camera frame would look at the very start of the described action, before any of the described movement happens.\n\nScene description:\n${prompt}`;

  let inlineData;
  let imageMime = 'image/jpeg';
  let generatedBuffer = null;
  let validation = { personCount: 0, upperBodyVisible: false, reason: '' };

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    inlineData = await generateImageFromGeminiWithSafetyFallback(framePrompt, [
      { inlineData: { mimeType: faceRefImage.mimeType, data: faceRefImage.base64 } },
    ]);
    imageMime = inlineData.mimeType || 'image/jpeg';
    generatedBuffer = Buffer.from(inlineData.data, 'base64');

    validation = await validatePersonAndUpperBody(generatedBuffer, imageMime);

    // On verifie qu un sujet est bien rendu, pas qu il soit seul: une scene peut
    // legitimement comporter plusieurs personnes (une estheticienne et sa cliente,
    // par exemple). Exiger "exactement une personne" faisait echouer ces prompts.
    if (validation.personCount >= 1 && validation.upperBodyVisible) {
      break;
    }

    if (attempt === 3) {
      throw new Error(
        `Impossible de générer une image de départ nette pour la vidéo : aucun sujet clairement visible après 3 essais. Raison: ${validation.reason || 'inconnue'}`,
      );
    }
  }

  return {
    base64: generatedBuffer.toString('base64'),
    mimeType: imageMime,
  };
}

async function prepareVideoStartFrame({ influencer, prompt }) {
  const faceRefPath = String(influencer?.faceRefPath || '').trim();
  if (!faceRefPath) {
    return null;
  }

  const asset = await readImageSourceBuffer(faceRefPath);
  const faceRefImage = {
    base64: asset.buffer.toString('base64'),
    mimeType: asset.mimeType,
  };

  return await generateCleanStartFrame({ prompt, faceRefImage });
}

/** Appelle le fournisseur choisi et normalise sa reponse. */
async function requestProviderVideo({ model, prompt, aspectRatio, startFrame, runtimeConfig }) {
  if (model === 'veo') {
    return await requestVeoVideo({
      prompt,
      apiKey: resolveGeminiApiKey(runtimeConfig),
      faceRefImage: startFrame,
      aspectRatio,
    });
  }

  if (model === 'seedance') {
    return await generateSeedanceVideo({ prompt, aspectRatio, startFrame, runtimeConfig });
  }

  if (model === 'omniflash') {
    return await requestOmniFlashVideo({
      prompt,
      apiKey: resolveGeminiApiKey(runtimeConfig),
      aspectRatio,
    });
  }

  const klingResult = startFrame
    ? await generateVideoFromImageAndPrompt({ prompt, imageBase64: startFrame.base64, aspectRatio })
    : await generateVideoFromTextPrompt(prompt, aspectRatio);

  return {
    jobId: klingResult?.taskId || '',
    videoUrl: klingResult?.videoUrl || '',
  };
}

async function readGeneratedVideoBuffer(videoUrl) {
  if (isAbsoluteHttpUrl(videoUrl)) {
    const response = await fetch(videoUrl);
    if (!response.ok) {
      throw new Error(`Impossible de recuperer la video generee pour l'overlay (status ${response.status})`);
    }
    return Buffer.from(await response.arrayBuffer());
  }

  const relativePath = videoUrl.replace(/^\/api\/media\//, '');
  const absolutePath = resolveMediaPath(relativePath);
  if (!absolutePath) {
    throw new Error(`Chemin video local invalide pour l'overlay: ${videoUrl}`);
  }
  return fs.readFile(absolutePath);
}

// Reserve aux jobs qui fournissent un hookVideo (source home.sassify.fr pour
// l instant) : les autres formats gardent leur contrainte "no text overlays".
async function applyHookOverlayToVideoUrl(videoUrl, hookText) {
  const tempDir = path.join(process.cwd(), 'storage', 'temp');
  await fs.mkdir(tempDir, { recursive: true });

  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const inputPath = path.join(tempDir, `hook_in_${stamp}.mp4`);
  const outputPath = path.join(tempDir, `hook_out_${stamp}.mp4`);

  try {
    const inputBuffer = await readGeneratedVideoBuffer(videoUrl);
    await fs.writeFile(inputPath, inputBuffer);
    await applyHookTextOverlay(inputPath, hookText, outputPath);
    const outputBuffer = await fs.readFile(outputPath);
    return await saveGeneratedVideoBuffer(outputBuffer, 'video_hook');
  } finally {
    await fs.unlink(inputPath).catch(() => {});
    await fs.unlink(outputPath).catch(() => {});
  }
}

export async function runVideoGenerationJob({ prisma, runtimeConfig, contentId, prompt, model, withFaceRef, influencer, previousStatus, hookVideo }) {
  // Le cadrage demande dans le prompt fait foi. Le repli ne s applique que si
  // le prompt ne se prononce pas: aucun format n est impose a la place de l auteur.
  const aspectRatio = resolveAspectRatio(prompt);

  // Aucun fournisseur video n est attendu dans la requete HTTP: tous demandent
  // d une a plusieurs minutes, et Kling sonde jusqu a quinze minutes. Derriere un
  // proxy la requete serait coupee bien avant la fin, laissant le contenu bloque
  // en PROCESSING alors que la video aboutit cote fournisseur. On repond donc
  // "processing" tout de suite, et le frontend suit via /api/content/:id/status.
  (async () => {
    try {
      const startFrame = withFaceRef ? await prepareVideoStartFrame({ influencer, prompt }) : null;
      const providerResult = await requestProviderVideo({ model, prompt, aspectRatio, startFrame, runtimeConfig });
      let resolvedVideoUrl = String(providerResult?.videoUrl || '').trim();

      // Sans URL exploitable, le contenu resterait en PROCESSING indefiniment:
      // on le marque en echec pour que l utilisateur puisse relancer.
      if (!resolvedVideoUrl) {
        throw new Error('Le fournisseur a repondu sans URL de video exploitable');
      }

      if (hookVideo) {
        try {
          resolvedVideoUrl = await applyHookOverlayToVideoUrl(resolvedVideoUrl, hookVideo);
        } catch (overlayError) {
          // L overlay est un enrichissement, pas le coeur du job : une video
          // Omni Flash coute cher a regenerer, on la publie donc sans le texte
          // plutot que de perdre toute la generation pour une police manquante.
          console.error(`Overlay hookVideo echoue pour ${contentId}, video publiee sans texte:`, normalizeErrorMessage(overlayError));
        }
      }

      await finalizeContentWithVersion(
        prisma,
        contentId,
        { imageUrl: resolvedVideoUrl, status: 'PENDING' },
        { generationModel: providerResult?.model || model },
      );
    } catch (error) {
      // Une generation ratee ne doit pas emporter le rendu precedent: s il est
      // toujours la, le contenu retrouve son statut et reste visible.
      await markGenerationFailure(prisma, contentId, {
        errorMessage: normalizeErrorMessage(error, model),
        previousStatus,
      });
    }
  })();

  return {
    model,
    jobId: null,
    contentId,
    status: 'processing',
  };
}
