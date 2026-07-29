import { generateVideoFromTextPrompt } from '../../utils/klingGenerator.js';
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

async function requestVeoVideo({ prompt, influencerId, withFaceRef, faceRefPath, apiKey }) {
  const endpoint = process.env.VEO_API_URL || 'https://generativelanguage.googleapis.com/v1beta/videos:generate';
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt,
      metadata: {
        influencerId,
        withFaceRef,
        faceRefPath: withFaceRef ? faceRefPath : null,
      },
    }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(`Veo request failed: ${JSON.stringify(payload)}`);
  }

  return {
    jobId: String(payload?.jobId || payload?.name || payload?.id || ''),
    videoUrl: String(payload?.videoUrl || payload?.output?.videoUrl || ''),
    status: String(payload?.status || payload?.state || 'processing'),
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
    const veoApiKey = String(runtimeConfig.veoApiKey || process.env.VEO_API_KEY || '').trim();
    if (!veoApiKey) {
      return sendError(event, createError({ statusCode: 500, statusMessage: 'VEO_API_KEY non configuree' }));
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
      const veoApiKey = String(runtimeConfig.veoApiKey || process.env.VEO_API_KEY || '').trim();

      providerResult = await requestVeoVideo({
        prompt,
        influencerId,
        withFaceRef,
        faceRefPath: influencer.faceRefPath,
        apiKey: veoApiKey,
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
