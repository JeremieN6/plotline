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
