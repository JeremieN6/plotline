let prismaClient;

async function getPrisma() {
  if (prismaClient) return prismaClient;

  const module = await import('../utils/prisma.js');
  prismaClient = module?.prisma || module?.default?.prisma;

  if (!prismaClient) {
    throw new Error('Unable to resolve prisma client from server/utils/prisma.js');
  }

  return prismaClient;
}

export default defineEventHandler(async (event) => {
  const prisma = await getPrisma();
  const authModule = await import('../utils/auth.js');
  const user = await authModule.requireAuthUser(event);
  const userId = user.id;
  const now = new Date();
  const upcomingCutoff = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 45);
  const query = getQuery(event);
  const campaignId = String(query.campaignId || '').trim();

  const campaignFilter = campaignId
    ? { campaignId }
    : {};

  const [campaigns, influencers, pendingContents, upcomingContents, publishedCount, validatedCount] = await Promise.all([
    prisma.campaign.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        objective: true,
        channel: true,
        createdAt: true,
      },
    }),
    prisma.influencer.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        niche: true,
        faceRefPath: true,
        createdAt: true,
        _count: {
          select: {
            generatedContents: true,
          },
        },
      },
    }),
    prisma.generatedContent.findMany({
      where: {
        status: { in: ['PENDING', 'PROCESSING'] },
        influencer: { is: { userId } },
        ...campaignFilter,
      },
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: {
        id: true,
        imageUrl: true,
        caption: true,
        format: true,
        status: true,
        createdAt: true,
        influencerId: true,
        campaignId: true,
        campaign: {
          select: {
            id: true,
            name: true,
            objective: true,
            channel: true,
          },
        },
        influencer: {
          select: {
            id: true,
            name: true,
            niche: true,
          },
        },
      },
    }),
    prisma.generatedContent.findMany({
      where: {
        scheduledAt: {
          gte: now,
          lte: upcomingCutoff,
        },
        influencer: { is: { userId } },
        ...campaignFilter,
      },
      orderBy: { scheduledAt: 'asc' },
      take: 5,
      select: {
        id: true,
        imageUrl: true,
        caption: true,
        format: true,
        status: true,
        scheduledAt: true,
        influencerId: true,
        campaignId: true,
        campaign: {
          select: {
            id: true,
            name: true,
            objective: true,
            channel: true,
          },
        },
        influencer: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    }),
    prisma.generatedContent.count({
      where: {
        status: 'PUBLISHED',
        influencer: { is: { userId } },
        ...campaignFilter,
      },
    }),
    prisma.generatedContent.count({
      where: {
        status: 'VALIDATED',
        influencer: { is: { userId } },
        ...campaignFilter,
      },
    }),
  ]);

  const totalGenerated = await prisma.generatedContent.count({
    where: { influencer: { is: { userId } } },
  });

  return {
    campaigns,
    influencers,
    pendingContents,
    upcomingContents,
    stats: {
      totalGenerated,
      publishedCount,
      validatedCount,
      pendingCount: pendingContents.length,
    },
  };
});
