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

  return jobs;
});
