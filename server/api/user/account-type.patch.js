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

export default defineEventHandler(async (event) => {
  const authModule = await import('../../utils/auth.js');
  const accountTypeUtils = await import('../../utils/accountType.js');
  const user = await authModule.requireAuthUser(event);
  const prisma = await getPrisma();

  const body = await readBody(event);
  const accountType = accountTypeUtils.normalizeAccountType(body?.accountType);

  if (!accountTypeUtils.isAccountType(accountType)) {
    return sendError(
      event,
      createError({ statusCode: 400, statusMessage: 'accountType invalide' }),
    );
  }

  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: { accountType },
    select: {
      id: true,
      email: true,
      plan: true,
      accountType: true,
      createdAt: true,
    },
  });

  return { user: updatedUser };
});
