import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { processGenerationJob } from '../../utils/generationWorker.js';

let prismaClient;
let variablesCache;

async function getPrisma() {
  if (prismaClient) return prismaClient;

  const module = await import('../../utils/prisma.js');
  prismaClient = module?.prisma || module?.default?.prisma;

  if (!prismaClient) {
    throw new Error('Unable to resolve prisma client from server/utils/prisma.js');
  }

  return prismaClient;
}

function derivePlatformAndFormat(calendarStep) {
  const step = Number(calendarStep) || 1;
  const index = ((step - 1) % 3 + 3) % 3;

  if (index === 1) {
    return { platform: 'INSTAGRAM', format: 'STORY' };
  }

  if (index === 2) {
    return { platform: 'TIKTOK', format: 'REEL' };
  }

  return { platform: 'INSTAGRAM', format: 'FEED' };
}

function derivePlatformAndFormatFromContentType(contentType) {
  const normalized = String(contentType || '').trim().toLowerCase();

  if (normalized === 'story') {
    return { platform: 'INSTAGRAM', format: 'STORY' };
  }

  if (normalized === 'reel') {
    return { platform: 'TIKTOK', format: 'REEL' };
  }

  if (normalized === 'feed') {
    return { platform: 'INSTAGRAM', format: 'FEED' };
  }

  return null;
}

function randomItem(list) {
  if (!Array.isArray(list) || list.length === 0) {
    return '';
  }
  return list[Math.floor(Math.random() * list.length)] || '';
}

async function getVariables() {
  if (variablesCache) {
    return variablesCache;
  }

  const filePath = resolve(process.cwd(), 'server', 'data', 'variables.json');
  const raw = await readFile(filePath, 'utf-8');
  variablesCache = JSON.parse(raw);
  return variablesCache;
}

function detectCategoryByKeyword(sourceData, keyword) {
  const normalizedKeyword = String(keyword || '').trim().toLowerCase();
  if (!normalizedKeyword || !sourceData || typeof sourceData !== 'object') {
    return 'lifestyle';
  }

  for (const [category, values] of Object.entries(sourceData)) {
    if (!Array.isArray(values)) {
      continue;
    }

    const found = values.some((value) => String(value || '').trim().toLowerCase() === normalizedKeyword);
    if (found) {
      return category;
    }
  }

  return 'lifestyle';
}

async function resolveConceptFromPinterestPayload(body) {
  const workflowType = String(body?.workflowType || '').trim().toLowerCase();
  const contentType = String(body?.contentType || '').trim().toLowerCase();
  const source = String(body?.source || '').trim();
  const keyword = String(body?.keyword || '').trim();

  if (workflowType !== 'pinterest' || !contentType || !source || !keyword) {
    return null;
  }

  const variables = await getVariables();
  const outfits = Array.isArray(variables?.outfits) ? variables.outfits : [];
  const poses = Array.isArray(variables?.poses) ? variables.poses : [];
  const moods = Array.isArray(variables?.moods) ? variables.moods : [];
  const lighting = Array.isArray(variables?.lighting) ? variables.lighting : [];

  let resolvedKeyword = keyword;
  let resolvedTagCategory = 'lifestyle';

  if (source === 'pinterest_tags') {
    const pinterestTags = variables?.pinterest_tags && typeof variables.pinterest_tags === 'object'
      ? variables.pinterest_tags
      : {};

    if (keyword in pinterestTags) {
      resolvedKeyword = String(pinterestTags[keyword] || '').trim() || keyword;
    } else {
      const matchedEntry = Object.entries(pinterestTags).find(
        ([locationKey, tagValue]) => String(tagValue || '').trim().toLowerCase() === keyword.toLowerCase()
          || String(locationKey || '').trim().toLowerCase() === keyword.toLowerCase(),
      );

      if (matchedEntry) {
        resolvedKeyword = String(matchedEntry[1] || '').trim() || keyword;
      }
    }
  }

  if (source === 'relevant_keywords') {
    resolvedTagCategory = detectCategoryByKeyword(variables?.relevant_keywords, keyword);
  }

  if (source === 'pinterest_video_tags_reel') {
    resolvedTagCategory = detectCategoryByKeyword(variables?.pinterest_video_tags_reel, keyword);
  }

  if (source === 'pinterest_video_tags_story') {
    resolvedTagCategory = detectCategoryByKeyword(variables?.pinterest_video_tags_story, keyword);
  }

  return {
    location: resolvedKeyword,
    outfit: randomItem(outfits),
    pose: randomItem(poses),
    mood: randomItem(moods),
    lighting: randomItem(lighting),
    tagCategory: resolvedTagCategory,
  };
}

function shouldUseQueue() {
  const rawValue = String(process.env.USE_QUEUE || '').trim().toLowerCase();
  return rawValue === 'true' || rawValue === '1' || rawValue === 'yes';
}

