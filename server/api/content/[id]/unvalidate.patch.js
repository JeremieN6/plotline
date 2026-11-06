// Remet un contenu VALIDE (ou REJETE) en attente (pour pouvoir le modifier de nouveau). Un contenu deja PUBLIE n est jamais
// touche : la publication est faite, la defaire ici mentirait sur l etat reel. La date planifiee est conservee :
// le planificateur ne publie que les contenus VALIDATED, donc un contenu en attente ne part jamais tout seul.
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

    if (content.status !== 'VALIDATED' && content.status !== 'REJECTED') {
      return sendError(event, createError({
        statusCode: 409,
        statusMessage: content.status === 'PUBLISHED'
          ? 'Ce contenu est déjà publié : il ne peut plus être remis en attente.'
          : 'Seul un contenu validé ou rejeté peut être remis en attente.',
      }));
    }

    const updated = await prisma.generatedContent.update({
      where: { id },
      data: { status: 'PENDING' },
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
        statusMessage: 'Impossible de remettre le contenu en attente',
        data: { code: err?.code, message: err?.message },
      }),
    );
  }
});
