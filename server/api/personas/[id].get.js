// server/api/personas/[id].get.js
const { prisma } = require('../../utils/prisma');

module.exports = defineEventHandler(async (event) => {
  try {
    const id = event.context?.params?.id;
    if (!id) {
      return sendError(event, createError({ statusCode: 400, statusMessage: 'Paramètre id requis' }));
    }

    const persona = await prisma.persona.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        name: true,
        niche: true,
        narrativeStyle: true,
        tones: true,
        pillars: true,
        narrativeMemory: true,
        createdAt: true
      }
    });

    if (!persona) {
      return sendError(event, createError({ statusCode: 404, statusMessage: 'Persona non trouvé' }));
    }

    return persona;
  } catch (err) {
    return sendError(event, createError({ statusCode: 500, statusMessage: 'Erreur serveur', data: err }));
  }
});
