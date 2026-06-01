const { prisma } = require('../../utils/prisma');

module.exports = defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const required = ['userId', 'name', 'niche', 'style'];

    for (const field of required) {
      if (!body?.[field]) {
        return sendError(event, createError({ statusCode: 400, statusMessage: `Champ manquant: ${field}` }));
      }
    }

    const influencer = await prisma.influencer.create({
      data: {
        userId: body.userId,
        name: body.name,
        niche: body.niche,
        style: body.style
      }
    });

    return influencer;
  } catch (err) {
    return sendError(event, createError({ statusCode: 500, statusMessage: 'Erreur serveur', data: err }));
  }
});