export default defineEventHandler(async (event) => {
  try {
    const prisma = await getPrisma();
    const body = await readBody(event);
    const {
      influencerId,
      contentType,
      workflowType,
      source,
      keyword,
    } = body || {};
    const normalizedContentType = String(contentType || '').trim().toLowerCase();

    let {
      location,
      outfit,
      pose,
      mood,
      lighting,
      tagCategory,
    } = body || {};

    if (!location || !outfit || !pose || !mood || !lighting) {
      const resolvedConcept = await resolveConceptFromPinterestPayload({
        workflowType,
        contentType,
        source,
        keyword,
      });

      if (resolvedConcept) {
        location = location || resolvedConcept.location;
        outfit = outfit || resolvedConcept.outfit;
        pose = pose || resolvedConcept.pose;
        mood = mood || resolvedConcept.mood;
        lighting = lighting || resolvedConcept.lighting;
        tagCategory = tagCategory || resolvedConcept.tagCategory;
      }
    }

    const normalizedWorkflowType = String(workflowType || '').trim().toLowerCase();
    const isPinterestWorkflow = normalizedWorkflowType === 'pinterest';

    if (!influencerId) {
      return sendError(
        event,
        createError({
          statusCode: 400,
          statusMessage: 'Missing required field: influencerId',
        }),
      );
    }

    if (isPinterestWorkflow && !String(keyword || '').trim()) {
      return sendError(
        event,
        createError({
          statusCode: 400,
          statusMessage: 'Missing required field for pinterest workflow: keyword',
        }),
      );
    }

    if (!isPinterestWorkflow && (!location || !outfit || !pose || !mood || !lighting)) {
      return sendError(
        event,
        createError({
          statusCode: 400,
          statusMessage: 'Missing required fields: location, outfit, pose, mood, lighting',
        }),
      );
    }

    const influencer = await prisma.influencer.findUnique({
      where: { id: influencerId },
      select: {
        id: true,
        name: true,
        faceRefPath: true,
        calendarStep: true,
      },
    });

    if (!influencer) {
      return sendError(event, createError({ statusCode: 404, statusMessage: 'Influencer not found' }));
    }

    const explicitContentFormat = derivePlatformAndFormatFromContentType(normalizedContentType);
    const { platform, format } = explicitContentFormat || derivePlatformAndFormat(influencer.calendarStep);

    const generatedContent = await prisma.generatedContent.create({
      data: {
        influencerId: influencer.id,
        platform,
        format,
        status: 'PROCESSING',
      },
    });

    const jobPayload = {
      influencerId,
      location,
      outfit,
      pose,
      mood,
      lighting,
      tagCategory,
      workflowType,
      contentType,
      source,
      keyword,
      contentId: generatedContent.id,
    };

    if (!shouldUseQueue()) {
      await processGenerationJob(jobPayload);
      return {
        jobId: null,
        contentId: generatedContent.id,
        status: 'completed',
      };
    }

    const { queue } = await import('../../utils/queue.js');
    const job = await queue.add(
      'generate-image',
      jobPayload,
      {
        removeOnComplete: 100,
        removeOnFail: 100,
      },
    );

    return {
      jobId: String(job.id),
      contentId: generatedContent.id,
      status: 'processing',
    };
  } catch (err) {
    const message = err?.message || ''
    const isMissingFaceRef = message.includes('Face reference file not found')
      || message.includes('Influencer face reference is missing')
    const isPinterestSourceMissing = message.includes('No Pinterest video found for query:')
      || message.includes('No Pinterest image found for query:')
    const isPinterestTimeout = message.includes('page.goto: Timeout')
      || message.includes('navigating to "https://www.pinterest.com')
    const isTempFileGone = (err?.code === 'ENOENT' || message.includes('ENOENT'))
      && (message.includes('storage\\temp') || message.includes('storage/temp'))
    const networkCode = String(err?.code || '').toUpperCase()
    const networkMessage = String(message || '').toUpperCase()
    const isNetworkReset = networkCode === 'ECONNRESET'
      || networkCode === 'ETIMEDOUT'
      || networkCode === 'ECONNREFUSED'
      || networkCode === 'ENOTFOUND'
      || networkMessage.includes('ECONNRESET')
      || networkMessage.includes('UND_ERR_CONNECT_TIMEOUT')

    if (isMissingFaceRef) {
      return sendError(
        event,
        createError({
          statusCode: 409,
          statusMessage: 'Face reference introuvable sur ce poste. Re-uploadez la face ref.',
          data: {
            name: err?.name,
            code: err?.code,
            message: err?.message,
          },
        }),
      )
    }

    if (isNetworkReset) {
      return sendError(
        event,
        createError({
          statusCode: 503,
          statusMessage: 'Network error during external API call (possible firewall/proxy restriction)',
          data: {
            name: err?.name,
            code: err?.code,
            message: err?.message,
            status: err?.status,
          },
        }),
      )
    }

    if (isPinterestSourceMissing) {
      return sendError(
        event,
        createError({
          statusCode: 422,
          statusMessage: 'No Pinterest media found for this keyword. Try another keyword.',
          data: {
            name: err?.name,
            code: err?.code,
            message: err?.message,
            status: err?.status,
          },
        }),
      )
    }

    if (isPinterestTimeout) {
      return sendError(
        event,
        createError({
          statusCode: 504,
          statusMessage: 'Pinterest request timed out. Retry in a few seconds.',
          data: {
            name: err?.name,
            code: err?.code,
            message: err?.message,
            status: err?.status,
          },
        }),
      )
    }

    if (isTempFileGone) {
      return sendError(
        event,
        createError({
          statusCode: 503,
          statusMessage: 'Source video introuvable (fichier temporaire supprimé). Relancez la génération.',
          data: {
            name: err?.name,
            code: err?.code,
            message: err?.message,
          },
        }),
      )
    }

    return sendError(
      event,
      createError({
        statusCode: 500,
        statusMessage: 'Image generation failed',
        data: {
          name: err?.name,
          code: err?.code,
          message: err?.message,
          status: err?.status,
        },
      }),
    );
  }
});
