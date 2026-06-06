import fs from 'node:fs/promises';
import path from 'node:path';

import IORedis from 'ioredis';
import { GoogleGenAI, Modality } from '@google/genai';
import { Anthropic } from '@anthropic-ai/sdk';
import { Worker } from 'bullmq';

import { buildGenerationPrompt } from './buildGenerationPrompt.js';
import { isAbsoluteHttpUrl, isBlobStorageEnabled, uploadPublicMediaBuffer } from './blobStorage.js';
import { imageToJson } from './imageToJson.js';
import { injectBody } from './injectBody.js';
import { getGeneratedDir, toMediaUrl } from './mediaStorage.js';
import { scrapePinterestImage } from './pinterestScraper.js';
import {
  HASHTAG_BLOCKS,
  PROMPT_CAPTION_CONTEXTUALIZED,
  PROMPT_JSON_TO_IMAGE,
  PROMPT_JSON_TO_PRO_IMAGE,
} from './promptTemplates.js';

let prismaClient;
let generationWorker;

async function getPrisma() {
  if (prismaClient) return prismaClient;

  const module = await import('./prisma.js');
  prismaClient = module?.prisma || module?.default?.prisma;

  if (!prismaClient) {
    throw new Error('Unable to resolve prisma client from server/utils/prisma.js');
  }

  return prismaClient;
}

function mimeFromExt(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  return 'image/jpeg';
}

function extFromMime(mimeType) {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType === 'image/gif') return 'gif';
  return 'jpg';
}

function normalizeContentTypeFromHeader(value) {
  return String(value || '').split(';')[0].trim().toLowerCase();
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function formatSceneDescription(concept) {
  return [
    concept.location && `Location: ${concept.location}`,
    concept.outfit && `Outfit: ${concept.outfit}`,
    concept.pose && `Pose: ${concept.pose}`,
    concept.mood && `Mood: ${concept.mood}`,
    concept.lighting && `Lighting: ${concept.lighting}`,
  ]
    .filter(Boolean)
    .join(' | ');
}

function resolveFormatAndRatio(contentType) {
  const normalized = String(contentType || '').trim().toLowerCase();

  if (normalized === 'reel') {
    return { format: 'REEL', ratio: '9:16', contentType: 'reel' };
  }

  if (normalized === 'story') {
    return { format: 'STORY', ratio: '9:16', contentType: 'story' };
  }

  return { format: 'FEED', ratio: '4:5', contentType: 'feed' };
}

function extractInlineDataFromResponse(imageResponse) {
  const candidate = imageResponse?.candidates?.[0];
  const parts = candidate?.content?.parts ?? [];

  if (parts.length === 0) {
    const finishReason = candidate?.finishReason;
    const safetyRatings = JSON.stringify(candidate?.safetyRatings ?? []);
    throw new Error(
      `Gemini returned no parts. finishReason=${finishReason} safetyRatings=${safetyRatings} rawKeys=${Object.keys(imageResponse ?? {}).join(',')}`,
    );
  }

  const imagePart = parts.find(
    (part) => part?.inlineData?.data || part?.inline_data?.data,
  );

  if (!imagePart) {
    const partsSummary = parts
      .map((part, index) => `[${index}] keys=${Object.keys(part ?? {}).join(',')} text=${part?.text ? part.text.slice(0, 80) : ''}`)
      .join(' | ');
    throw new Error(`Gemini did not return an image part. Parts: ${partsSummary}`);
  }

  return imagePart.inlineData ?? imagePart.inline_data;
}

async function generateImageFromGemini(prompt, extraParts = []) {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey || geminiKey.trim() === '...' || geminiKey.trim() === '') {
    throw new Error('GEMINI_API_KEY non configuree dans .env');
  }

  const genai = new GoogleGenAI({ apiKey: geminiKey });
  const imageResponse = await genai.models.generateContent({
    model: 'gemini-3-pro-image-preview',
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }, ...extraParts],
      },
    ],
    config: {
      responseModalities: [Modality.TEXT, Modality.IMAGE],
    },
  });

  return extractInlineDataFromResponse(imageResponse);
}

