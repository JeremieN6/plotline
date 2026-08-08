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

    const existing = await prisma.generatedContent.findFirst({
      where: {
        id,
        influencer: {
          is: {
            userId: user.id,
          },
        },
      },
      select: { id: true, imageUrl: true },
    });

    if (!existing) {
      return sendError(event, createError({ statusCode: 404, statusMessage: 'Contenu introuvable' }));
    }

    // Les medias doivent partir avant la ligne: la cascade SQL efface les versions
    // en base mais ne touche jamais aux fichiers, ce qui laissait des orphelins.
    const { deleteAllContentMedia } = await import('../../utils/contentVersions.js');
    await deleteAllContentMedia(prisma, id, existing.imageUrl);

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
