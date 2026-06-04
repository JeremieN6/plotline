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

export default defineEventHandler(async (event) => {
  try {
    const id = event.context?.params?.id;
    if (!id) {
      return sendError(event, createError({ statusCode: 400, statusMessage: 'Parametre id requis' }));
    }

    const prisma = await getPrisma();
    const content = await prisma.generatedContent.findUnique({
      where: { id },
      select: {
        id: true,
        influencerId: true,
        imageUrl: true,
        caption: true,
        status: true,
        errorMessage: true,
        platform: true,
        format: true,
        createdAt: true,
      },
    });

    if (!content) {
      return sendError(event, createError({ statusCode: 404, statusMessage: 'Contenu introuvable' }));
    }

    return content;
  } catch (err) {
    return sendError(
      event,
      createError({
        statusCode: 500,
        statusMessage: 'Recuperation du contenu impossible',
        data: {
          code: err?.code,
          message: err?.message,
        },
      }),
    );
  }
});
