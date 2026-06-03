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
    const body = await readBody(event);
    const required = ['userId', 'name', 'niche', 'style'];

    for (const field of required) {
      if (!body?.[field]) {
        return sendError(event, createError({ statusCode: 400, statusMessage: `Champ manquant: ${field}` }));
      }
    }

    const userId = String(body.userId).trim();
    const userEmail = `${userId}@plotline.local`;

    await prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: {
        id: userId,
        email: userEmail
      }
    });

    const influencer = await prisma.influencer.create({
      data: {
        userId,
        name: body.name,
        niche: body.niche,
        style: body.style
      }
    });

    return influencer;
  } catch (err) {
    return sendError(
      event,
      createError({
        statusCode: 500,
        statusMessage: 'Erreur serveur',
        data: {
          name: err?.name,
          code: err?.code,
          message: err?.message,
          meta: err?.meta,
        },
      }),
    );
  }
});
