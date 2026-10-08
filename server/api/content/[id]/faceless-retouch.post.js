import { isFacelessRenderSpec, runFacelessRetouchJob } from '../../../utils/facelessVideoJob.js';
import { findActiveFacelessSpec, FACELESS_PERSONA_SELECT } from '../../../utils/facelessContent.js';

const MAX_INSTRUCTION_LENGTH = 1000;

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

// Retouche d une video faceless en langage naturel ("l intro est trop chargee").
// Repart de la version ACTIVE ; nouvelle version en cas de succes, l ancienne
// reste disponible dans l historique.
export default defineEventHandler(async (event) => {
  const id = String(event.context?.params?.id || '').trim();
  const prisma = await getPrisma();
  const authModule = await import('../../../utils/auth.js');
  const user = await authModule.requireAuthUser(event);
  const body = await readBody(event);

  const instruction = String(body?.instruction || '').trim().slice(0, MAX_INSTRUCTION_LENGTH);
  if (!instruction) {
    return sendError(event, createError({ statusCode: 400, statusMessage: 'consigne requise' }));
  }

  const content = await prisma.generatedContent.findFirst({
    where: { id, influencer: { userId: user.id } },
    select: { id: true, status: true, imageUrl: true },
  });
  if (!content) {
    return sendError(event, createError({ statusCode: 404, statusMessage: 'Contenu introuvable' }));
  }
  if (content.status !== 'PENDING') {
    return sendError(event, createError({ statusCode: 409, statusMessage: 'Seul un contenu en attente peut être retouché' }));
  }

  const spec = await findActiveFacelessSpec(prisma, content);
  if (!isFacelessRenderSpec(spec)) {
    return sendError(event, createError({ statusCode: 409, statusMessage: 'Cette vidéo n a pas de plan de montage retouchable' }));
  }

  const persona = spec.personaId
    ? await prisma.profile.findFirst({ where: { id: spec.personaId, userId: user.id }, select: FACELESS_PERSONA_SELECT })
    : null;

  // Le rendu actuel reste en place jusqu au succes (meme regle que "Modifier").
  await prisma.generatedContent.update({
    where: { id },
    data: { status: 'PROCESSING', errorMessage: null },
  });

  return runFacelessRetouchJob({
    prisma,
    contentId: id,
    spec,
    instruction,
    persona,
    previousStatus: content.status,
  });
});
