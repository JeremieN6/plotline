import fs from 'node:fs/promises';
import path from 'node:path';

import IORedis from 'ioredis';
import { GoogleGenAI, Modality } from '@google/genai';
import { Anthropic } from '@anthropic-ai/sdk';
import { Worker } from 'bullmq';

import { buildGenerationPrompt } from './buildGenerationPrompt.js';
import { isAbsoluteHttpUrl, isBlobStorageEnabled, uploadPublicMediaBuffer } from './blobStorage.js';
import { imageToJson } from './imageToJson.js';
import { describeBodyFromImageSource } from './bodyReference.js';
import { validatePersonAndUpperBody } from './imageValidation.js';
import { injectBody } from './injectBody.js';
import { getGeneratedDir, toMediaUrl } from './mediaStorage.js';
import { scrapePinterestImage } from './pinterestScraper.js';
import { scrapePinterestVideo } from './pinterestVideoScraper.js';
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
  candidates.push(path.join(process.cwd(), 'public', 'uploads', 'body-refs', basename));
  candidates.push(path.join(process.cwd(), 'storage', 'uploads', 'face-refs', basename));
  candidates.push(path.join(process.cwd(), 'storage', 'uploads', 'body-refs', basename));

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

async function resolveBodyPromptFromInfluencer(influencer) {
  const explicitBodyPrompt = String(influencer?.bodyPrompt || '').trim();
  if (explicitBodyPrompt) {
    return explicitBodyPrompt;
  }

  const bodyRefPath = String(influencer?.bodyRefPath || '').trim();
  if (!bodyRefPath) {
    return '';
  }

  try {
    const inferred = await describeBodyFromImageSource(bodyRefPath, resolveFaceRefAbsolutePath);
    return String(inferred || '').trim();
  } catch {
    return '';
  }
}

function isMissingColumnError(err) {
  if (err?.code === 'P2022') return true;
  const message = String(err?.message || '').toLowerCase();
  return message.includes('column') && message.includes('does not exist');
}

function isUnknownFieldSelectError(err) {
  const message = String(err?.message || '').toLowerCase();
  return message.includes('unknown field') && message.includes('for select statement on model');
}

