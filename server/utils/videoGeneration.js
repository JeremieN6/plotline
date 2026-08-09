import fs from 'node:fs/promises';
import path from 'node:path';

import { GoogleGenAI } from '@google/genai';

import { isBlobStorageEnabled, uploadPublicMediaBuffer } from './blobStorage.js';
import { finalizeContentWithVersion } from './contentVersions.js';
import { readImageSourceBuffer } from './faceRefReader.js';
import { generateImageFromGeminiWithSafetyFallback } from './geminiImageGeneration.js';
import { validatePersonAndUpperBody } from './imageValidation.js';
import { generateVideoFromImageAndPrompt, generateVideoFromTextPrompt } from './klingGenerator.js';
import { getGeneratedDir, toMediaUrl } from './mediaStorage.js';
import { selectVideoModel } from './videoModelSelector.js';

export async function requestSeedanceVideo({ prompt, influencerId, withFaceRef, faceRefImage, apiKey }) {
  const endpoint = process.env.SEEDANCE_API_URL || 'https://api.seedance.ai/v1/videos';
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt,
      influencerId,
      withFaceRef,
      faceRefImage: withFaceRef && faceRefImage ? { data: faceRefImage.base64, mimeType: faceRefImage.mimeType } : null,
      aspect_ratio: '9:16',
    }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(`Seedance request failed: ${JSON.stringify(payload)}`);
  }

  return {
    jobId: String(payload?.jobId || payload?.id || payload?.data?.id || ''),
    videoUrl: String(payload?.videoUrl || payload?.data?.videoUrl || ''),
    status: String(payload?.status || payload?.data?.status || 'processing'),
  };
}

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

async function requestVeoVideo({ prompt, apiKey, faceRefImage }) {
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
          aspectRatio: '9:16',
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
    const seedanceApiKey = String(runtimeConfig.seedanceApiKey || process.env.SEEDANCE_API_KEY || '').trim();
    if (!seedanceApiKey) {
      throw createError({ statusCode: 500, statusMessage: 'SEEDANCE_API_KEY non configuree' });
    }

    // L URL par defaut (api.seedance.ai) ne resout pas: sans URL explicite, on
    // echoue tot avec un message clair plutot que sur un "fetch failed" opaque.
    if (!String(process.env.SEEDANCE_API_URL || '').trim()) {
      throw createError({
        statusCode: 501,
        statusMessage: 'Seedance n est pas configure: renseignez SEEDANCE_API_URL, ou choisissez Veo ou Kling.',
      });
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
  let validation = { pass: false, reason: '' };

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    inlineData = await generateImageFromGeminiWithSafetyFallback(framePrompt, [
      { inlineData: { mimeType: faceRefImage.mimeType, data: faceRefImage.base64 } },
    ]);
    imageMime = inlineData.mimeType || 'image/jpeg';
    generatedBuffer = Buffer.from(inlineData.data, 'base64');

    validation = await validatePersonAndUpperBody(generatedBuffer, imageMime);
    if (validation.pass) {
      break;
    }

    if (attempt === 3) {
      throw new Error(
        `Impossible de générer une image de départ nette pour la vidéo (personne non détectée clairement). Raison: ${validation.reason || 'inconnue'}`,
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

export async function runVideoGenerationJob({ prisma, runtimeConfig, contentId, prompt, model, influencerId, withFaceRef, influencer }) {
  // Veo est une opération longue (~60s). On la lance en arrière-plan et on répond
  // immédiatement avec status "processing". Le frontend poll /api/content/:id/status.
  if (model === 'veo') {
    const geminiApiKey = resolveGeminiApiKey(runtimeConfig);

    (async () => {
      try {
        const faceRefImage = withFaceRef ? await prepareVideoStartFrame({ influencer, prompt }) : null;
        const providerResult = await requestVeoVideo({ prompt, apiKey: geminiApiKey, faceRefImage });
        const resolvedVideoUrl = String(providerResult?.videoUrl || '').trim();

        if (resolvedVideoUrl) {
          await finalizeContentWithVersion(
            prisma,
            contentId,
            { imageUrl: resolvedVideoUrl, status: 'PENDING' },
            { generationModel: providerResult?.model || model },
          ).catch(() => {});
        }
      } catch (error) {
        const errorMessage = normalizeErrorMessage(error, model);
        await prisma.generatedContent.updateMany({
          where: { id: contentId },
          data: { status: 'FAILED', errorMessage },
        }).catch(() => {});
      }
    })();

    return {
      model,
      jobId: null,
      contentId,
      status: 'processing',
    };
  }

  // Providers synchrones (kling, seedance)
  let providerResult;

  try {
    const faceRefImage = withFaceRef ? await prepareVideoStartFrame({ influencer, prompt }) : null;

    if (model === 'kling') {
      providerResult = faceRefImage
        ? await generateVideoFromImageAndPrompt({ prompt, imageBase64: faceRefImage.base64 })
        : await generateVideoFromTextPrompt(prompt);
      providerResult = {
        jobId: providerResult?.taskId || '',
        videoUrl: providerResult?.videoUrl || '',
        status: providerResult?.videoUrl ? 'completed' : 'processing',
      };
    } else {
      const seedanceApiKey = String(runtimeConfig.seedanceApiKey || process.env.SEEDANCE_API_KEY || '').trim();

      providerResult = await requestSeedanceVideo({
        prompt,
        influencerId,
        withFaceRef,
        faceRefImage,
        apiKey: seedanceApiKey,
      });
    }
  } catch (error) {
    const errorMessage = normalizeErrorMessage(error, model);

    await prisma.generatedContent.updateMany({
      where: { id: contentId },
      data: { status: 'FAILED', errorMessage },
    }).catch(() => {});

    throw createError({
      statusCode: 500,
      statusMessage: errorMessage,
    });
  }

  const resolvedVideoUrl = String(providerResult?.videoUrl || '').trim();
  if (resolvedVideoUrl) {
    await finalizeContentWithVersion(
      prisma,
      contentId,
      { imageUrl: resolvedVideoUrl, status: 'PENDING' },
      { generationModel: providerResult?.model || model },
    );
  }

  return {
    model: providerResult?.model || model,
    jobId: providerResult?.jobId || null,
    contentId,
    status: resolvedVideoUrl ? 'completed' : (providerResult?.status || 'processing'),
  };
}
