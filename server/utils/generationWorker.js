import fs from 'node:fs/promises';
import path from 'node:path';

import IORedis from 'ioredis';
import { GoogleGenAI } from '@google/genai';
import { Anthropic } from '@anthropic-ai/sdk';
import { Worker } from 'bullmq';

import { buildGenerationPrompt } from './buildGenerationPrompt.js';
import { injectBody } from './injectBody.js';
import {
  HASHTAG_BLOCKS,
  PROMPT_CAPTION_CONTEXTUALIZED,
  PROMPT_JSON_TO_IMAGE,
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

function resolvePublicPath(filePathOrPublicUrl) {
  if (!filePathOrPublicUrl) return null;
  if (path.isAbsolute(filePathOrPublicUrl)) return filePathOrPublicUrl;
  if (filePathOrPublicUrl.startsWith('/')) {
    return path.join(process.cwd(), 'public', filePathOrPublicUrl.replace(/^\/+/, ''));
  }
  return path.resolve(process.cwd(), filePathOrPublicUrl);
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

export function startGenerationWorker() {
  if (generationWorker) {
    return generationWorker;
  }

  const workerConnection = new IORedis(resolveRedisUrl(), buildUpstashRedisOptions());

  generationWorker = new Worker(
    'generation',
    async (job) => {
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
      } = job.data || {};

      try {
        await job.updateProgress(10);

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

        const faceRefAbsolutePath = resolvePublicPath(influencer.faceRefPath);
        const faceRefBuffer = await fs.readFile(faceRefAbsolutePath);
        const faceRefMime = mimeFromExt(faceRefAbsolutePath);
        const faceRefBase64 = faceRefBuffer.toString('base64');

        const concept = { location, outfit, pose, mood, lighting };
        const sceneJsonText = buildGenerationPrompt(concept, 'feed', '4:5');
        const sceneJson = injectBody(JSON.parse(sceneJsonText));
        const prompt = PROMPT_JSON_TO_IMAGE.replace('{scene_json}', JSON.stringify(sceneJson, null, 2));

        const geminiKey = process.env.GEMINI_API_KEY;
        if (!geminiKey || geminiKey.trim() === '...' || geminiKey.trim() === '') {
          throw new Error('GEMINI_API_KEY non configuree dans .env');
        }

        await job.updateProgress(30);

        const genai = new GoogleGenAI({ apiKey: geminiKey });
        const imageResponse = await genai.models.generateContent({
          model: 'gemini-2.0-flash',
          contents: [
            {
              role: 'user',
              parts: [
                { text: prompt },
                {
                  inlineData: {
                    mimeType: faceRefMime,
                    data: faceRefBase64,
                  },
                },
              ],
            },
          ],
          config: {
            responseModalities: ['IMAGE', 'TEXT'],
          },
        });

        const parts = imageResponse?.candidates?.[0]?.content?.parts ?? [];
        const imagePart = parts.find((part) => part?.inlineData?.data);
        if (!imagePart) {
          throw new Error('Gemini did not return an image payload');
        }

        await job.updateProgress(65);

        const generatedDir = path.join(process.cwd(), 'public', 'uploads', 'generated');
        await fs.mkdir(generatedDir, { recursive: true });

        const imageMime = imagePart.inlineData.mimeType || 'image/jpeg';
        const extension = extFromMime(imageMime);
        const filename = `generated_${Date.now()}.${extension}`;
        const generatedPath = path.join(generatedDir, filename);

        await fs.writeFile(generatedPath, Buffer.from(imagePart.inlineData.data, 'base64'));
        const imageUrl = `/uploads/generated/${filename}`;

        const anthropicApiKey = process.env.ANTHROPIC_API_KEY || process.env.anthropicApiKey;
        let caption = '';
        const resolvedTagCategory = String(tagCategory || 'lifestyle').trim().toLowerCase();
        const hashtagBlock = HASHTAG_BLOCKS[resolvedTagCategory] || HASHTAG_BLOCKS.lifestyle || '';

        if (anthropicApiKey) {
          const anthropic = new Anthropic({ apiKey: anthropicApiKey });
          const captionPrompt = PROMPT_CAPTION_CONTEXTUALIZED.replace('{influencer_name}', influencer.name)
            .replace('{content_type}', 'feed')
            .replace('{scene_description}', formatSceneDescription(concept));

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

        await job.updateProgress(90);

        await prisma.generatedContent.update({
          where: { id: contentId },
          data: {
            status: 'PENDING',
            imageUrl,
            caption,
            errorMessage: null,
          },
        });

        await job.updateProgress(100);

        return {
          contentId,
          imageUrl,
        };
      } catch (error) {
        const message = error?.message || 'Image generation failed';
        await markFailed(contentId, message);
        throw error;
      }
    },
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
