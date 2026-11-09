// Remet en « Valide » un contenu passe en ERREUR a cause d'une PUBLICATION ratee (identifiants manquants, jeton expire...).
// Conditions : le contenu est en erreur ET son media existe (un echec de generation n'a rien a recuperer).
// La date planifiee est EFFACEE : le planificateur reprend tout contenu valide dont la date est passee, il retenterait
// donc la publication aussitot et le remettrait en erreur. Le message d'erreur est efface aussi.
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
      select: { id: true, status: true, imageUrl: true },
    });

    if (!content) {
      return sendError(event, createError({ statusCode: 404, statusMessage: 'Contenu introuvable' }));
    }

    if (content.status !== 'FAILED') {
      return sendError(event, createError({ statusCode: 409, statusMessage: 'Seul un contenu en erreur peut être remis en « Validé ».' }));
    }

    if (!String(content.imageUrl || '').trim()) {
      return sendError(event, createError({
        statusCode: 409,
        statusMessage: 'Ce contenu n’a pas de média (la génération a échoué) : il n’y a rien à récupérer.',
      }));
    }

    const result = await prisma.generatedContent.updateMany({
      where: { id, status: 'FAILED' },
      data: { status: 'VALIDATED', errorMessage: null, scheduledAt: null },
    });

    if (result.count === 0) {
      return sendError(event, createError({ statusCode: 409, statusMessage: 'Le contenu a changé entre-temps : recharge la page.' }));
    }

    return { success: true, id, status: 'VALIDATED' };
  } catch (err) {
    if (err?.statusCode) {
      return sendError(event, err);
    }

    return sendError(
      event,
      createError({
        statusCode: 500,
        statusMessage: 'Impossible de remettre le contenu en « Validé »',
        data: { code: err?.code, message: err?.message },
      }),
    );
  }
});
