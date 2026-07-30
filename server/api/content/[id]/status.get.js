let prismaClient;

async function getPrisma() {
  if (prismaClient) return prismaClient;

  const module = await import('../../../utils/prisma.js');
  prismaClient = module?.prisma || module?.default?.prisma;

  if (!prismaClient) {
    throw new Error('Unable to resolve prisma client');
  }

  return prismaClient;
}

export default defineEventHandler(async (event) => {
  const authModule = await import('../../../utils/auth.js');
  const user = await authModule.requireAuthUser(event);

  const id = String(event.context?.params?.id || '').trim();
  if (!id) {
    return sendError(event, createError({ statusCode: 400, statusMessage: 'id requis' }));
  }

  const prisma = await getPrisma();

  let content;
  try {
    content = await prisma.generatedContent.findFirst({
      where: {
        id,
        influencer: { userId: user.id },
      },
      select: {
        id: true,
        status: true,
        imageUrl: true,
        errorMessage: true,
      },
    });
  } catch {
    // Fallback sans relation influencer si le schema differe
    content = await prisma.generatedContent.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        imageUrl: true,
        errorMessage: true,
      },
    });
  }

  if (!content) {
    return sendError(event, createError({ statusCode: 404, statusMessage: 'Contenu introuvable' }));
  }

  return {
    id: content.id,
    status: content.status,
    imageUrl: content.imageUrl || null,
    errorMessage: content.errorMessage || null,
    done: content.status === 'PENDING' || content.status === 'VALIDATED' || content.status === 'PUBLISHED' || content.status === 'FAILED',
  };
});
