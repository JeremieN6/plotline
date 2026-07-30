import fs from 'node:fs/promises';
import path from 'node:path';

import IORedis from 'ioredis';
import { GoogleGenAI, Modality } from '@google/genai';
import { Anthropic } from '@anthropic-ai/sdk';
import { Worker } from 'bullmq';

import { buildGenerationPrompt } from './buildGenerationPrompt.js';
import { isAbsoluteHttpUrl, isBlobStorageEnabled, uploadPublicMediaBuffer } from './blobStorage.js';
import { checkMinDuration, extractBestFrame } from './frameExtractor.js';
import { imageToJson } from './imageToJson.js';
import { describeHairFromImageSource } from './hairReference.js';
import {
  detectFaceVisible,
  detectPersonInImage,
  detectUpperBodyVisible,
  extractMimeTypeFromPath,
  validateBodyProportions,
  validatePersonAndUpperBody,
} from './imageValidation.js';
import { buildDefaultBodyInstruction, injectBody } from './injectBody.js';
import { generateVideoMotionControl } from './klingGenerator.js';
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
const DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-4-6';

function getAnthropicModel() {
  return String(process.env.ANTHROPIC_MODEL || process.env.anthropicModel || DEFAULT_ANTHROPIC_MODEL).trim();
}

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

function buildMotionPrompt(sceneJson) {
  const location = sceneJson?.global_context?.scene_description
    || sceneJson?.scene?.location
    || sceneJson?.location
    || 'an aesthetic lifestyle scene';
  const ambiance = sceneJson?.global_context?.weather_atmosphere
    || sceneJson?.mood
    || sceneJson?.atmosphere
    || 'natural relaxed energy';
  const movement = sceneJson?.subject?.pose?.gesture
    || sceneJson?.subject?.pose
    || 'subtle natural movement';

  return `${location}, ${ambiance}, ${movement}.`;
}

async function resolveHairPromptFromInfluencer(influencer) {
  const hairPrompt = String(influencer?.hairPrompt || '').trim();
  if (hairPrompt) {
    return hairPrompt;
  }

  const faceRefPath = String(influencer?.faceRefPath || '').trim();
  if (!faceRefPath) {
    return '';
  }

  try {
    return String(await describeHairFromImageSource(faceRefPath, resolveFaceRefAbsolutePath) || '').trim();
  } catch {
    return '';
  }
}

async function readBinaryAsset(assetPath) {
  const absolutePath = path.resolve(String(assetPath || ''));
  return {
    buffer: await fs.readFile(absolutePath),
    mimeType: extractMimeTypeFromPath(absolutePath),
  };
}

async function generateCaption({ anthropicApiKey, influencerName, contentType, sceneDescription, fallbackCaption }) {
  if (!anthropicApiKey) {
    return fallbackCaption;
  }

  try {
    const anthropic = new Anthropic({ apiKey: anthropicApiKey });
    const captionPrompt = PROMPT_CAPTION_CONTEXTUALIZED.replace('{influencer_name}', influencerName)
      .replace('{content_type}', contentType)
      .replace('{scene_description}', sceneDescription);

    const captionResponse = await anthropic.messages.create({
      model: getAnthropicModel(),
      max_tokens: 300,
      messages: [{ role: 'user', content: captionPrompt }],
    });

    const textPart = captionResponse.content?.find((part) => part.type === 'text');
    return (textPart?.text || '').trim() || fallbackCaption;
  } catch {
    return fallbackCaption;
  }
}

async function persistGeneratedVideo(localVideoPath) {
  const extension = path.extname(localVideoPath) || '.mp4';
  const normalizedExtension = extension.replace(/^\./, '') || 'mp4';

  if (isBlobStorageEnabled()) {
    const buffer = await fs.readFile(localVideoPath);
    const uploaded = await uploadPublicMediaBuffer('generated', normalizedExtension, buffer, 'video/mp4');
    return {
      imageUrl: uploaded.url,
      localPath: null,
    };
  }

  const generatedDir = getGeneratedDir();
  const filename = `video_${Date.now()}${extension}`;
  const generatedPath = path.join(generatedDir, filename);
  await fs.copyFile(localVideoPath, generatedPath);
  return {
    imageUrl: toMediaUrl('generated', filename),
    localPath: generatedPath,
  };
}

