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

    const existing = await prisma.generatedContent.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      return sendError(event, createError({ statusCode: 404, statusMessage: 'Contenu introuvable' }));
    }

    await prisma.generatedContent.delete({
      where: { id },
    });

    return {
      success: true,
      id,
    };
  } catch (err) {
    return sendError(
      event,
      createError({
        statusCode: 500,
        statusMessage: 'Suppression du contenu impossible',
        data: {
          name: err?.name,
          code: err?.code,
          message: err?.message,
        },
      }),
    );
  }
});
