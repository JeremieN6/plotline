let prismaClient;

async function getPrisma() {
  if (prismaClient) return prismaClient;

  const module = await import('../../../utils/prisma.js');
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
      data: { faceRefPath }
    });

    return influencer;
  } catch (err) {
    if (err?.code === 'P2025') {
      return sendError(event, createError({ statusCode: 404, statusMessage: 'Influencer non trouvé' }));
    }

    return sendError(event, createError({ statusCode: 500, statusMessage: 'Erreur serveur', data: err }));
  }
});