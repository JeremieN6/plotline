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

  // Veo par defaut: il gere nativement le 9:16 et c est le seul fournisseur
  // verifie de bout en bout. Seedance reste selectionnable explicitement, mais
  // ne peut plus etre choisi par defaut: son endpoint par defaut n existe pas
  // (api.seedance.ai ne resout pas), ce qui produisait un "fetch failed".
  return 'veo';
}
