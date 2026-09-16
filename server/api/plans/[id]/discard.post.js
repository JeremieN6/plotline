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

/**
 * Abandonne un plan brouillon. Un plan DRAFT n a jamais engage de generation
 * (voir approve.post.js): il n y a donc rien a defaire, seul le statut change.
 */
export default defineEventHandler(async (event) => {
  try {
    const planId = String(event.context?.params?.id || '').trim();
    if (!planId) {
      return sendError(event, createError({ statusCode: 400, statusMessage: 'Parametre id requis' }));
    }

    const prisma = await getPrisma();
    const authModule = await import('../../../utils/auth.js');
    const user = await authModule.requireAuthUser(event);

    const plan = await prisma.contentPlan.findFirst({
      where: { id: planId, profile: { is: { userId: user.id } } },
      select: { id: true, status: true },
    });

    if (!plan) {
      return sendError(event, createError({ statusCode: 404, statusMessage: 'Plan introuvable' }));
    }

    if (plan.status !== 'DRAFT') {
      return sendError(event, createError({
        statusCode: 409,
        statusMessage: plan.status === 'APPROVED' ? 'Ce plan a deja ete approuve' : 'Ce plan a deja ete abandonne',
      }));
    }

    await prisma.contentPlan.update({
      where: { id: plan.id },
      data: { status: 'DISCARDED' },
    });

    return { planId: plan.id, status: 'DISCARDED' };
  } catch (err) {
    if (err?.statusCode) {
      return sendError(event, err);
    }

    return sendError(
      event,
      createError({
        statusCode: 500,
        statusMessage: 'Abandon du plan impossible',
        data: { code: err?.code, message: err?.message },
      }),
    );
  }
});
