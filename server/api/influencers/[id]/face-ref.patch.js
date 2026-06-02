const { prisma } = require('../../../utils/prisma');

module.exports = defineEventHandler(async (event) => {
  try {
    const id = event.context?.params?.id;
    const body = await readBody(event);
    const faceRefPath = body?.faceRefPath;

    if (!id) {
      return sendError(event, createError({ statusCode: 400, statusMessage: 'Paramètre id requis' }));
    }

    if (!faceRefPath || typeof faceRefPath !== 'string') {
      return sendError(event, createError({ statusCode: 400, statusMessage: 'faceRefPath requis' }));
    }

    const influencer = await prisma.influencer.update({
      where: { id },
      data: { faceRefPath },
      select: {
        id: true,
        faceRefPath: true,
      }
    });

    return influencer;
  } catch (err) {
    return sendError(event, createError({ statusCode: 500, statusMessage: 'Erreur serveur', data: err }));
  }
});