async function findInfluencerForGeneration(prisma, influencerId) {
  try {
    return await prisma.influencer.findUnique({
      where: { id: influencerId },
      select: {
        id: true,
        name: true,
        faceRefPath: true,
        bodyRefPath: true,
        bodyPrompt: true,
        identityProfile: true,
      },
    });
  } catch (err) {
    if (!isMissingColumnError(err) && !isUnknownFieldSelectError(err)) {
      throw err;
    }

    const legacy = await prisma.influencer.findUnique({
      where: { id: influencerId },
      select: {
        id: true,
        name: true,
        faceRefPath: true,
        bodyRefPath: true,
        identityProfile: true,
      },
    });

    if (!legacy) return legacy;
    return {
      ...legacy,
      bodyPrompt: null,
      identityProfile: String(legacy.identityProfile || 'default'),
    };
  }
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

    const influencer = await findInfluencerForGeneration(prisma, influencerId);

    if (!influencer) {
      throw new Error('Influencer not found');
    }

    const { format, ratio, contentType: normalizedContentType } = resolveFormatAndRatio(contentType);
    const bodyPrompt = await resolveBodyPromptFromInfluencer(influencer);
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY || process.env.anthropicApiKey;

    if (normalizedContentType === 'story') {
      const storyVideoSource = await scrapePinterestVideo(keyword);

      if (!storyVideoSource) {
        throw new Error(`No Pinterest video found for query: ${keyword}`);
      }

      try {
        const generatedDir = getGeneratedDir();
        const filename = `video_${Date.now()}.mp4`;
        const generatedPath = path.join(generatedDir, filename);
        await fs.copyFile(storyVideoSource, generatedPath);

        const fallbackCaption = `Ambiance du jour autour de ${String(keyword || '').trim() || 'cette vibe'} ✨\n\n#story #instagram #vibes`;
        let caption = fallbackCaption;

        if (anthropicApiKey) {
          try {
            const anthropic = new Anthropic({ apiKey: anthropicApiKey });
            const captionPrompt = `Tu es le social media manager de ${influencer.name}. Écris une caption Instagram courte (1-2 lignes max + 3 hashtags) pour une story vidéo d'ambiance. Keyword : ${String(keyword || '').trim()}. Retourne uniquement la caption.`;

            const captionResponse = await anthropic.messages.create({
              model: 'claude-sonnet-4-20250514',
              max_tokens: 150,
              messages: [{ role: 'user', content: captionPrompt }],
            });

            const textPart = captionResponse.content?.find((part) => part.type === 'text');
            const generatedCaption = (textPart?.text || '').trim();
            if (generatedCaption) {
              caption = generatedCaption;
            }
          } catch {
            // Keep the deterministic fallback caption.
          }
        }

        const imageUrl = toMediaUrl('generated', filename);

        await updateProgress(65);

        await prisma.generatedContent.update({
          where: { id: contentId },
          data: {
            status: 'PENDING',
            format: 'STORY',
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
      } finally {
        await fs.unlink(storyVideoSource).catch(() => {});
      }
    }

    if (!influencer.faceRefPath) {
      throw new Error('Influencer face reference is missing. Upload a face ref first.');
    }

    const faceRefAsset = await readImageSourceBuffer(influencer.faceRefPath);
    const faceRefBuffer = faceRefAsset.buffer;
    const faceRefMime = faceRefAsset.mimeType;
    const faceRefBase64 = faceRefBuffer.toString('base64');

    const normalizedWorkflow = String(workflowType || '').trim().toLowerCase();
    let prompt;
    let geminiParts;
    let sceneDescriptionConcept;
    let scrapedImagePath;

    if (normalizedWorkflow === 'pinterest') {
      scrapedImagePath = await scrapePinterestImage(keyword);

      if (!scrapedImagePath) {
        throw new Error(`No Pinterest image found for query: ${keyword}`);
      }

      try {
        const sceneJson = await imageToJson(scrapedImagePath);
        const enrichedSceneJson = injectBody(sceneJson, {
          identityProfile: influencer.identityProfile,
          influencerName: influencer.name,
          bodyPrompt,
        });

        prompt = PROMPT_JSON_TO_PRO_IMAGE.replace('{scene_json}', JSON.stringify(enrichedSceneJson, null, 2));

        // The Pinterest source image is used ONLY for scene JSON extraction (imageToJson above).
        // It must NOT be sent to Gemini during image generation — doing so causes Gemini to
        // reproduce the source instead of generating a new image from the face ref.
        geminiParts = [
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
      } finally {
        await fs.unlink(scrapedImagePath).catch(() => {});
      }
    } else {
      const concept = { location, outfit, pose, mood, lighting };
      sceneDescriptionConcept = concept;

      const sceneJsonText = buildGenerationPrompt(concept, normalizedContentType, ratio);
      const sceneJson = injectBody(JSON.parse(sceneJsonText), {
        identityProfile: influencer.identityProfile,
        influencerName: influencer.name,
        bodyPrompt,
      });
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

    let inlineData;
    let imageMime = 'image/jpeg';
    let generatedBuffer = null;
    let validation = { pass: false, reason: '' };

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      inlineData = await generateImageFromGemini(prompt, geminiParts);
      imageMime = inlineData.mimeType || 'image/jpeg';
      generatedBuffer = Buffer.from(inlineData.data, 'base64');

      validation = await validatePersonAndUpperBody(generatedBuffer, imageMime);
      if (validation.pass) {
        break;
      }

      if (attempt === 3) {
        throw new Error(
          `Generated image failed validation (person_count=1 and upper body visible required). Reason: ${validation.reason || 'unknown'}`,
        );
      }
    }

    await updateProgress(65);
    const extension = extFromMime(imageMime);

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
