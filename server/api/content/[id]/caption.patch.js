// Modifie la legende d un contenu (sauvegarde automatique du panneau de detail de « Mes creations »).
// Refuse pour un contenu deja publie : la legende postee ne changerait pas sur la plateforme.
let prismaClient;

const MAX_CAPTION_LENGTH = 4000;

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

    const body = await readBody(event);
    if (typeof body?.caption !== 'string') {
      return sendError(event, createError({ statusCode: 400, statusMessage: 'La légende est requise.' }));
    }
    if (body.caption.length > MAX_CAPTION_LENGTH) {
      return sendError(event, createError({ statusCode: 400, statusMessage: `La légende dépasse ${MAX_CAPTION_LENGTH} caractères.` }));
    }

    const content = await prisma.generatedContent.findFirst({
      where: { id, influencer: { is: { userId: user.id } } },
      select: { id: true, status: true },
    });

    if (!content) {
      return sendError(event, createError({ statusCode: 404, statusMessage: 'Contenu introuvable' }));
    }

    if (content.status === 'PUBLISHED' || content.status === 'PROCESSING') {
      return sendError(event, createError({
        statusCode: 409,
        statusMessage: content.status === 'PUBLISHED'
          ? 'La légende d’un contenu publié ne peut plus être modifiée.'
          : 'Le contenu est en cours de génération.',
      }));
    }

    const updated = await prisma.generatedContent.update({
      where: { id },
      data: { caption: body.caption },
      select: { id: true, caption: true },
    });

    return { success: true, id: updated.id, caption: updated.caption };
  } catch (err) {
    if (err?.statusCode) {
      return sendError(event, err);
    }

    return sendError(
      event,
      createError({
        statusCode: 500,
        statusMessage: 'Enregistrement de la légende impossible',
        data: { code: err?.code, message: err?.message },
      }),
    );
  }
});
