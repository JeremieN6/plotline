import { MAX_ADVICE_QUESTION, askFacelessAdvice } from '../../utils/facelessAdvice.js';
import { MAX_DIRECTION, MAX_SOURCE_TEXT, normalizeSourceText } from '../../utils/facelessPlanGenerator.js';
import { loadFacelessPlanContext } from '../../utils/facelessPlanRequest.js';

// "Demander son avis" : Claude repond a une question sur le script ou la direction de la video, en texte
// seulement. Il ne modifie jamais le plan (c'est le rôle de « Réviser ») et rien n'est enregistre ni depense
// hors quelques centimes de texte. Marche avant d'avoir un plan (brief, texte source) comme pendant sa relecture.
export default defineEventHandler(async (event) => {
  const authModule = await import('../../utils/auth.js');
  const user = await authModule.requireAuthUser(event);
  const prismaModule = await import('../../utils/prisma.js');
  const prisma = prismaModule?.prisma || prismaModule?.default?.prisma;
  const body = await readBody(event);

  const question = String(body?.question || '').trim();
  if (!question) return sendError(event, createError({ statusCode: 400, statusMessage: 'question requise' }));
  if (question.length > MAX_ADVICE_QUESTION) {
    return sendError(event, createError({ statusCode: 400, statusMessage: `Question trop longue (${MAX_ADVICE_QUESTION} caracteres maximum)` }));
  }
  const sourceText = normalizeSourceText(body?.sourceText);
  if (sourceText.length > MAX_SOURCE_TEXT) {
    return sendError(event, createError({ statusCode: 400, statusMessage: `Texte source trop long (${MAX_SOURCE_TEXT} caracteres maximum)` }));
  }

  const context = await loadFacelessPlanContext({ prisma, user, body });
  if (context.error) return sendError(event, createError({ statusCode: context.error.statusCode, statusMessage: context.error.message }));

  try {
    const answer = await askFacelessAdvice({
      question,
      history: body?.history,
      idea: String(body?.idea || '').slice(0, 2000),
      sourceText,
      direction: String(body?.direction || '').slice(0, MAX_DIRECTION),
      plan: body?.plan && typeof body.plan === 'object' ? body.plan : null,
      persona: context.persona,
      style: context.style,
      targetSeconds: context.targetSeconds,
    });
    return { answer };
  } catch (error) {
    console.warn('[faceless-advice] avis impossible', error?.message);
    return sendError(event, createError({ statusCode: 502, statusMessage: 'Claude n a pas pu répondre, réessaie dans un instant.' }));
  }
});
