/**
 * Compare ce que la video DIT (transcription) a ce qu elle DEVAIT dire.
 * Fonction pure. Omni Flash joue le texte plus qu il ne le lit : il repete la fin
 * d une phrase pour combler son creneau de 10s ou saute des mots (constate sur
 * des videos de blog en francais).
 */

// Tolere quelques ecarts de transcription (environ 3 mots sur 20) : au-dela,
// c est un vrai defaut de parole (repetition, mot saute, mot invente).
export const SPEECH_MAX_WORD_ERROR_RATE = 0.15;

export function normalizeSpokenWords(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’']/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function editDistance(a, b) {
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j);

  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
    }
    previous = current;
  }

  return previous[b.length];
}

export function compareSpeech(expectedText, heardText, maxWordErrorRate = SPEECH_MAX_WORD_ERROR_RATE) {
  const expected = normalizeSpokenWords(expectedText);
  const heard = normalizeSpokenWords(heardText);

  if (!expected.length) {
    return { ok: true, wordErrorRate: 0, distance: 0, expectedLength: 0, heardLength: heard.length };
  }

  const distance = editDistance(expected, heard);
  const wordErrorRate = distance / expected.length;

  return {
    ok: wordErrorRate <= maxWordErrorRate,
    wordErrorRate,
    distance,
    expectedLength: expected.length,
    heardLength: heard.length,
  };
}
