import { retouchFacelessPlan, sanitizeFacelessPlan } from '../../utils/facelessPlanGenerator.js';
import { loadFacelessPlanContext } from '../../utils/facelessPlanRequest.js';

const MAX_INSTRUCTION = 1000;

// "Revise ce plan" : Claude applique une consigne en langage naturel ("plus clivant", "accroche plus
// agressive", "fond sombre sur le chiffre", "etonne-toi sur le 70 %") au plan que le createur est en
// train de relire, y compris ses corrections manuelles. Texte seulement, aucune voix ni rendu.
export default defineEventHandler(async (event) => {
  const authModule = await import('../../utils/auth.js');
  const user = await authModule.requireAuthUser(event);
  const prismaModule = await import('../../utils/prisma.js');
  const prisma = prismaModule?.prisma || prismaModule?.default?.prisma;
  const body = await readBody(event);

  const instruction = String(body?.instruction || '').trim().slice(0, MAX_INSTRUCTION);
  if (!instruction) return sendError(event, createError({ statusCode: 400, statusMessage: 'consigne requise' }));

  const context = await loadFacelessPlanContext({ prisma, user, body });
  if (context.error) return sendError(event, createError({ statusCode: context.error.statusCode, statusMessage: context.error.message }));

  const clone = context.voice.voiceMode === 'clone';
  let current;
  try {
    current = sanitizeFacelessPlan(body?.plan, {
      captions: context.captions,
      packIds: Object.keys(context.packEntries),
      illustrationIds: Object.keys(context.illustrations),
      maxNew: context.maxNew,
      allowTags: clone,
    });
  } catch {
    return sendError(event, createError({ statusCode: 400, statusMessage: 'Plan invalide (2 scènes au moins, avec du texte dit)' }));
  }

  try {
    const plan = await retouchFacelessPlan({
      plan: current,
      instruction,
      persona: context.persona,
      targetSeconds: context.targetSeconds,
      captions: context.captions,
      style: context.style,
      packEntries: context.packEntries,
      illustrations: context.illustrations,
      toneTags: clone,
    });
    return { plan };
  } catch (error) {
    console.warn('[faceless-plan] revision impossible', error?.message);
    return sendError(event, createError({ statusCode: 502, statusMessage: 'Claude n a pas pu réviser le plan, reformule ta consigne.' }));
  }
});
