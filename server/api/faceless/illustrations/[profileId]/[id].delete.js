import { requireFacelessPersona } from '../../../../utils/facelessApi.js';
import { removeIllustration } from '../../../../utils/facelessStyle.js';
import { updateProfileStyle } from '../../../../utils/facelessStyleStore.js';

// Retire une illustration du dossier. Le fichier reste stocke : les videos deja faites
// et leurs retouches en dependent (leur renderSpec garde l adresse de l image).
export default defineEventHandler(async (event) => {
  const { prisma, user, persona, style } = await requireFacelessPersona(event, event.context?.params?.profileId);
  const id = String(event.context?.params?.id || '');

  if (!(style.illustrations || []).some((item) => item.id === id)) {
    return sendError(event, createError({ statusCode: 404, statusMessage: 'Illustration introuvable' }));
  }

  await updateProfileStyle(prisma, persona.id, user.id, (current) => removeIllustration(current, id));
  return { removed: true, id };
});
