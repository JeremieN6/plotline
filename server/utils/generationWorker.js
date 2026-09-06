import fs from 'node:fs/promises';
import path from 'node:path';

import IORedis from 'ioredis';
import { Anthropic } from '@anthropic-ai/sdk';
import { Worker } from 'bullmq';

import { buildGenerationPrompt } from './buildGenerationPrompt.js';
import { isBlobStorageEnabled, uploadPublicMediaBuffer } from './blobStorage.js';
import { checkMinDuration, extractBestFrame } from './frameExtractor.js';
import { finalizeContentWithVersion } from './contentVersions.js';
import { readImageSourceBuffer, resolveFaceRefAbsolutePath } from './faceRefReader.js';
import { generateImageFromGeminiWithSafetyFallback } from './geminiImageGeneration.js';
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

// Au-dela, on considere que la file est inutilisable et on arrete le worker.
const MAX_CONSECUTIVE_WORKER_ERRORS = 20;
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

function extFromMime(mimeType) {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType === 'image/gif') return 'gif';
  return 'jpg';
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

async function persistContentRecord(prisma, contentId, data, options = {}) {
  // Passe par finalizeContentWithVersion pour qu un rendu reussi soit archive
  // dans l historique et puisse etre repris si le suivant deplait.
  if (data?.status === 'PENDING' && data?.imageUrl) {
    await finalizeContentWithVersion(prisma, contentId, data, options);
    return;
  }

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
      gender: influencer.gender,
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
    return await prisma.profile.findUnique({
      where: { id: influencerId },
      select: {
        id: true,
        name: true,
        silhouette: true,
        gender: true,
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

    const legacy = await prisma.profile.findUnique({
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
      gender: 'FEMALE',
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
          gender: influencer.gender,
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
          gender: influencer.gender,
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
        gender: influencer.gender,
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

      if (!useFaceRefForGeneration || normalizedWorkflow === 'free') {
        // Pas de personne exigée quand: aucun ambassadeur/face ref n'est utilisé (profil
        // marque/activité, ou mode "sans ambassadrice"), OU quand le prompt vient du
        // workflow libre (Studio) — un prompt libre peut légitimement décrire une scène
        // sans portrait unique (groupe, avant/après, produit, etc.), contrairement aux
        // workflows structurés (pinterest, wizard) conçus pour un portrait de personnage.
        validation = { pass: true, personCount: 0, upperBodyVisible: false, reason: '' };
        break;
      }

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

    await finalizeContentWithVersion(
      prisma,
      contentId,
      {
        status: 'PENDING',
        format,
        imageUrl,
        caption,
        errorMessage: null,
      },
      { generationModel: 'gemini-3-pro-image-preview' },
    );

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

  // Une panne definitive (quota Redis epuise, identifiants refuses) ne se resout
  // pas en reessayant: BullMQ relance sa lecture bloquante en boucle et inonde
  // les logs — 11 000 lignes identiques observees en quelques minutes. On coupe
  // le worker et on le dit une fois, au lieu de masquer le reste du terminal.
  let consecutiveErrors = 0;

  generationWorker.on('error', (error) => {
    const message = String(error?.message || error);
    const isFatal = /max requests limit exceeded|WRONGPASS|NOAUTH|invalid password/i.test(message);

    consecutiveErrors += 1;

    if (isFatal || consecutiveErrors >= MAX_CONSECUTIVE_WORKER_ERRORS) {
      console.error(
        `[generation-worker] Arret du worker apres une erreur ${isFatal ? 'definitive' : 'repetee'}: ${message}`,
      );
      console.error('[generation-worker] La generation continue sans file d attente. Mettre USE_QUEUE=false pour ne plus demarrer le worker.');

      const stopping = generationWorker;
      generationWorker = null;
      stopping?.close().catch(() => {});
      return;
    }

    console.error('[generation-worker] Worker error:', message);
  });

  generationWorker.on('completed', () => {
    consecutiveErrors = 0;
  });

  generationWorker.on('failed', (job, error) => {
    console.error(`[generation-worker] Job ${job?.id || 'unknown'} failed:`, error?.message || error);
  });

  generationWorker.on('closed', () => {
    workerConnection.disconnect();
  });

  return generationWorker;
}
