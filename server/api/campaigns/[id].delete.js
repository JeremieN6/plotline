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
    const authModule = await import('../../utils/auth.js');
    const user = await authModule.requireAuthUser(event);

    const campaign = await prisma.campaign.findFirst({
      where: {
        id,
        userId: user.id,
      },
      select: {
        id: true,
        name: true,
      },
    });

    if (!campaign) {
      return sendError(event, createError({ statusCode: 404, statusMessage: 'Campagne introuvable' }));
    }

    const blockingCount = await prisma.generatedContent.count({
      where: {
        campaignId: campaign.id,
        status: 'PROCESSING',
      },
    });

    if (blockingCount > 0) {
      return sendError(event, createError({
        statusCode: 409,
        statusMessage: 'Impossible de supprimer une campagne avec des contenus en cours',
      }));
    }

    await prisma.$transaction([
      prisma.generatedContent.updateMany({
        where: { campaignId: campaign.id },
        data: { campaignId: null },
      }),
      prisma.campaign.delete({
        where: { id: campaign.id },
      }),
    ]);

    return {
      success: true,
      campaignId: campaign.id,
      campaignName: campaign.name,
    };
  } catch (err) {
    return sendError(
      event,
      createError({
        statusCode: 500,
        statusMessage: 'Impossible de supprimer la campagne',
        data: {
          code: err?.code,
          message: err?.message,
        },
      }),
    );
  }
});