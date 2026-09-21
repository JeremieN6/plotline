/**
 * Decoupe un script parle en segments compatibles avec les generations Omni
 * Flash de 10s (voir videoGeneration.js). Fonction pure: aucun appel reseau,
 * pas de connaissance du modele, juste du texte en entree/sortie.
 */

// Sous le plafond 15-25 mots deja eprouve en single-turn (mode "court" de
// sassify.fr) -- une marge est gardee pour absorber la variance de pacing.
export const OMNIFLASH_SEGMENT_MAX_WORDS = 22;

// Plafond dur cote Google: Omni 1.1 etend une video par tranches de 10s,
// jusqu a 40s cumules au maximum -- donc 4 segments, jamais plus.
export const OMNIFLASH_MAX_SEGMENTS = 4;

function splitIntoSentences(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function countWords(text) {
  return String(text || '').trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Empile les phrases dans des segments d au plus `maxWordsPerSegment` mots,
 * sans jamais couper une phrase en plein mot. Une phrase a elle seule plus
 * longue que la limite forme son propre segment (mieux vaut un segment un peu
 * long qu une phrase tronquee au milieu). S arrete a `maxSegments`: le reste
 * est abandonne, mais son nombre de mots est renvoye pour que l appelant
 * puisse logger la troncature.
 */
export function splitScriptIntoSegments(text, {
  maxWordsPerSegment = OMNIFLASH_SEGMENT_MAX_WORDS,
  maxSegments = OMNIFLASH_MAX_SEGMENTS,
} = {}) {
  const sentences = splitIntoSentences(text);

  if (!sentences.length) {
    return { segments: [], truncatedWordCount: 0 };
  }

  const segments = [];
  let currentSentences = [];
  let currentWordCount = 0;

  for (const sentence of sentences) {
    const sentenceWordCount = countWords(sentence);

    if (currentSentences.length && currentWordCount + sentenceWordCount > maxWordsPerSegment) {
      segments.push(currentSentences.join(' '));
      currentSentences = [];
      currentWordCount = 0;
    }

    currentSentences.push(sentence);
    currentWordCount += sentenceWordCount;
  }

  if (currentSentences.length) {
    segments.push(currentSentences.join(' '));
  }

  if (segments.length <= maxSegments) {
    return { segments, truncatedWordCount: 0 };
  }

  const kept = segments.slice(0, maxSegments);
  const dropped = segments.slice(maxSegments);
  const truncatedWordCount = dropped.reduce((total, segment) => total + countWords(segment), 0);

  return { segments: kept, truncatedWordCount };
}
