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
    const id = String(event.context?.params?.id || '').trim();
    if (!id) {
      return sendError(event, createError({ statusCode: 400, statusMessage: 'Parametre id requis' }));
    }

    const prisma = await getPrisma();
    const authModule = await import('../../../utils/auth.js');
    const user = await authModule.requireAuthUser(event);
    const body = await readBody(event);
    const versionId = String(body?.versionId || '').trim();

    if (!versionId) {
      return sendError(event, createError({ statusCode: 400, statusMessage: 'versionId requis' }));
    }

    const content = await prisma.generatedContent.findFirst({
      where: {
        id,
        influencer: { is: { userId: user.id } },
      },
      select: { id: true, status: true },
    });

    if (!content) {
      return sendError(event, createError({ statusCode: 404, statusMessage: 'Contenu introuvable' }));
    }

    if (content.status === 'PROCESSING') {
      return sendError(event, createError({
        statusCode: 409,
        statusMessage: 'Une generation est en cours sur ce contenu',
      }));
    }

    if (content.status === 'PUBLISHED') {
      return sendError(event, createError({
        statusCode: 409,
        statusMessage: 'Un contenu deja publie ne peut plus changer de version',
      }));
    }

    const version = await prisma.contentVersion.findFirst({
      where: { id: versionId, contentId: id },
      select: {
        id: true,
        imageUrl: true,
        caption: true,
        prompt: true,
      },
    });

    if (!version) {
      return sendError(event, createError({ statusCode: 404, statusMessage: 'Version introuvable' }));
    }

    // Repasse en attente: la validation portait sur le rendu precedent, elle ne
    // vaut plus pour celui qu on restaure.
    await prisma.$transaction([
      prisma.generatedContent.update({
        where: { id },
        data: {
          imageUrl: version.imageUrl,
          caption: version.caption,
          prompt: version.prompt,
          status: 'PENDING',
          errorMessage: null,
        },
        select: { id: true },
      }),
      prisma.contentVersion.updateMany({
        where: { contentId: id, isActive: true },
        data: { isActive: false },
      }),
      prisma.contentVersion.update({
        where: { id: versionId },
        data: { isActive: true },
        select: { id: true },
      }),
    ]);

    return { success: true, contentId: id, versionId };
  } catch (err) {
    if (err?.statusCode) {
      return sendError(event, err);
    }

    return sendError(
      event,
      createError({
        statusCode: 500,
        statusMessage: 'Restauration de la version impossible',
        data: {
          code: err?.code,
          message: err?.message,
        },
      }),
    );
  }
});
