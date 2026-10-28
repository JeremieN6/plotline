import { V3_STABILITY, listCloneVoices } from './elevenLabsTts.js';
import { findFacelessVoice } from '../data/facelessCatalog.js';
import { isAdminEmail } from './adminAccounts.js';

/**
 * Choix de la voix d une video faceless a partir de la requete.
 *
 * - voix de synthese : une voix du catalogue (celle de la DA par defaut) ;
 * - voix clonee : reservee au PROPRIETAIRE du compte (`ADMIN_ACCOUNTS`) et limitee aux voix
 *   clonees du compte ElevenLabs de Plotline : un autre utilisateur ne peut ni la voir ni
 *   l utiliser, meme en envoyant son identifiant. Modele v3, stabilite a trois niveaux.
 *
 * Ne leve jamais : renvoie { error: { statusCode, message } } ou le choix.
 * `listClones` est injectable (tests).
 * @returns {Promise<{ voiceMode: 'synth'|'clone', voiceId: string, stability?: number } | { error: { statusCode: number, message: string } }>}
 */
/**
 * Voix par defaut d une video ordonnee sans choix de voix (articles de blog, plans du calendrier) :
 * la voix CLONEE que la DA du profil designe (`style.cloneVoiceId`), si le profil appartient au
 * proprietaire (`ADMIN_ACCOUNTS`) et que cette voix existe sur son compte ElevenLabs.
 * `singleFallback` : sans voix designee, prend l unique voix clonee du compte (jamais « la premiere »
 * quand il y en a plusieurs : ce serait celle d un autre persona). Sinon null (la voix de la DA reste).
 * `mode: 'synth'` desactive tout. Ne leve jamais.
 */
export async function resolveOwnerCloneVoice({ ownerEmail, style = null, singleFallback = false, listClones = listCloneVoices, isAdmin = isAdminEmail, mode = '' } = {}) {
  if (String(mode || '').trim().toLowerCase() === 'synth') return null;
  if (!isAdmin(ownerEmail)) return null;
  try {
    const voices = await listClones();
    const wanted = String(style?.cloneVoiceId || '');
    const chosen = wanted ? voices.find((voice) => voice.id === wanted) : (singleFallback && voices.length === 1 ? voices[0] : null);
    if (!chosen) return null;
    return { voiceMode: 'clone', voiceId: chosen.id, stability: V3_STABILITY.natural };
  } catch {
    return null;
  }
}

export async function resolveVoiceChoice({ body, user, style, listClones = listCloneVoices } = {}) {
  if (String(body?.voiceMode || '') === 'clone') {
    if (!user?.isAdmin) return { error: { statusCode: 403, message: 'La voix clonée est réservée au propriétaire du compte' } };
    const voices = await listClones();
    if (!voices.length) return { error: { statusCode: 503, message: 'Aucune voix clonée trouvée sur le compte ElevenLabs' } };
    const wanted = String(body?.voiceId || '').trim() || voices[0].id;
    const voice = voices.find((item) => item.id === wanted);
    if (!voice) return { error: { statusCode: 400, message: 'Voix clonée inconnue' } };
    const stability = Object.hasOwn(V3_STABILITY, body?.voiceStability) ? V3_STABILITY[body.voiceStability] : V3_STABILITY.natural;
    return { voiceMode: 'clone', voiceId: voice.id, stability };
  }

  const voiceId = String(body?.voiceId || '').trim() || style?.voiceId;
  if (!findFacelessVoice(voiceId)) return { error: { statusCode: 400, message: 'Voix inconnue' } };
  return { voiceMode: 'synth', voiceId };
}
