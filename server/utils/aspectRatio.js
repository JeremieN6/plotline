// Ratios acceptes par les fournisseurs video (Veo, Kling, Seedance).
export const SUPPORTED_ASPECT_RATIOS = ['9:16', '16:9', '1:1', '4:3', '3:4', '21:9'];

// Utilise seulement quand le prompt ne dit rien: l application produit avant
// tout du contenu social (reels, stories), majoritairement vertical.
export const DEFAULT_ASPECT_RATIO = '9:16';

// Les mots d orientation ne sont retenus que qualifies ("format horizontal",
// "vertical orientation"...). Sans cette exigence, "a landscape at sunset" ou
// "portrait photography" seraient pris pour des consignes de cadrage.
const ORIENTATION_PATTERNS = [
  { ratio: '9:16', words: ['vertical', 'portrait'] },
  { ratio: '16:9', words: ['horizontal', 'landscape', 'paysage'] },
  { ratio: '1:1', words: ['square', 'carre', 'carré'] },
];

const QUALIFIERS = ['format', 'orientation', 'framing', 'cadrage', 'ratio', 'aspect'];

/**
 * Deduit le ratio demande a partir du prompt.
 * Priorite: ratio explicite ("16:9") > orientation qualifiee > null.
 * Renvoie null quand le prompt ne se prononce pas, pour laisser l appelant
 * decider de son propre repli.
 */
export function detectAspectRatioFromPrompt(prompt) {
  const text = String(prompt || '').toLowerCase();
  if (!text.trim()) {
    return null;
  }

  for (const ratio of SUPPORTED_ASPECT_RATIOS) {
    // Tolere "16:9", "16/9" et "16 : 9".
    const [width, height] = ratio.split(':');
    const pattern = new RegExp(`(?<!\\d)${width}\\s*[:/]\\s*${height}(?!\\d)`);
    if (pattern.test(text)) {
      return ratio;
    }
  }

  for (const { ratio, words } of ORIENTATION_PATTERNS) {
    for (const word of words) {
      const qualified = QUALIFIERS.some((qualifier) => (
        new RegExp(`\\b${word}\\b[\\s-]*\\b${qualifier}\\b`).test(text)
        || new RegExp(`\\b${qualifier}\\b[\\s-]*\\b${word}\\b`).test(text)
      ));

      if (qualified) {
        return ratio;
      }
    }
  }

  return null;
}

/**
 * Ratio a envoyer au fournisseur: ce que demande le prompt, sinon le repli.
 */
export function resolveAspectRatio(prompt, fallback = DEFAULT_ASPECT_RATIO) {
  return detectAspectRatioFromPrompt(prompt) || fallback;
}
