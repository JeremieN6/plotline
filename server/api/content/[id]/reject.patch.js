// Rejette un contenu en attente (il reste dans « Tout », jamais publie ; « Remettre en attente » le recupere).
// Seul un contenu PENDING peut etre rejete : un contenu valide, publie ou en generation n est pas concerne.
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
    const authModule = await import('../../../utils/auth.js');
    const user = await authModule.requireAuthUser(event);

    const content = await prisma.generatedContent.findFirst({
      where: { id, influencer: { is: { userId: user.id } } },
      select: { id: true, status: true },
    });

    if (!content) {
      return sendError(event, createError({ statusCode: 404, statusMessage: 'Contenu introuvable' }));
    }

    if (content.status !== 'PENDING') {
      return sendError(event, createError({ statusCode: 409, statusMessage: 'Seul un contenu en attente peut être rejeté.' }));
    }

    const updated = await prisma.generatedContent.update({
      where: { id },
      data: { status: 'REJECTED' },
      select: { id: true, status: true },
    });

    return { success: true, id: updated.id, status: updated.status };
  } catch (err) {
    if (err?.statusCode) {
      return sendError(event, err);
    }

    return sendError(
      event,
      createError({
        statusCode: 500,
        statusMessage: 'Rejet du contenu impossible',
        data: { code: err?.code, message: err?.message },
      }),
    );
  }
});
