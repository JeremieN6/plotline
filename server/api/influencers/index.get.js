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

module.exports = defineEventHandler(async (event) => {
  try {
    const prisma = await getPrisma();
    const userId = getQuery(event).userId;
    if (!userId) {
      return sendError(event, createError({ statusCode: 400, statusMessage: 'Paramètre userId requis' }));
    }

    const influencers = await prisma.influencer.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        userId: true,
        name: true,
        niche: true,
        style: true,
        faceRefPath: true,
        bodyRefPath: true,
        instagramAccountId: true,
        tiktokEnabled: true,
        calendarStep: true,
        createdAt: true
      }
    });

    return influencers;
  } catch (err) {
    return sendError(event, createError({ statusCode: 500, statusMessage: 'Erreur serveur', data: err }));
  }
});
