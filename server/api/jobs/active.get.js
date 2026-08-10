import { shouldUseQueue } from '../../utils/queueMode.js';

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

async function buildProgressByContentId(contentIds) {
  if (!shouldUseQueue() || !contentIds.length) {
    return new Map();
  }

  const { getGenerationQueue } = await import('../../utils/queue.js');
  const queue = getGenerationQueue();
  const queueJobs = await queue.getJobs(['waiting', 'active', 'delayed']);

  const progressByContentId = new Map();

  for (const job of queueJobs) {
    const contentId = String(job?.data?.contentId || '').trim();
    if (!contentId || !contentIds.includes(contentId)) {
      continue;
    }

    const rawProgress = typeof job?.progress === 'number'
      ? job.progress
      : Number(job?.progress || 0);
    const boundedProgress = Number.isFinite(rawProgress)
      ? Math.max(0, Math.min(100, Math.round(rawProgress)))
      : 0;

    progressByContentId.set(contentId, {
      jobId: job?.id ? String(job.id) : null,
      progress: boundedProgress,
    });
  }

  return progressByContentId;
}

export default defineEventHandler(async (event) => {
  const prisma = await getPrisma();
  const authModule = await import('../../utils/auth.js');
  const user = await authModule.requireAuthUser(event);
  const userId = user.id;

  const jobs = await prisma.generatedContent.findMany({
    where: {
      status: 'PROCESSING',
      influencer: {
        is: { userId },
      },
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      influencerId: true,
      format: true,
      platform: true,
      status: true,
      createdAt: true,
      influencer: {
        select: {
          id: true,
          name: true,
          niche: true,
        },
      },
    },
  });

  const contentIds = jobs.map((job) => String(job.id));
  const progressByContentId = await buildProgressByContentId(contentIds);

  return jobs.map((job) => {
    const progressData = progressByContentId.get(String(job.id));
    return {
      ...job,
      jobId: progressData?.jobId || null,
      progress: progressData?.progress ?? 0,
    };
  });
});
