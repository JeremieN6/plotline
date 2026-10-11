import { isVeoEnabled } from './veoAvailability.js';

const DYNAMIC_KEYWORDS = [
  'dance', 'danse', 'action', 'fight', 'run', 'course', 'jump', 'saut',
  'dynamic', 'dynamique', 'sport', 'mouvement', 'energy', 'energetic',
];

const CINEMATIC_KEYWORDS = [
  'cinematic', 'cinematique', 'landscape', 'paysage', 'ambiance', 'slow',
  'lente', 'atmosphere', 'atmospheric', 'panorama', 'b-roll', 'broll',
];

function containsKeyword(prompt, keywords) {
  const normalized = String(prompt || '').toLowerCase();
  return keywords.some((keyword) => new RegExp(`\\b${keyword}\\b`).test(normalized));
}

/**
 * @param {string} prompt
 * @param {{ veoEnabled?: boolean }} [options] `veoEnabled` : injectable (tests) ; par defaut
 *   `isVeoEnabled()`. Veo etant retire le 22 octobre 2026 (voir veoAvailability.js), Kling le remplace.
 */
export function selectVideoModel(prompt, options = {}) {
  const veoEnabled = options.veoEnabled ?? isVeoEnabled();

  if (containsKeyword(prompt, DYNAMIC_KEYWORDS)) {
    return 'kling';
  }

  if (containsKeyword(prompt, CINEMATIC_KEYWORDS)) {
    return veoEnabled ? 'veo' : 'kling';
  }

  // Veo par defaut tant qu il existe: c etait le seul fournisseur verifie de bout en
  // bout en production. Une fois retire, Kling (texte ou image vers video) prend la
  // suite. Seedance reste selectionnable explicitement depuis le studio, mais ne
  // devient pas le choix automatique tant qu il n a pas ete eprouve sur de vrais rendus.
  return veoEnabled ? 'veo' : 'kling';
}

/**
 * Repere une repartie entre guillemets dans un prompt libre et separe decor et
 * texte a prononcer.
 *
 * Sert a decider si Omni Flash (seul modele du projet avec lip-sync natif) est
 * justifie pour un personnage fictif: sans mot a synchroniser sur les levres,
 * Omni Flash n apporte rien par rapport a Kling/Veo, qui restent le choix
 * eprouve pour du mouvement pur (danse, action, plan cinematique) -- voir
 * `selectVideoModel`. Ce n est donc pas Omni Flash "par defaut", mais Omni
 * Flash quand le contenu lui-meme contient effectivement une parole a rendre.
 */
export function extractQuotedDialogue(prompt) {
  const text = String(prompt || '');
  const match = text.match(/[«"]([^»"]{3,})[»"]/);
  if (!match) return null;

  const dialogue = match[1].trim();
  if (!dialogue) return null;

  const scene = `${text.slice(0, match.index)} ${text.slice(match.index + match[0].length)}`
    .replace(/\s+/g, ' ')
    .trim();

  return { dialogue, scene: scene || text.trim() };
}
