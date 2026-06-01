const { prisma } = require('../../utils/prisma');

module.exports = defineEventHandler(async (event) => {
  try {
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
