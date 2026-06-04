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

export default defineEventHandler(async (event) => {
  try {
    const id = event.context?.params?.id;
    if (!id) {
      return sendError(event, createError({ statusCode: 400, statusMessage: 'Parametre id requis' }));
    }

    const prisma = await getPrisma();

    const updated = await prisma.generatedContent.update({
      where: { id },
      data: { status: 'VALIDATED' },
      select: {
        id: true,
        status: true,
      },
    });

    return {
      success: true,
      id: updated.id,
      status: updated.status,
    };
  } catch (err) {
    if (err?.code === 'P2025') {
      return sendError(event, createError({ statusCode: 404, statusMessage: 'Contenu introuvable' }));
    }

    return sendError(
      event,
      createError({
        statusCode: 500,
        statusMessage: 'Validation du contenu impossible',
        data: {
          code: err?.code,
          message: err?.message,
        },
      }),
    );
  }
});
