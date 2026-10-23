import { V3_STABILITY, listCloneVoices } from './elevenLabsTts.js';
import { findFacelessVoice } from '../data/facelessCatalog.js';

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
