import { generateOutline } from '../../utils/facelessOutline.js';
import { MAX_SOURCE_TEXT, normalizeFacelessDuration } from '../../utils/facelessPlanGenerator.js';
import { loadPersonaStyle } from '../../utils/facelessStyleStore.js';
import { requireFacelessUser } from '../../utils/facelessApi.js';

// Trame a dire pour le mode "ma voix" : temps forts, idees, phrase d exemple, indications de montage.
// Appel Claude texte seulement (quelques centimes), session obligatoire.
export default defineEventHandler(async (event) => {
  const user = await requireFacelessUser(event);
  const body = await readBody(event);

  const idea = String(body?.idea || '').trim().slice(0, 2000);
  // Texte source (article, notes) : la trame s appuie dessus au lieu d inventer ; refuse s il est trop long, jamais coupe.
  const sourceText = String(body?.sourceText || '').trim();
  if (sourceText.length > MAX_SOURCE_TEXT) {
    return sendError(event, createError({ statusCode: 400, statusMessage: `Texte source trop long (${MAX_SOURCE_TEXT} caracteres maximum)` }));
  }
  if (!idea && !sourceText) {
    return sendError(event, createError({ statusCode: 400, statusMessage: 'idee ou texte source requis' }));
  }

  let persona = null;
  const profileId = String(body?.profileId || '').trim();
  if (profileId) {
    const prismaModule = await import('../../utils/prisma.js');
    const prisma = prismaModule?.prisma || prismaModule?.default?.prisma;
    const loaded = await loadPersonaStyle(prisma, profileId, user.id);
    if (!loaded) {
      return sendError(event, createError({ statusCode: 404, statusMessage: 'Profil introuvable' }));
    }
    persona = loaded.persona;
  }

  try {
    return await generateOutline({ idea, sourceText, persona, targetSeconds: normalizeFacelessDuration(body?.durationSeconds) });
  } catch (error) {
    return sendError(event, createError({ statusCode: 502, statusMessage: `Trame impossible : ${error?.message || error}` }));
  }
});
