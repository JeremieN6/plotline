import fs from 'node:fs/promises';
import path from 'node:path';

import { GoogleGenAI } from '@google/genai';

import { isBlobStorageEnabled, uploadPublicMediaBuffer } from './blobStorage.js';
import { finalizeContentWithVersion, markGenerationFailure } from './contentVersions.js';
import { readImageSourceBuffer } from './faceRefReader.js';
import { generateImageFromGeminiWithSafetyFallback } from './geminiImageGeneration.js';
import { validatePersonAndUpperBody } from './imageValidation.js';
import { generateVideoFromImageAndPrompt, generateVideoFromTextPrompt } from './klingGenerator.js';
import { getGeneratedDir, toMediaUrl } from './mediaStorage.js';
import { resolveAspectRatio } from './aspectRatio.js';
import { generateSeedanceVideo, isSeedanceEnabled } from './seedanceGenerator.js';
import { selectVideoModel } from './videoModelSelector.js';

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

    // Sans ce passage par le Blob, la video restait sur le disque de la machine
    // qui genere: avec une base partagee entre local et prod, elle etait
    // introuvable depuis l autre environnement.
    if (isBlobStorageEnabled()) {
      const uploaded = await uploadPublicMediaBuffer('generated', 'mp4', buffer, 'video/mp4');
      return uploaded.url;
    }

    const filename = `video_veo_${Date.now()}.mp4`;
    const outputPath = path.join(getGeneratedDir(), filename);
    await fs.writeFile(outputPath, buffer);
    return toMediaUrl('generated', filename);
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

export const SUPPORTED_VIDEO_MODELS = ['veo', 'kling', 'seedance'];

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

  if (model === 'veo') {
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

// generateCleanStartFrame() ne connait deja que "une image + un prompt", sans
// notion de persona: seule prepareVideoStartFrame() est couplee a
// influencer.faceRefPath. Cette variante sert les widgets sans persona (ex.
// FOOD_AD), dont la reference vient d'un upload ponctuel plutot que d'une
// PersonaBible.
async function prepareVideoStartFrameFromUrl({ imageUrl, prompt }) {
  const url = String(imageUrl || '').trim();
  if (!url) {
    return null;
  }

  const asset = await readImageSourceBuffer(url);
  const referenceImage = {
    base64: asset.buffer.toString('base64'),
    mimeType: asset.mimeType,
  };

  return await generateCleanStartFrame({ prompt, faceRefImage: referenceImage });
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

  const klingResult = startFrame
    ? await generateVideoFromImageAndPrompt({ prompt, imageBase64: startFrame.base64, aspectRatio })
    : await generateVideoFromTextPrompt(prompt, aspectRatio);

  return {
    jobId: klingResult?.taskId || '',
    videoUrl: klingResult?.videoUrl || '',
  };
}

export async function runVideoGenerationJob({ prisma, runtimeConfig, contentId, prompt, model, withFaceRef, influencer, previousStatus, customReferenceImageUrl }) {
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
      const startFrame = customReferenceImageUrl
        ? await prepareVideoStartFrameFromUrl({ imageUrl: customReferenceImageUrl, prompt })
        : withFaceRef
          ? await prepareVideoStartFrame({ influencer, prompt })
          : null;
      const providerResult = await requestProviderVideo({ model, prompt, aspectRatio, startFrame, runtimeConfig });
      const resolvedVideoUrl = String(providerResult?.videoUrl || '').trim();

      // Sans URL exploitable, le contenu resterait en PROCESSING indefiniment:
      // on le marque en echec pour que l utilisateur puisse relancer.
      if (!resolvedVideoUrl) {
        throw new Error('Le fournisseur a repondu sans URL de video exploitable');
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
