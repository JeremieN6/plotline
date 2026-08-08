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

function isMissingVersionTableError(err) {
  const message = String(err?.message || '').toLowerCase();
  return message.includes('contentversion') && (message.includes('does not exist') || message.includes('no such table'));
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

    const content = await prisma.generatedContent.findFirst({
      where: {
        id,
        influencer: { is: { userId: user.id } },
      },
      select: { id: true, imageUrl: true, format: true },
    });

    if (!content) {
      return sendError(event, createError({ statusCode: 404, statusMessage: 'Contenu introuvable' }));
    }

    let versions = [];
    try {
      versions = await prisma.contentVersion.findMany({
        where: { contentId: id },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          imageUrl: true,
          caption: true,
          prompt: true,
          generationModel: true,
          isActive: true,
          createdAt: true,
        },
      });
    } catch (versionErr) {
      // Migration pas encore appliquee: on renvoie une liste vide plutot que 500,
      // la page contenu doit rester utilisable.
      if (!isMissingVersionTableError(versionErr)) {
        throw versionErr;
      }
    }

    return { contentId: id, versions };
  } catch (err) {
    if (err?.statusCode) {
      return sendError(event, err);
    }

    return sendError(
      event,
      createError({
        statusCode: 500,
        statusMessage: 'Impossible de charger les versions',
        data: {
          code: err?.code,
          message: err?.message,
        },
      }),
    );
  }
});
