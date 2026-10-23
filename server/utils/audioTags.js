/**
 * Balises de ton d Eleven v3 (`[excited]`, `[curious]`...) ecrites dans le texte dit.
 *
 * Elles ne servent qu a la VOIX CLONEE : tout le reste du montage (sous-titres,
 * reperes sur un mot, decompte des mots par scene) ne doit jamais les voir.
 * Tout est pur.
 */

/** Balises acceptees (liste blanche : le reste est retire, pour ne jamais faire LIRE une balise inventee). */
export const AUDIO_TAGS = {
  excited: 'enthousiaste, plein d énergie',
  curious: 'curieux, une question qu on se pose',
  surprised: 'étonné, incrédule',
  serious: 'grave, posé',
  sarcastic: 'ironique, second degré',
  mischievously: 'malicieux, complice',
  thoughtful: 'pensif, qui réfléchit',
  annoyed: 'agacé',
  angry: 'en colère, tranchant',
  sad: 'triste, déçu',
  whispers: 'chuchoté, confidence',
  sighs: 'soupir, lassitude',
  exhales: 'souffle, soulagement',
  laughs: 'rire',
  'short pause': 'courte pause',
  'long pause': 'longue pause',
};

const TAG = /\[([^\]\n]{1,24})\]/g;

/** Pur : le texte sans aucune balise (pour compter, comparer ou afficher les mots dits). */
export function stripAudioTags(text) {
  return String(text ?? '').replace(TAG, ' ').replace(/\s+/g, ' ').trim();
}

/** Pur : le texte contient-il au moins une balise ? */
export function hasAudioTags(text) {
  TAG.lastIndex = 0;
  return TAG.test(String(text ?? ''));
}

/**
 * Pur : garde uniquement les balises de la liste blanche (en minuscules), retire les autres,
 * et assure un espace apres chaque balise (sinon elle colle au mot suivant).
 */
export function normalizeAudioTags(text) {
  return String(text ?? '')
    .replace(TAG, (match, inner) => {
      const name = inner.trim().toLowerCase().replace(/\s+/g, ' ');
      return Object.hasOwn(AUDIO_TAGS, name) ? ` [${name}] ` : ' ';
    })
    // Une balise coupee en fin de texte (longueur maximale atteinte) n est pas une balise : on la retire.
    .replace(/\[[^\]]*$/, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Pur : les balises d un texte, dans l ordre ([ "excited", "sighs" ]). */
export function listAudioTags(text) {
  const found = [];
  for (const match of String(text ?? '').matchAll(TAG)) found.push(match[1].trim().toLowerCase());
  return found;
}
