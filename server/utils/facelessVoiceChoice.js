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
 * Voix par defaut des videos ordonnees par un appelant sans session (articles de blog) :
 * la voix clonee du proprietaire si le profil lui appartient (`ADMIN_ACCOUNTS`) et qu une voix
 * clonee existe, sinon null (l appelant garde la voix de la DA). `ARTICLE_VIDEO_VOICE=synth`
 * desactive ce choix. Ne leve jamais.
 */
export async function resolveOwnerCloneVoice({ ownerEmail, listClones = listCloneVoices, isAdmin = isAdminEmail, mode = process.env.ARTICLE_VIDEO_VOICE } = {}) {
  if (String(mode || '').trim().toLowerCase() === 'synth') return null;
  if (!isAdmin(ownerEmail)) return null;
  try {
    const voices = await listClones();
    if (!voices.length) return null;
    return { voiceMode: 'clone', voiceId: voices[0].id, stability: V3_STABILITY.natural };
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
