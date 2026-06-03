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
    const id = event.context?.params?.id;
    if (!id) {
      return sendError(event, createError({ statusCode: 400, statusMessage: 'Paramètre id requis' }));
    }

    const influencer = await prisma.influencer.findUnique({
      where: { id },
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

    if (!influencer) {
      return sendError(event, createError({ statusCode: 404, statusMessage: 'Influencer non trouvé' }));
    }

    return influencer;
  } catch (err) {
    return sendError(event, createError({ statusCode: 500, statusMessage: 'Erreur serveur', data: err }));
  }
});
