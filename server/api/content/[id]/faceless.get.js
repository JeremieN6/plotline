import { isFacelessRenderSpec } from '../../../utils/facelessVideoJob.js';
import { findActiveFacelessSpec } from '../../../utils/facelessContent.js';

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

// Etat d une video faceless pour l ecran de retouche (/studio/faceless?content=...).
export default defineEventHandler(async (event) => {
  const id = String(event.context?.params?.id || '').trim();
  const prisma = await getPrisma();
  const authModule = await import('../../../utils/auth.js');
  const user = await authModule.requireAuthUser(event);

  const content = await prisma.generatedContent.findFirst({
    where: { id, influencer: { userId: user.id } },
    select: { id: true, status: true, imageUrl: true, errorMessage: true },
  });
  if (!content) {
    return sendError(event, createError({ statusCode: 404, statusMessage: 'Contenu introuvable' }));
  }

  const spec = await findActiveFacelessSpec(prisma, content);
  const retouchable = isFacelessRenderSpec(spec);

  return {
    id: content.id,
    status: content.status,
    imageUrl: content.imageUrl || null,
    errorMessage: content.errorMessage || null,
    retouchable,
    canRetouchNow: retouchable && content.status === 'PENDING',
    idea: retouchable ? spec.idea || '' : '',
    personaId: retouchable ? spec.personaId || '' : '',
    retouches: retouchable && Array.isArray(spec.retouches) ? spec.retouches : [],
  };
});
