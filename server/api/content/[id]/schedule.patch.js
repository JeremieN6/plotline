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

    const body = await readBody(event);
    const scheduledAt = String(body?.scheduledAt || '').trim();
    if (!scheduledAt) {
      return sendError(event, createError({ statusCode: 400, statusMessage: 'scheduledAt requis' }));
    }

    const parsedDate = new Date(scheduledAt);
    if (Number.isNaN(parsedDate.getTime())) {
      return sendError(event, createError({ statusCode: 400, statusMessage: 'scheduledAt invalide' }));
    }

    const prisma = await getPrisma();
    const updated = await prisma.generatedContent.update({
      where: { id },
      data: {
        scheduledAt: parsedDate,
      },
      select: {
        id: true,
        scheduledAt: true,
        status: true,
      },
    });

    return {
      success: true,
      content: updated,
    };
  } catch (err) {
    if (err?.code === 'P2025') {
      return sendError(event, createError({ statusCode: 404, statusMessage: 'Contenu introuvable' }));
    }

    return sendError(
      event,
      createError({
        statusCode: 500,
        statusMessage: 'Planification du contenu impossible',
        data: {
          code: err?.code,
          message: err?.message,
        },
      }),
    );
  }
});
