import { MAX_DIRECTION, MAX_SOURCE_TEXT, generateFacelessPlan, normalizeSourceText } from '../../utils/facelessPlanGenerator.js';
import { loadFacelessPlanContext } from '../../utils/facelessPlanRequest.js';

const MAX_IDEA_LENGTH = 2000;

// "Plan a valider" : Claude ecrit le script ET le montage (scenes, textes, mises en page, ton de
// la voix), SANS voix ni rendu : quelques centimes de texte, rien d autre n est depense. Le
// createur relit, corrige a la main ou demande une revision, puis lance la video avec CE plan
// (POST /api/generate/faceless avec `plan`). Rien n est enregistre ici.
export default defineEventHandler(async (event) => {
  const authModule = await import('../../utils/auth.js');
  const user = await authModule.requireAuthUser(event);
  const prismaModule = await import('../../utils/prisma.js');
  const prisma = prismaModule?.prisma || prismaModule?.default?.prisma;
  const body = await readBody(event);

  const idea = String(body?.idea || '').trim().slice(0, MAX_IDEA_LENGTH);
  const sourceText = normalizeSourceText(body?.sourceText);
  if (sourceText.length > MAX_SOURCE_TEXT) {
    return sendError(event, createError({ statusCode: 400, statusMessage: `Texte source trop long (${MAX_SOURCE_TEXT} caracteres maximum)` }));
  }
  if (!idea && !sourceText) {
    return sendError(event, createError({ statusCode: 400, statusMessage: 'idee ou texte source requis' }));
  }

  const context = await loadFacelessPlanContext({ prisma, user, body });
  if (context.error) return sendError(event, createError({ statusCode: context.error.statusCode, statusMessage: context.error.message }));

  try {
    const plan = await generateFacelessPlan({
      idea,
      sourceText,
      direction: String(body?.direction || '').slice(0, MAX_DIRECTION),
      persona: context.persona,
      targetSeconds: context.targetSeconds,
      captions: context.captions,
      style: context.style,
      packEntries: context.packEntries,
      illustrations: context.illustrations,
      maxNew: context.maxNew,
      toneTags: context.voice.voiceMode === 'clone',
    });
    return { plan, voiceMode: context.voice.voiceMode, targetSeconds: context.targetSeconds };
  } catch (error) {
    console.warn('[faceless-plan] ecriture du plan impossible', error?.message);
    return sendError(event, createError({ statusCode: 502, statusMessage: 'Claude n a pas pu écrire le plan, réessaie ou reformule.' }));
  }
});
