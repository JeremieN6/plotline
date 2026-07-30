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

module.exports = defineEventHandler(async (event) => {
  try {
    const prisma = await getPrisma();
    const authModule = await import('../../utils/auth.js');
    const user = await authModule.requireAuthUser(event);
    const body = await readBody(event);

    const name = String(body?.name || '').trim();
    const objective = String(body?.objective || '').trim();
    const channel = String(body?.channel || '').trim();

    if (!name) {
      return sendError(event, createError({ statusCode: 400, statusMessage: 'Nom de campagne requis' }));
    }

    const campaign = await prisma.campaign.create({
      data: {
        userId: user.id,
        name,
        objective: objective || null,
        channel: channel || null,
      },
      select: {
        id: true,
        name: true,
        objective: true,
        channel: true,
        createdAt: true,
      },
    });

    return campaign;
  } catch (err) {
    return sendError(
      event,
      createError({
        statusCode: 500,
        statusMessage: 'Erreur serveur',
        data: {
          name: err?.name,
          code: err?.code,
          message: err?.message,
          meta: err?.meta,
        },
      }),
    );
  }
});
