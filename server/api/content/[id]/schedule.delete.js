// Annule la programmation d'un contenu VALIDE : il reste « Valide » mais n'a plus de date, donc le planificateur ne le
// publiera pas. Refuse pour un contenu publie : sa date est celle de la publication (calendrier), pas une programmation.
// L'ecriture est atomique (meme condition que la prise de main du planificateur) : si la publication vient de partir,
// il ne reste rien a annuler et on le dit.
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
      select: { id: true, status: true, scheduledAt: true },
    });

    if (!content) {
      return sendError(event, createError({ statusCode: 404, statusMessage: 'Contenu introuvable' }));
    }

    if (content.status !== 'VALIDATED') {
      return sendError(event, createError({
        statusCode: 409,
        statusMessage: content.status === 'PUBLISHED'
          ? 'Ce contenu est déjà publié : il n’y a plus de programmation à annuler.'
          : 'Seul un contenu validé peut avoir une programmation.',
      }));
    }

    const result = await prisma.generatedContent.updateMany({
      where: { id, status: 'VALIDATED', scheduledAt: { not: null } },
      data: { scheduledAt: null },
    });

    if (result.count === 0) {
      return sendError(event, createError({
        statusCode: 409,
        statusMessage: 'Ce contenu n’est pas programmé (ou sa publication vient de démarrer).',
      }));
    }

    return { success: true, id };
  } catch (err) {
    if (err?.statusCode) {
      return sendError(event, err);
    }

    return sendError(
      event,
      createError({
        statusCode: 500,
        statusMessage: 'Impossible d’annuler la programmation',
        data: { code: err?.code, message: err?.message },
      }),
    );
  }
});
