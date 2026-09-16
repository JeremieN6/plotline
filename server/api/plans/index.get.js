let prismaClient;

async function getPrisma() {
  if (prismaClient) return prismaClient;

  const module = await import('../../utils/prisma.js');
  prismaClient = module?.prisma || module?.default?.prisma;

  if (!prismaClient) {
    throw new Error('Unable to resolve prisma client from server/utils/prisma.js');
  }

  return prismaClient;
}

/** Liste les plans du compte, ou d un seul profil si `profileId` est fourni. */
export default defineEventHandler(async (event) => {
  try {
    const prisma = await getPrisma();
    const authModule = await import('../../utils/auth.js');
    const user = await authModule.requireAuthUser(event);

    const query = getQuery(event);
    const profileId = String(query?.profileId || '').trim();

    const plans = await prisma.contentPlan.findMany({
      where: {
        profile: {
          is: {
            userId: user.id,
            ...(profileId ? { id: profileId } : {}),
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        startDate: true,
        days: true,
        createdAt: true,
        profile: { select: { id: true, name: true } },
        _count: { select: { items: true } },
      },
    });

    return { plans };
  } catch (err) {
    if (err?.statusCode) {
      return sendError(event, err);
    }

    return sendError(
      event,
      createError({
        statusCode: 500,
        statusMessage: 'Chargement des plans impossible',
        data: { code: err?.code, message: err?.message },
      }),
    );
  }
});
