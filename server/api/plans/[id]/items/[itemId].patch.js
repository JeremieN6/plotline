let prismaClient;

async function getPrisma() {
  if (prismaClient) return prismaClient;

  const module = await import('../../../../utils/prisma.js');
  prismaClient = module?.prisma || module?.default?.prisma;

  if (!prismaClient) {
    throw new Error('Unable to resolve prisma client from server/utils/prisma.js');
  }

  return prismaClient;
}

/**
 * Ajustement d une idee pendant la revue: reecrire le prompt ou la legende,
 * deplacer la date, ou ecarter l idee sans la detruire.
 *
 * Une idee deja generee n est plus modifiable: son contenu vit desormais dans
 * le flux PENDING, ou il a son propre historique de versions.
 */
export default defineEventHandler(async (event) => {
  try {
    const planId = String(event.context?.params?.id || '').trim();
    const itemId = String(event.context?.params?.itemId || '').trim();

    if (!planId || !itemId) {
      return sendError(event, createError({ statusCode: 400, statusMessage: 'Parametres requis' }));
    }

    const prisma = await getPrisma();
    const authModule = await import('../../../../utils/auth.js');
    const user = await authModule.requireAuthUser(event);
    const body = await readBody(event);

    const item = await prisma.contentPlanItem.findFirst({
      where: {
        id: itemId,
        planId,
        plan: { is: { profile: { is: { userId: user.id } } } },
      },
      select: { id: true, contentId: true, plan: { select: { status: true } } },
    });

    if (!item) {
      return sendError(event, createError({ statusCode: 404, statusMessage: 'Idee introuvable' }));
    }

    if (item.contentId) {
      return sendError(event, createError({
        statusCode: 409,
        statusMessage: 'Cette idee a deja ete generee: modifiez le contenu depuis Mes creations',
      }));
    }

    const data = {};

    if (typeof body?.prompt === 'string') {
      const prompt = body.prompt.trim();
      if (!prompt) {
        return sendError(event, createError({ statusCode: 400, statusMessage: 'Le prompt ne peut pas etre vide' }));
      }
      data.prompt = prompt;
    }

    if (typeof body?.caption === 'string') data.caption = body.caption.trim() || null;
    if (typeof body?.hashtags === 'string') data.hashtags = body.hashtags.trim() || null;
    if (typeof body?.keep === 'boolean') data.keep = body.keep;

    if (body?.scheduledAt) {
      const parsed = new Date(body.scheduledAt);
      if (Number.isNaN(parsed.getTime())) {
        return sendError(event, createError({ statusCode: 400, statusMessage: 'scheduledAt invalide' }));
      }
      data.scheduledAt = parsed;
    }

    if (!Object.keys(data).length) {
      return sendError(event, createError({ statusCode: 400, statusMessage: 'Aucune modification fournie' }));
    }

    const updated = await prisma.contentPlanItem.update({
      where: { id: itemId },
      data,
      select: {
        id: true,
        position: true,
        prompt: true,
        caption: true,
        hashtags: true,
        platform: true,
        format: true,
        scheduledAt: true,
        keep: true,
        contentId: true,
      },
    });

    return { item: updated };
  } catch (err) {
    if (err?.statusCode) {
      return sendError(event, err);
    }

    return sendError(
      event,
      createError({
        statusCode: 500,
        statusMessage: 'Modification de l idee impossible',
        data: { code: err?.code, message: err?.message },
      }),
    );
  }
});
