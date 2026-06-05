import { processGenerationJob } from '../../utils/generationWorker.js';

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

function shouldUseQueue() {
  const rawValue = String(process.env.USE_QUEUE || '').trim().toLowerCase();
  return rawValue === 'true' || rawValue === '1' || rawValue === 'yes';
}

export default defineEventHandler(async (event) => {
  try {
    const prisma = await getPrisma();
    const body = await readBody(event);
    const { influencerId, location, outfit, pose, mood, lighting, tagCategory } = body || {};

    if (!influencerId || !location || !outfit || !pose || !mood || !lighting) {
      return sendError(
        event,
        createError({
          statusCode: 400,
          statusMessage: 'Missing required fields: influencerId, location, outfit, pose, mood, lighting',
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

    const { platform, format } = derivePlatformAndFormat(influencer.calendarStep);

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
