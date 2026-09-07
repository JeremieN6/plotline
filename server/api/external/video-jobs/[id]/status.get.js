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

// Jumeau de /api/content/:id/status, mais pour l appelant service-a-service :
// ce dernier n a pas de session utilisateur, donc pas de userId pour scoper la
// requete. L authentification se fait par la meme cle partagee que la creation
// du job.
export default defineEventHandler(async (event) => {
  const runtimeConfig = useRuntimeConfig(event);
  const expectedApiKey = String(runtimeConfig.externalVideoJobsApiKey || '').trim();

  if (!expectedApiKey) {
    return sendError(event, createError({ statusCode: 503, statusMessage: 'EXTERNAL_VIDEO_JOBS_API_KEY non configuree' }));
  }

  const providedApiKey = String(getHeader(event, 'x-api-key') || '').trim();
  if (!providedApiKey || providedApiKey !== expectedApiKey) {
    return sendError(event, createError({ statusCode: 401, statusMessage: 'Cle API invalide' }));
  }

  const id = String(event.context?.params?.id || '').trim();
  if (!id) {
    return sendError(event, createError({ statusCode: 400, statusMessage: 'id requis' }));
  }

  const prisma = await getPrisma();
  const content = await prisma.generatedContent.findUnique({
    where: { id },
    select: { id: true, status: true, imageUrl: true, errorMessage: true },
  });

  if (!content) {
    return sendError(event, createError({ statusCode: 404, statusMessage: 'Contenu introuvable' }));
  }

  const failed = content.status === 'FAILED' || Boolean(content.errorMessage);

  return {
    id: content.id,
    status: content.status,
    imageUrl: content.imageUrl || null,
    errorMessage: content.errorMessage || null,
    failed,
    done: content.status === 'PENDING' || content.status === 'VALIDATED' || content.status === 'PUBLISHED' || content.status === 'FAILED',
  };
});