async function resolveFaceRefAbsolutePath(faceRefPath) {
  const rawPath = String(faceRefPath || '').trim();
  if (!rawPath) {
    throw new Error('Influencer face reference is missing. Upload a face ref first.');
  }

  const candidates = [];

  if (path.isAbsolute(rawPath)) {
    candidates.push(rawPath);
  }

  if (rawPath.startsWith('/uploads/')) {
    candidates.push(path.join(process.cwd(), 'public', rawPath.replace(/^\/+/, '')));
  }

  candidates.push(path.join(process.cwd(), rawPath.replace(/^\/+/, '')));

  const basename = path.basename(rawPath);
  candidates.push(path.join(process.cwd(), 'public', 'uploads', 'face-refs', basename));
  candidates.push(path.join(process.cwd(), 'storage', 'uploads', 'face-refs', basename));

  for (const candidatePath of candidates) {
    if (await fileExists(candidatePath)) {
      return candidatePath;
    }
  }

  throw new Error(`Face reference file not found: ${rawPath}`);
}

async function readImageSourceBuffer(imageSource) {
  const source = String(imageSource || '').trim();
  if (!source) {
    throw new Error('Image source is missing');
  }

  if (isAbsoluteHttpUrl(source)) {
    const response = await fetch(source);
    if (!response.ok) {
      throw new Error(`Unable to download image source: ${source}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const mimeType = normalizeContentTypeFromHeader(response.headers.get('content-type')) || 'image/jpeg';

    return {
      buffer,
      mimeType,
      origin: source,
    };
  }

  const absolutePath = await resolveFaceRefAbsolutePath(source);
  const buffer = await fs.readFile(absolutePath);

  return {
    buffer,
    mimeType: mimeFromExt(absolutePath),
    origin: absolutePath,
  };
}

async function markFailed(contentId, errorMessage) {
  if (!contentId) return;

  const prisma = await getPrisma();
  await prisma.generatedContent.update({
    where: { id: contentId },
    data: {
      status: 'FAILED',
      errorMessage,
    },
  });
}

function resolveRedisUrl() {
  try {
    if (typeof useRuntimeConfig === 'function') {
      const config = useRuntimeConfig();
      if (config?.redisUrl) {
        return config.redisUrl;
      }
    }
  } catch {
    // Fallback to environment variables.
  }

  return process.env.REDIS_URL || 'redis://localhost:6379';
}

function buildUpstashRedisOptions() {
  return {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    tls: { rejectUnauthorized: false },
    retryStrategy: (times) => Math.min(times * 50, 2000),
    reconnectOnError: () => true,
    lazyConnect: false,
  };
}

export async function processGenerationJob(jobData, options = {}) {
  const prisma = await getPrisma();
  const {
    influencerId,
    location,
    outfit,
    pose,
    mood,
    lighting,
    tagCategory,
    contentId,
      workflowType,
      contentType,
      keyword,
  } = jobData || {};
  const updateProgress = typeof options.updateProgress === 'function'
    ? options.updateProgress
    : async () => {};

  try {
    await updateProgress(10);

    const influencer = await prisma.influencer.findUnique({
      where: { id: influencerId },
      select: {
        id: true,
        name: true,
        faceRefPath: true,
      },
    });

    if (!influencer) {
      throw new Error('Influencer not found');
    }

    if (!influencer.faceRefPath) {
      throw new Error('Influencer face reference is missing. Upload a face ref first.');
    }

    const faceRefAsset = await readImageSourceBuffer(influencer.faceRefPath);
    const faceRefBuffer = faceRefAsset.buffer;
    const faceRefMime = faceRefAsset.mimeType;
    const faceRefBase64 = faceRefBuffer.toString('base64');

    const { format, ratio, contentType: normalizedContentType } = resolveFormatAndRatio(contentType);

    const normalizedWorkflow = String(workflowType || '').trim().toLowerCase();
    let prompt;
    let geminiParts;
    let sceneDescriptionConcept;

    if (normalizedWorkflow === 'pinterest') {
      const scrapedImagePath = await scrapePinterestImage(keyword);

      if (!scrapedImagePath) {
        throw new Error(`No Pinterest image found for query: ${keyword}`);
      }

      const sceneJson = await imageToJson(scrapedImagePath);
      const enrichedSceneJson = injectBody(sceneJson);

      prompt = PROMPT_JSON_TO_PRO_IMAGE.replace('{scene_json}', JSON.stringify(enrichedSceneJson, null, 2));

      const scrapedBuffer = await fs.readFile(scrapedImagePath);
      const scrapedBase64 = scrapedBuffer.toString('base64');
      const scrapedMime = mimeFromExt(scrapedImagePath);

      geminiParts = [
        {
          inlineData: {
            mimeType: scrapedMime,
            data: scrapedBase64,
          },
        },
        {
          inlineData: {
            mimeType: faceRefMime,
            data: faceRefBase64,
          },
        },
      ];

      sceneDescriptionConcept = {
        location: enrichedSceneJson?.scene?.location || location,
        outfit: enrichedSceneJson?.subject?.wardrobe?.top || outfit,
        pose: enrichedSceneJson?.subject?.pose || pose,
        mood: enrichedSceneJson?.mood || mood,
        lighting: enrichedSceneJson?.scene?.lighting?.type || lighting,
      };
    } else {
      const concept = { location, outfit, pose, mood, lighting };
      sceneDescriptionConcept = concept;

      const sceneJsonText = buildGenerationPrompt(concept, normalizedContentType, ratio);
      const sceneJson = injectBody(JSON.parse(sceneJsonText));
      prompt = PROMPT_JSON_TO_IMAGE.replace('{scene_json}', JSON.stringify(sceneJson, null, 2));

      geminiParts = [
        {
          inlineData: {
            mimeType: faceRefMime,
            data: faceRefBase64,
          },
        },
      ];
    }

    await updateProgress(30);
    const inlineData = await generateImageFromGemini(prompt, geminiParts);

    await updateProgress(65);

    const imageMime = inlineData.mimeType || 'image/jpeg';
    const extension = extFromMime(imageMime);
    const generatedBuffer = Buffer.from(inlineData.data, 'base64');

    let imageUrl = '';

    if (isBlobStorageEnabled()) {
      const uploaded = await uploadPublicMediaBuffer('generated', extension, generatedBuffer, imageMime);
      imageUrl = uploaded.url;
    } else {
      const generatedDir = getGeneratedDir();
      const filename = `generated_${Date.now()}.${extension}`;
      const generatedPath = path.join(generatedDir, filename);
      await fs.writeFile(generatedPath, generatedBuffer);
      imageUrl = toMediaUrl('generated', filename);
    }

    const anthropicApiKey = process.env.ANTHROPIC_API_KEY || process.env.anthropicApiKey;
    let caption = '';
    const resolvedTagCategory = String(tagCategory || 'lifestyle').trim().toLowerCase();
    const hashtagBlock = HASHTAG_BLOCKS[resolvedTagCategory] || HASHTAG_BLOCKS.lifestyle || '';

    if (anthropicApiKey) {
      const anthropic = new Anthropic({ apiKey: anthropicApiKey });
      const captionPrompt = PROMPT_CAPTION_CONTEXTUALIZED.replace('{influencer_name}', influencer.name)
        .replace('{content_type}', normalizedContentType)
        .replace('{scene_description}', formatSceneDescription(sceneDescriptionConcept));

      const captionResponse = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 300,
        messages: [{ role: 'user', content: captionPrompt }],
      });

      const textPart = captionResponse.content?.find((part) => part.type === 'text');
      caption = (textPart?.text || '').trim();
    }

    if (hashtagBlock) {
      caption = caption ? `${caption}\n\n${hashtagBlock}` : hashtagBlock;
    }

    await updateProgress(90);

    await prisma.generatedContent.update({
      where: { id: contentId },
      data: {
        status: 'PENDING',
        format,
        imageUrl,
        caption,
        errorMessage: null,
      },
    });

    await updateProgress(100);

    return {
      contentId,
      imageUrl,
    };
  } catch (error) {
    const message = error?.message || 'Image generation failed';
    await markFailed(contentId, message);
    throw error;
  }
}

export function startGenerationWorker() {
  if (generationWorker) {
    return generationWorker;
  }

  const workerConnection = new IORedis(resolveRedisUrl(), buildUpstashRedisOptions());

  generationWorker = new Worker(
    'generation',
    async (job) => processGenerationJob(job.data, { updateProgress: (value) => job.updateProgress(value) }),
    {
      connection: workerConnection,
    },
  );

  generationWorker.on('error', (error) => {
    console.error('[generation-worker] Worker error:', error);
  });

  generationWorker.on('failed', (job, error) => {
    console.error(`[generation-worker] Job ${job?.id || 'unknown'} failed:`, error?.message || error);
  });

  generationWorker.on('closed', () => {
    workerConnection.disconnect();
  });

  return generationWorker;
}
