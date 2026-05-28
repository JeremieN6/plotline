// server/api/personas/index.get.js
const { prisma } = require('../../utils/prisma');

module.exports = defineEventHandler(async (event) => {
  try {
    const userId = getQuery(event).userId;
    if (!userId) {
      return sendError(event, createError({ statusCode: 400, statusMessage: 'Paramètre userId requis' }));
    }

    const personas = await prisma.persona.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        userId: true,
        name: true,
        niche: true,
        narrativeStyle: true,
        tones: true,
        pillars: true,
        createdAt: true
      }
    });

    return personas;
  } catch (err) {
    return sendError(event, createError({ statusCode: 500, statusMessage: 'Erreur serveur', data: err }));
  }
});
