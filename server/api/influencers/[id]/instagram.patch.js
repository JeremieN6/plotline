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
    const instagramAccountId = typeof body?.instagramAccountId === 'string' ? body.instagramAccountId.trim() : '';
    const instagramAccessToken = typeof body?.instagramAccessToken === 'string' ? body.instagramAccessToken.trim() : '';

    const prisma = await getPrisma();
    const authModule = await import('../../../utils/auth.js');
    const user = await authModule.requireAuthUser(event);

    const ownerMatch = await prisma.influencer.findFirst({
      where: {
        id,
        userId: user.id,
      },
      select: { id: true },
    });

    if (!ownerMatch) {
      return sendError(event, createError({ statusCode: 404, statusMessage: 'Influenceuse introuvable' }));
    }

    const updated = await prisma.influencer.update({
      where: { id },
      data: {
        instagramAccountId: instagramAccountId || null,
        instagramAccessToken: instagramAccessToken || null,
      },
      select: {
        id: true,
        instagramAccountId: true,
        instagramAccessToken: true,
      },
    });

    return {
      success: true,
      influencer: updated,
    };
  } catch (err) {
    if (err?.code === 'P2025') {
      return sendError(event, createError({ statusCode: 404, statusMessage: 'Influenceuse introuvable' }));
    }

    return sendError(
      event,
      createError({
        statusCode: 500,
        statusMessage: 'Sauvegarde des credentials Instagram impossible',
        data: {
          name: err?.name,
          code: err?.code,
          message: err?.message,
        },
      }),
    );
  }
});