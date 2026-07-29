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

  let operation = await ai.models.generateVideos({
    model: 'veo-3.1-generate-001',
    prompt,
    config: {
      aspectRatio: '9:16',
      durationSeconds: 8,
    },
  });

  const operationName = String(operation?.name || '').trim();
  if (!operationName) {
    throw new Error('Veo generation did not return an operation name');
  }

  while (!operation?.done) {
    await sleep(5000);
    operation = await ai.operations.getVideosOperation({
      operation: { name: operationName },
    });
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
  };
}

export default defineEventHandler(async (event) => {
  const prisma = await getPrisma();
  const authModule = await import('../../utils/auth.js');
  const user = await authModule.requireAuthUser(event);
  const body = await readBody(event);

  const prompt = String(body?.prompt || '').trim();
  const influencerId = String(body?.influencerId || '').trim();
  const withFaceRef = body?.withFaceRef !== false;

  if (!prompt) {
    return sendError(event, createError({ statusCode: 400, statusMessage: 'prompt requis' }));
  }

  if (!influencerId) {
    return sendError(event, createError({ statusCode: 400, statusMessage: 'influencerId requis' }));
  }

  const influencer = await prisma.influencer.findFirst({
    where: {
      id: influencerId,
      userId: user.id,
    },
    select: {
      id: true,
      faceRefPath: true,
    },
  });

  if (!influencer) {
    return sendError(event, createError({ statusCode: 404, statusMessage: 'Ambassadrice introuvable' }));
  }

  if (withFaceRef && !String(influencer.faceRefPath || '').trim()) {
    return sendError(event, createError({ statusCode: 409, statusMessage: 'Aucune face ref disponible pour cette ambassadrice' }));
  }

  const model = selectVideoModel(prompt);
  const runtimeConfig = useRuntimeConfig(event);

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

  const generatedContent = await prisma.generatedContent.create({
    data: {
      influencerId: influencer.id,
      platform: 'TIKTOK',
      format: 'REEL',
      status: 'PROCESSING',
    },
    select: {
      id: true,
    },
  });

  let providerResult;

  try {
    if (model === 'kling') {
      providerResult = await generateVideoFromTextPrompt(prompt);
      providerResult = {
        jobId: providerResult?.taskId || '',
        videoUrl: providerResult?.videoUrl || '',
        status: providerResult?.videoUrl ? 'completed' : 'processing',
      };
    } else if (model === 'veo') {
      const geminiApiKey = resolveGeminiApiKey(runtimeConfig);

      providerResult = await requestVeoVideo({
        prompt,
        apiKey: geminiApiKey,
      });
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
    await prisma.generatedContent.update({
      where: { id: generatedContent.id },
      data: {
        status: 'FAILED',
        errorMessage: error?.message ? String(error.message) : 'Video generation failed',
      },
    }).catch(() => {});

    throw error;
  }

  const resolvedVideoUrl = String(providerResult?.videoUrl || '').trim();
  if (resolvedVideoUrl) {
    await prisma.generatedContent.update({
      where: { id: generatedContent.id },
      data: {
        imageUrl: resolvedVideoUrl,
        status: 'VALIDATED',
      },
    });
  }

  return {
    model,
    jobId: providerResult?.jobId || null,
    contentId: generatedContent.id,
    status: resolvedVideoUrl ? 'completed' : (providerResult?.status || 'processing'),
  };
});
