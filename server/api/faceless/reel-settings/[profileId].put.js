import { requireFacelessPersona } from '../../../utils/facelessApi.js';
import { updateProfileStyle } from '../../../utils/facelessStyleStore.js';
import { normalizeReelSettings, REEL_DURATIONS, REEL_STABILITIES } from '../../../utils/facelessReelSettings.js';

// Reglage « Video faceless des plans » d un profil (duree, DA, expressivite de la voix clonee) :
// utilise quand un plan editorial est approuve. Ecrit dans la DA principale du profil.
export default defineEventHandler(async (event) => {
  const { prisma, user, persona, style } = await requireFacelessPersona(event, event.context?.params?.profileId);
  const body = await readBody(event);

  const durationSeconds = Number(body?.durationSeconds);
  const styleSlot = Number(body?.styleSlot);
  if (!REEL_DURATIONS.includes(durationSeconds)) {
    return sendError(event, createError({ statusCode: 400, statusMessage: 'durée invalide' }));
  }
  if (!Number.isInteger(styleSlot) || styleSlot < 0 || styleSlot > (style.alternates || []).length) {
    return sendError(event, createError({ statusCode: 400, statusMessage: 'DA inconnue pour ce profil' }));
  }
  if (!REEL_STABILITIES.includes(body?.stability)) {
    return sendError(event, createError({ statusCode: 400, statusMessage: 'expressivité invalide' }));
  }

  const reelSettings = normalizeReelSettings({ durationSeconds, styleSlot, stability: body.stability });
  try {
    await updateProfileStyle(prisma, persona.id, user.id, (current) => ({ ...current, reelSettings }));
  } catch (error) {
    console.warn('[faceless-reel-settings] enregistrement impossible', error?.message);
    return sendError(event, createError({ statusCode: 500, statusMessage: 'Enregistrement impossible' }));
  }
  return { saved: true, reelSettings };
});
