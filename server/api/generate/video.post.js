import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import { GoogleGenAI } from '@google/genai';

import { generateVideoFromTextPrompt } from '../../utils/klingGenerator.js';
import { getGeneratedDir, toMediaUrl } from '../../utils/mediaStorage.js';
import { selectVideoModel } from '../../utils/videoModelSelector.js';

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

async function requestSeedanceVideo({ prompt, influencerId, withFaceRef, faceRefPath, apiKey }) {
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
      faceRefPath: withFaceRef ? faceRefPath : null,
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

function normalizeErrorMessage(error) {
  if (!error) return 'Unknown error';
  if (typeof error === 'string') return error;

  const statusMessage = String(error?.statusMessage || '').trim();
  if (statusMessage) return statusMessage;

  const message = String(error?.message || '').trim();
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

function isMissingCampaignColumnError(error) {
  const message = normalizeErrorMessage(error).toLowerCase();
  return message.includes('campaignid') && message.includes('does not exist');
}

async function createGeneratedContentRecord(prisma, data) {
  try {
    return await prisma.generatedContent.create({
      data,
      select: { id: true },
    });
  } catch (error) {
    if (!isMissingCampaignColumnError(error)) {
      throw error;
    }

    const fallbackId = randomUUID().replace(/-/g, '');
    const rows = await prisma.$queryRaw`
      INSERT INTO "GeneratedContent" ("id", "influencerId", "brandId", "ambassadorId", "platform", "format", "status")
      VALUES (${fallbackId}, ${data.influencerId}, ${data.brandId}, ${data.ambassadorId}, ${data.platform}, ${data.format}, ${data.status})
      RETURNING "id"
    `;

    return {
      id: String(rows?.[0]?.id || fallbackId),
    };
  }
}

function resolveGeminiApiKey(runtimeConfig) {
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
    const filename = `video_veo_${Date.now()}.mp4`;
    const outputPath = path.join(getGeneratedDir(), filename);
    await fs.writeFile(outputPath, buffer);
    return toMediaUrl('generated', filename);
  }

  throw new Error(`Veo video download failed (status ${lastStatus})`);
}

async function requestVeoVideo({ prompt, apiKey }) {
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

export default defineEventHandler(async (event) => {
  const prisma = await getPrisma();
  const authModule = await import('../../utils/auth.js');
  const user = await authModule.requireAuthUser(event);
  const body = await readBody(event);

  const prompt = String(body?.prompt || '').trim();
  const influencerId = String(body?.influencerId || '').trim();
  const ambassadorId = String(body?.ambassadorId || '').trim();
  const campaignId = String(body?.campaignId || '').trim();
  const withFaceRef = body?.withFaceRef === true;

  if (!prompt) {
    return sendError(event, createError({ statusCode: 400, statusMessage: 'prompt requis' }));
  }

  if (!influencerId) {
    return sendError(event, createError({ statusCode: 400, statusMessage: 'influencerId requis' }));
  }

  if (campaignId) {
    const campaign = await prisma.campaign.findFirst({
      where: {
        id: campaignId,
        userId: user.id,
      },
      select: { id: true },
    });

    if (!campaign) {
      return sendError(event, createError({ statusCode: 404, statusMessage: 'Campagne introuvable' }));
    }
  }

  const ownerProfile = await prisma.influencer.findFirst({
    where: {
      id: influencerId,
      userId: user.id,
    },
    select: {
      id: true,
    },
  });

  if (!ownerProfile) {
    return sendError(event, createError({ statusCode: 404, statusMessage: 'Profil introuvable' }));
  }

  const requestedAmbassadorId = withFaceRef ? (ambassadorId || influencerId) : '';
  let influencer = ownerProfile;

  if (requestedAmbassadorId) {
    const ambassador = await prisma.influencer.findFirst({
      where: {
        id: requestedAmbassadorId,
        userId: user.id,
      },
      select: {
        id: true,
        faceRefPath: true,
      },
    });

    if (!ambassador) {
      return sendError(event, createError({ statusCode: 404, statusMessage: 'Ambassadrice introuvable' }));
    }

    influencer = ambassador;
  } else {
    influencer = await prisma.influencer.findFirst({
      where: {
        id: influencerId,
        userId: user.id,
      },
      select: {
        id: true,
      faceRefPath: true,
    },
  });
  }

  if (!influencer) {
    return sendError(event, createError({ statusCode: 404, statusMessage: 'Profil introuvable' }));
  }

  const model = selectVideoModel(prompt);
  const runtimeConfig = useRuntimeConfig(event);

  if (withFaceRef && !String(influencer.faceRefPath || '').trim()) {
    return sendError(event, createError({ statusCode: 409, statusMessage: 'Aucune face ref disponible pour ce profil actif' }));
  }

  if (model === 'veo') {
    const geminiApiKey = resolveGeminiApiKey(runtimeConfig);
    if (!geminiApiKey) {
      return sendError(event, createError({ statusCode: 500, statusMessage: 'GEMINI_API_KEY non configuree' }));
    }
  }

  if (model === 'seedance') {
    const seedanceApiKey = String(runtimeConfig.seedanceApiKey || process.env.SEEDANCE_API_KEY || '').trim();
    if (!seedanceApiKey) {
      return sendError(event, createError({ statusCode: 500, statusMessage: 'SEEDANCE_API_KEY non configuree' }));
    }
  }

  const generatedContentData = {
    influencerId: influencer.id,
    brandId: ownerProfile.id,
    ambassadorId: withFaceRef ? influencer.id : null,
    campaignId: campaignId || null,
    platform: 'TIKTOK',
    format: 'REEL',
    status: 'PROCESSING',
  };

  const generatedContent = await createGeneratedContentRecord(prisma, generatedContentData);
  const contentId = generatedContent.id;

  // Veo est une opération longue (~60s). On la lance en arrière-plan et on répond
  // immédiatement avec status "processing". Le frontend poll /api/content/:id/status.
  if (model === 'veo') {
    const geminiApiKey = resolveGeminiApiKey(runtimeConfig);

    (async () => {
      try {
        const providerResult = await requestVeoVideo({ prompt, apiKey: geminiApiKey });
        const resolvedVideoUrl = String(providerResult?.videoUrl || '').trim();

        if (resolvedVideoUrl) {
          await prisma.generatedContent.updateMany({
            where: { id: contentId },
            data: { imageUrl: resolvedVideoUrl, status: 'PENDING' },
          }).catch(() => {});
        }
      } catch (error) {
        const errorMessage = normalizeErrorMessage(error);
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
    if (model === 'kling') {
      providerResult = await generateVideoFromTextPrompt(prompt);
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
        faceRefPath: influencer.faceRefPath,
        apiKey: seedanceApiKey,
      });
    }
  } catch (error) {
    const errorMessage = normalizeErrorMessage(error);

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
    await prisma.generatedContent.updateMany({
      where: { id: contentId },
      data: { imageUrl: resolvedVideoUrl, status: 'PENDING' },
    });
  }

  return {
    model: providerResult?.model || model,
    jobId: providerResult?.jobId || null,
    contentId,
    status: resolvedVideoUrl ? 'completed' : (providerResult?.status || 'processing'),
  };
});
