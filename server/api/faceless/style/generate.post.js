import { requireFacelessUser } from '../../../utils/facelessApi.js';
import { generateFacelessStyle } from '../../../utils/facelessStyleGenerator.js';
import { normalizeFacelessStyle } from '../../../utils/facelessStyle.js';
import { loadPersonaStyle } from '../../../utils/facelessStyleStore.js';

const MAX_DESCRIPTION = 1500;

// "Generer ma DA" : Claude remplit les champs a partir d une description (ou modifie la DA
// envoyee dans `current`). Rien n est enregistre : la page affiche le resultat, avec un
// apercu, et l utilisateur choisit d enregistrer. Cout : un appel texte (quelques centimes).
export default defineEventHandler(async (event) => {
  const user = await requireFacelessUser(event);
  const body = await readBody(event);

  const description = String(body?.description || '').trim().slice(0, MAX_DESCRIPTION);
  if (!description) {
    return sendError(event, createError({ statusCode: 400, statusMessage: 'description requise' }));
  }

  let persona = null;
  const profileId = String(body?.profileId || '').trim();
  if (profileId) {
    const prismaModule = await import('../../../utils/prisma.js');
    const prisma = prismaModule?.prisma || prismaModule?.default?.prisma;
    const loaded = await loadPersonaStyle(prisma, profileId, user.id);
    if (!loaded) return sendError(event, createError({ statusCode: 404, statusMessage: 'Profil introuvable' }));
    persona = loaded.persona;
  }

  const current = body?.current && typeof body.current === 'object' ? normalizeFacelessStyle(body.current) : null;

  try {
    return { style: await generateFacelessStyle({ description, current, persona }) };
  } catch (error) {
    console.warn('[faceless-style] generation impossible', error?.message);
    return sendError(event, createError({ statusCode: 502, statusMessage: 'Claude n a pas pu composer la DA, reessaie en reformulant.' }));
  }
});
