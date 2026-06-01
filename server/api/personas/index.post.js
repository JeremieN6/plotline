// server/api/personas/index.post.js
const { prisma } = require('../../utils/prisma');

module.exports = defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const required = ['userId', 'name', 'niche', 'narrativeStyle', 'tones', 'pillars'];
    for (const field of required) {
      if (!body?.[field]) {
        return sendError(event, createError({ statusCode: 400, statusMessage: `Champ manquant: ${field}` }));
      }
    }

    const narrativeMemory = {
      themesCovered: [],
      arcsUsed: [],
      lastToneSequence: [],
      openArc: null,
      forbiddenNext: [],
      totalPostsGenerated: 0
    };

    // In dev, the UI uses a fixed userId. Ensure the FK target exists.
    const emailLocalPart = String(body.userId).replace(/[^a-zA-Z0-9._-]/g, '-');
    await prisma.user.upsert({
      where: { id: body.userId },
      update: {},
      create: {
        id: body.userId,
        email: `${emailLocalPart}@local.plotline.test`,
        plan: 'SOLO'
      }
    });

    const persona = await prisma.persona.create({
      data: {
        userId: body.userId,
        name: body.name,
        niche: body.niche,
        narrativeStyle: body.narrativeStyle,
        tones: body.tones,
        pillars: body.pillars,
        narrativeMemory
      }
    });

    return persona;
  } catch (err) {
    return sendError(event, createError({ statusCode: 500, statusMessage: 'Erreur serveur', data: err }));
  }
});