async function persistContentRecord(prisma, contentId, data) {
  await prisma.generatedContent.update({
    where: { id: contentId },
    data,
  });
}

async function finalizeStoryVideo({ prisma, contentId, influencer, anthropicApiKey, sourceVideoPath, keyword, sceneDescription }) {
  const persistedVideo = await persistGeneratedVideo(sourceVideoPath);
  const fallbackCaption = `Ambiance du jour autour de ${String(keyword || '').trim() || 'cette vibe'} ✨\n\n#story #instagram #vibes`;
  const caption = await generateCaption({
    anthropicApiKey,
    influencerName: influencer.name,
    contentType: 'story',
    sceneDescription: sceneDescription || `Video ambiance inspired by ${String(keyword || '').trim() || 'today'}`,
    fallbackCaption,
  });

  await persistContentRecord(prisma, contentId, {
    status: 'PENDING',
    format: 'STORY',
    imageUrl: persistedVideo.imageUrl,
    caption,
    errorMessage: null,
  });

  return persistedVideo;
}

async function runReelWorkflow({
  prisma,
  contentId,
  influencer,
  anthropicApiKey,
  bodyPrompt,
  hairPrompt,
  keyword,
  tagCategory,
  faceRefMime,
  faceRefBase64,
}) {
  const MAX_REEL_SCRAPE_ATTEMPTS = 3;
  let sourceVideoPath = '';
  let framePath = '';
  let fallbackStoryVideoPath = '';
  let madisonImagePath = '';
  let reelVideoPath = '';

  try {
    let selectedDuration = 0;

    for (let attempt = 1; attempt <= MAX_REEL_SCRAPE_ATTEMPTS; attempt += 1) {
      sourceVideoPath = await scrapePinterestVideo(keyword);
      if (!sourceVideoPath) {
        continue;
      }

      let duration;
      try {
        duration = await checkMinDuration(sourceVideoPath);
      } catch (videoRejectionError) {
        // checkMinDuration throws for boomerangs and short-shot videos.
        await fs.unlink(sourceVideoPath).catch(() => {});
        sourceVideoPath = '';
        continue;
      }

      if (duration < 3) {
        await fs.unlink(sourceVideoPath).catch(() => {});
        sourceVideoPath = '';
        continue;
      }

      // Only keep the first video that passed the duration check as fallback.
      // Don't overwrite with a later video — the earlier one may already be deleted.
      if (!fallbackStoryVideoPath) {
        fallbackStoryVideoPath = sourceVideoPath;
      }

      framePath = await extractBestFrame(sourceVideoPath);
      const frameAsset = await readBinaryAsset(framePath);

      const hasPerson = await detectPersonInImage(frameAsset.buffer, frameAsset.mimeType);
      const hasFace = await detectFaceVisible(frameAsset.buffer, frameAsset.mimeType);
      const hasUpperBody = await detectUpperBodyVisible(frameAsset.buffer, frameAsset.mimeType);

      if (hasPerson && hasFace && hasUpperBody) {
        selectedDuration = duration;
        break;
      }

      await fs.unlink(framePath).catch(() => {});
      framePath = '';
      // Only delete sourceVideoPath if it is not the fallback we are keeping for story mode.
      if (sourceVideoPath !== fallbackStoryVideoPath) {
        await fs.unlink(sourceVideoPath).catch(() => {});
      }
      sourceVideoPath = '';
    }

    if (!sourceVideoPath || !framePath) {
      if (!fallbackStoryVideoPath) {
        throw new Error(`No Pinterest video found for query: ${keyword}`);
      }

      const persisted = await finalizeStoryVideo({
        prisma,
        contentId,
        influencer,
        anthropicApiKey,
        sourceVideoPath: fallbackStoryVideoPath,
        keyword,
        sceneDescription: `Atmospheric Pinterest story around ${String(keyword || '').trim() || 'this vibe'}`,
      });
      return { contentId, imageUrl: persisted.imageUrl };
    }

    const sceneJson = injectBody(await imageToJson(framePath), {
      silhouette: influencer.silhouette,
      identityProfile: influencer.identityProfile,
      influencerName: influencer.name,
      bodyPrompt,
      hairPrompt,
    });

    const prompt = PROMPT_JSON_TO_PRO_IMAGE.replace('{scene_json}', JSON.stringify(sceneJson, null, 2));
    const geminiParts = [
      {
        inlineData: {
          mimeType: faceRefMime,
          data: faceRefBase64,
        },
      },
    ];

    // Generate character image and validate: exactly 1 person + upper body visible.
    // validatePersonAndUpperBody returns { pass, personCount, upperBodyVisible, reason }.
    // Up to 3 attempts — proceed with best result if all fail.
    const MAX_CHARACTER_ATTEMPTS = 3;
    let madisonInlineData = await generateImageFromGeminiWithSafetyFallback(prompt, geminiParts);
    let madisonMime = madisonInlineData.mimeType || 'image/jpeg';
    let madisonBuffer = Buffer.from(madisonInlineData.data, 'base64');
    let characterValidation = await validatePersonAndUpperBody(madisonBuffer, madisonMime);

    for (let attempt = 2; attempt <= MAX_CHARACTER_ATTEMPTS && !characterValidation.pass; attempt += 1) {
      madisonInlineData = await generateImageFromGeminiWithSafetyFallback(prompt, geminiParts);
      madisonMime = madisonInlineData.mimeType || 'image/jpeg';
      madisonBuffer = Buffer.from(madisonInlineData.data, 'base64');
      characterValidation = await validatePersonAndUpperBody(madisonBuffer, madisonMime);
    }

    const madisonExtension = extFromMime(madisonMime);
    const madisonFilename = `reel_character_${Date.now()}.${madisonExtension}`;
    madisonImagePath = path.join(getGeneratedDir(), madisonFilename);
    await fs.writeFile(madisonImagePath, madisonBuffer);

    const motionPrompt = buildMotionPrompt(sceneJson);
    reelVideoPath = await generateVideoMotionControl(madisonImagePath, sourceVideoPath, motionPrompt);
    const persistedVideo = await persistGeneratedVideo(reelVideoPath);

    const resolvedTagCategory = String(tagCategory || 'lifestyle').trim().toLowerCase();
    const hashtagBlock = HASHTAG_BLOCKS[resolvedTagCategory] || HASHTAG_BLOCKS.lifestyle || '';
    let caption = await generateCaption({
      anthropicApiKey,
      influencerName: influencer.name,
      contentType: 'reel',
      sceneDescription: formatSceneDescription({
        location: sceneJson?.global_context?.scene_description || sceneJson?.scene?.location || keyword,
        outfit: sceneJson?.subject?.clothing?.outfit_description || sceneJson?.subject?.wardrobe?.top || '',
        pose: sceneJson?.subject?.pose?.gesture || sceneJson?.subject?.pose || '',
        mood: sceneJson?.global_context?.weather_atmosphere || '',
        lighting: sceneJson?.global_context?.lighting?.quality || sceneJson?.scene?.lighting?.type || '',
      }),
      fallbackCaption: `Serving a new motion moment around ${String(keyword || '').trim() || 'this scene'}.`,
    });

    if (hashtagBlock) {
      caption = `${caption}\n\n${hashtagBlock}`;
    }

    await persistContentRecord(prisma, contentId, {
      status: 'PENDING',
      format: 'REEL',
      imageUrl: persistedVideo.imageUrl,
      caption,
      errorMessage: null,
    });

    return {
      contentId,
      imageUrl: persistedVideo.imageUrl,
      duration: selectedDuration,
    };
  } finally {
    if (framePath) {
      await fs.unlink(framePath).catch(() => {});
    }
    if (sourceVideoPath) {
      await fs.unlink(sourceVideoPath).catch(() => {});
    }
    if (fallbackStoryVideoPath && fallbackStoryVideoPath !== sourceVideoPath) {
      await fs.unlink(fallbackStoryVideoPath).catch(() => {});
    }
    if (reelVideoPath) {
      await fs.unlink(reelVideoPath).catch(() => {});
    }
  }
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

class ImageSafetyError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ImageSafetyError';
  }
}

