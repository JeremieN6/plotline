import { MAX_NEW_PER_VIDEO } from '../data/facelessIllustrations.js';
import { normalizeFacelessDuration } from './facelessPlanGenerator.js';
import { defaultFacelessStyle, pickStyleSlot, readyIllustrations, readyPackEntries } from './facelessStyle.js';
import { loadPersonaStyle } from './facelessStyleStore.js';
import { resolveVoiceChoice } from './facelessVoiceChoice.js';

/**
 * Contexte commun des etapes "plan a valider" (ecrire le plan, le reviser) : persona et DA choisie
 * pour la video, voix, duree, sous-titres, images disponibles. Ne leve jamais : renvoie
 * { error: { statusCode, message } } ou le contexte.
 * `prisma` et `listClones` sont injectables (tests).
 */
export async function loadFacelessPlanContext({ prisma, user, body, listClones } = {}) {
  const profileId = String(body?.profileId || '').trim();
  let persona = null;
  let style = defaultFacelessStyle();
  if (profileId) {
    const loaded = await loadPersonaStyle(prisma, profileId, user.id);
    if (!loaded) return { error: { statusCode: 404, message: 'Profil introuvable' } };
    persona = loaded.persona;
    style = pickStyleSlot(loaded.style, body?.styleSlot);
  }

  const voice = await resolveVoiceChoice({ body, user, style, listClones });
  if (voice.error) return { error: voice.error };

  return {
    persona,
    style,
    voice,
    targetSeconds: normalizeFacelessDuration(body?.durationSeconds),
    captions: body?.captions === undefined ? style.captions.enabled : body.captions !== false,
    packEntries: readyPackEntries(style),
    illustrations: persona ? readyIllustrations(style) : {},
    maxNew: persona ? Math.max(0, Math.min(MAX_NEW_PER_VIDEO, Math.floor(Number(body?.illustrations?.maxNew) || 0))) : 0,
  };
}
