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

export function selectVideoModel(prompt) {
  if (containsKeyword(prompt, DYNAMIC_KEYWORDS)) {
    return 'kling';
  }

  if (containsKeyword(prompt, CINEMATIC_KEYWORDS)) {
    return 'veo';
  }

  // Veo par defaut: c est le seul fournisseur verifie de bout en bout en production.
  // Seedance reste selectionnable explicitement depuis le studio, mais ne devient
  // pas le choix automatique tant qu il n a pas ete eprouve sur de vrais rendus.
  return 'veo';
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