class GeminiNoPartsError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'GeminiNoPartsError';
    this.finishReason = String(options.finishReason || '');
  }
}

const SAFETY_REPLACEMENTS = [
  ['Extremely large, very full breasts causing cleavage', 'Full, prominent bust'],
  ['significantly enlarged breasts', 'full bust'],
  ['very full breasts', 'full bust'],
  ['visible cleavage', 'natural neckline'],
  ['Voluptuous hourglass figure with significantly enlarged breasts', 'Hourglass figure with full bust'],
  ['NON-NEGOTIABLE', 'important'],
  ['stretching the top garment', 'filling the top garment'],
  ['stretching the attire', 'filling the attire'],
  ['filling the bikini top', 'complementing the attire'],
  ['cleavage and stretching', 'fitting naturally'],
  ['prominent glutes', 'balanced lower silhouette'],
  ['rounded glutes', 'balanced lower silhouette'],
  ['Pronounced hourglass', 'balanced silhouette'],
  ['full bust', 'natural upper silhouette'],
  ['Hourglass figure with full bust', 'balanced silhouette'],
  ['extreme waist-to-hip ratio', 'balanced proportions'],
  ['wide hips and rounded glutes', 'defined hips'],
];

function sanitizePromptForSafety(prompt) {
  let sanitized = String(prompt || '');

  for (const [from, to] of SAFETY_REPLACEMENTS) {
    sanitized = sanitized.split(from).join(to);
  }

  sanitized = sanitized
    .replace(/significantly enlarged breasts[^.\n]*/gi, 'full bust')
    .replace(/extremely large[^.\n]*breasts[^.\n]*/gi, 'full bust')
    .replace(/causing cleavage[^.\n]*/gi, 'filling the garment')
    .replace(/stretching the (?!top garment)[\w][\w\s]+(?=[.,"\n])/gi, 'filling the attire')
    .replace(/(?:fill|filling) the [\w][\w\s]+(?=[.,"\n])/gi, 'complementing the attire')
    .replace(/voluptuous hourglass figure[^.\n]*/gi, 'balanced silhouette')
    .replace(/full and rounded high-set glutes[^.\n]*/gi, 'rounded hips')
    .replace(/\b(?:glutes?|butt|breasts?|cleavage|busty|buxom)\b/gi, 'silhouette')
    .replace(/\b(?:voluptuous|hourglass|curvy)\b/gi, 'balanced')
    .replace(/\b(?:extremely|very|significantly|prominent|huge|enlarged)\b/gi, 'natural');

  return sanitized;
}

function isRetryableNoPartsFinishReason(finishReason) {
  const normalized = String(finishReason || '').trim().toUpperCase();
  return normalized.includes('IMAGE_OTHER');
}

function isTransientGeminiError(error) {
  const message = String(error?.message || '').toUpperCase();
  return (
    message.includes('500 INTERNAL')
    || message.includes('INTERNAL ERROR ENCOUNTERED')
    || message.includes('503 UNAVAILABLE')
    || message.includes('RESOURCE_EXHAUSTED')
    || message.includes('OVERLOADED')
    || message.includes('TRY AGAIN LATER')
    || message.includes('HIGH DEMAND')
    || message.includes('DEADLINE_EXCEEDED')
  );
}

async function retryWithSanitizedPrompt(prompt, extraParts, error, reasonLabel) {
  const sanitizedPrompt = sanitizePromptForSafety(prompt);
  if (sanitizedPrompt === prompt) {
    throw error;
  }

  console.warn(`[generation-worker] ${reasonLabel}, retrying with sanitized prompt.`);
  return await generateImageFromGemini(sanitizedPrompt, extraParts);
}

function extractInlineDataFromResponse(imageResponse) {
  const candidate = imageResponse?.candidates?.[0];
  const parts = candidate?.content?.parts ?? [];

  if (parts.length === 0) {
    const finishReason = candidate?.finishReason;
    const safetyRatings = JSON.stringify(candidate?.safetyRatings ?? []);

    if (String(finishReason || '').toUpperCase().includes('IMAGE_SAFETY')) {
      throw new ImageSafetyError(
        `Gemini blocked generation for IMAGE_SAFETY. finishReason=${finishReason} safetyRatings=${safetyRatings}`,
      );
    }

    throw new GeminiNoPartsError(
      `Gemini returned no parts. finishReason=${finishReason} safetyRatings=${safetyRatings} rawKeys=${Object.keys(imageResponse ?? {}).join(',')}`,
      { finishReason },
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

async function generateImageFromGeminiWithSafetyFallback(prompt, extraParts = []) {
  try {
    return await generateImageFromGemini(prompt, extraParts);
  } catch (error) {
    if (error instanceof ImageSafetyError) {
      return await retryWithSanitizedPrompt(prompt, extraParts, error, 'IMAGE_SAFETY detected');
    }

    if (isTransientGeminiError(error)) {
      console.warn('[generation-worker] transient Gemini error detected, retrying image generation once.');
      return await generateImageFromGemini(prompt, extraParts);
    }

    if (!(error instanceof GeminiNoPartsError) || !isRetryableNoPartsFinishReason(error.finishReason)) {
      throw error;
    }

    console.warn(`[generation-worker] ${error.finishReason || 'IMAGE_NO_PARTS'} detected, retrying image generation once.`);

    try {
      return await generateImageFromGemini(prompt, extraParts);
    } catch (retryError) {
      if (retryError instanceof ImageSafetyError) {
        return await retryWithSanitizedPrompt(prompt, extraParts, retryError, 'IMAGE_SAFETY detected after no-parts retry');
      }

      if (retryError instanceof GeminiNoPartsError && isRetryableNoPartsFinishReason(retryError.finishReason)) {
        return await retryWithSanitizedPrompt(prompt, extraParts, retryError, `${retryError.finishReason || 'IMAGE_NO_PARTS'} persisted`);
      }

      throw retryError;
    }
  }
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

async function resolveBodyPromptFromInfluencer(influencer) {
  const explicitBodyPrompt = String(influencer?.bodyPrompt || '').trim();
  if (explicitBodyPrompt) {
    return explicitBodyPrompt;
  }

  return buildDefaultBodyInstruction();
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
        silhouette: true,
        faceRefPath: true,
        bodyPrompt: true,
        hairPrompt: true,
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
      },
    });

    if (!legacy) return legacy;
    return {
      ...legacy,
      silhouette: 'VOLUPTUOUS',
      bodyPrompt: null,
      hairPrompt: null,
      identityProfile: 'default',
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
    retryStrategy: (times) => {
      if (times > 8) return null;
      return Math.min(times * 500, 5000);
    },
    reconnectOnError: (err) => {
      const msg = String(err?.message || '').toUpperCase();
      return msg.includes('ECONNRESET') || msg.includes('ETIMEDOUT') || msg.includes('ECONNREFUSED');
    },
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
        prompt: freePrompt,
        withFaceRef,
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
    const hairPrompt = await resolveHairPromptFromInfluencer(influencer);
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY || process.env.anthropicApiKey;

    if (normalizedContentType === 'story') {
      const storyVideoSource = await scrapePinterestVideo(keyword);

      if (!storyVideoSource) {
        throw new Error(`No Pinterest video found for query: ${keyword}`);
      }

      try {
        const persisted = await finalizeStoryVideo({
          prisma,
          contentId,
          influencer,
          anthropicApiKey,
          sourceVideoPath: storyVideoSource,
          keyword,
          sceneDescription: `Video ambiance inspired by ${String(keyword || '').trim() || 'today'}`,
        });

        await updateProgress(65);

        await updateProgress(100);

        return {
          contentId,
          imageUrl: persisted.imageUrl,
        };
      } finally {
        await fs.unlink(storyVideoSource).catch(() => {});
      }
    }

    const requiresFaceRef = withFaceRef !== false;
    const hasFaceRef = Boolean(String(influencer.faceRefPath || '').trim());

    if (requiresFaceRef && !hasFaceRef) {
      throw new Error('Influencer face reference is missing. Upload a face ref first.');
    }

    const useFaceRefForGeneration = requiresFaceRef && hasFaceRef;
    let faceRefMime = '';
    let faceRefBase64 = '';

    if (useFaceRefForGeneration) {
      const faceRefAsset = await readImageSourceBuffer(influencer.faceRefPath);
      const faceRefBuffer = faceRefAsset.buffer;
      faceRefMime = faceRefAsset.mimeType;
      faceRefBase64 = faceRefBuffer.toString('base64');
    }

    if (normalizedContentType === 'reel') {
      if (!useFaceRefForGeneration) {
        throw new Error('Reel generation requires an ambassador with a valid face reference.');
      }

      await updateProgress(20);
      return await runReelWorkflow({
        prisma,
        contentId,
        influencer,
        anthropicApiKey,
        bodyPrompt,
        hairPrompt,
        keyword,
        tagCategory,
        faceRefMime,
        faceRefBase64,
      });
    }

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
        const enrichedSceneJson = injectBody(sceneJson, influencer.silhouette, {
          identityProfile: influencer.identityProfile,
          influencerName: influencer.name,
          bodyPrompt,
          hairPrompt,
        });

        prompt = PROMPT_JSON_TO_PRO_IMAGE.replace('{scene_json}', JSON.stringify(enrichedSceneJson, null, 2));

        // The Pinterest source image is used ONLY for scene JSON extraction (imageToJson above).
        // It must NOT be sent to Gemini during image generation — doing so causes Gemini to
        // reproduce the source instead of generating a new image from the face ref.
        geminiParts = useFaceRefForGeneration
          ? [
              {
                inlineData: {
                  mimeType: faceRefMime,
                  data: faceRefBase64,
                },
              },
            ]
          : [];

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
    } else if (normalizedWorkflow === 'free') {
      const freePromptText = String(freePrompt || '').trim();

      if (!freePromptText) {
        throw new Error('Missing prompt for free workflow');
      }

      const freeSceneJson = injectBody(
        {
          global_context: {
            scene_description: freePromptText,
            weather_atmosphere: 'Natural, realistic lifestyle ambiance',
          },
          scene: {
            location: freePromptText,
            lighting: {
              type: 'natural soft light',
              quality: 'clean instagram photography lighting',
            },
          },
          subject: {
            pose: 'natural candid pose',
            wardrobe: {
              top: 'scene-appropriate outfit aligned with requested style',
            },
          },
          mood: 'authentic, confident, lifestyle',
        },
        {
          silhouette: influencer.silhouette,
          identityProfile: influencer.identityProfile,
          influencerName: influencer.name,
          bodyPrompt,
          hairPrompt,
        },
      );

      prompt = freePromptText;
      geminiParts = useFaceRefForGeneration
        ? [
            {
              inlineData: {
                mimeType: faceRefMime,
                data: faceRefBase64,
              },
            },
          ]
        : [];

      sceneDescriptionConcept = {
        location: freePromptText,
        outfit: freeSceneJson?.subject?.wardrobe?.top || '',
        pose: freeSceneJson?.subject?.pose || '',
        mood: freeSceneJson?.mood || '',
        lighting: freeSceneJson?.scene?.lighting?.type || '',
      };
    } else {
      const concept = { location, outfit, pose, mood, lighting };
      sceneDescriptionConcept = concept;

      const sceneJsonText = buildGenerationPrompt(concept, normalizedContentType, ratio);
      const sceneJson = injectBody(JSON.parse(sceneJsonText), influencer.silhouette, {
        identityProfile: influencer.identityProfile,
        influencerName: influencer.name,
        bodyPrompt,
        hairPrompt,
      });
      prompt = PROMPT_JSON_TO_IMAGE.replace('{scene_json}', JSON.stringify(sceneJson, null, 2));

      geminiParts = useFaceRefForGeneration
        ? [
            {
              inlineData: {
                mimeType: faceRefMime,
                data: faceRefBase64,
              },
            },
          ]
        : [];
    }

    await updateProgress(30);

    let inlineData;
    let imageMime = 'image/jpeg';
    let generatedBuffer = null;
    let validation = { pass: false, reason: '' };

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      inlineData = await generateImageFromGeminiWithSafetyFallback(prompt, geminiParts);
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
        model: getAnthropicModel(),
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
      drainDelay: 30,
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
