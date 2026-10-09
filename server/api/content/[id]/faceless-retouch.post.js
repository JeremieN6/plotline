import { isFacelessRenderSpec, runFacelessRetouchJob } from '../../../utils/facelessVideoJob.js';
import { findActiveFacelessSpec } from '../../../utils/facelessContent.js';
import { appendStyleRule } from '../../../utils/facelessStyle.js';
import { loadPersonaStyle, updateProfileStyle } from '../../../utils/facelessStyleStore.js';

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
// Repart de la version ACTIVE (avec sa DA du moment) ; nouvelle version en cas de succes,
// l ancienne reste dans l historique. `rememberRule: true` ajoute aussi la consigne aux
// regles de montage de la DA de la persona, pour les prochaines videos.
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

  const loaded = spec.personaId ? await loadPersonaStyle(prisma, spec.personaId, user.id) : null;
  const rememberRule = body?.rememberRule === true;

  // La regle retenue rejoint la DA de la persona (sans toucher a son pack d avatars).
  if (rememberRule && loaded) {
    try {
      await updateProfileStyle(prisma, loaded.persona.id, user.id, (style) => appendStyleRule(style, instruction));
    } catch (error) {
      console.warn('[faceless] regle non retenue (colonne facelessStyle absente ?)', error?.message);
    }
  }

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
    persona: loaded?.persona || null,
    rememberRule,
    previousStatus: content.status,
  });
});
