/**
 * Prompts de parole d Omni Flash, sans appel reseau. Le modele "joue" le texte
 * plus qu il ne le lit : sans consigne explicite il comble un creneau de 10s en
 * repetant des mots, et sur un segment chaine il reprend souvent le dernier
 * mot du segment precedent (constate sur une video de blog de 40s).
 */

const SPEECH_RULES =
  'Say the quoted text exactly once, word for word, in French, at a calm natural pace that fills about 10 seconds. Never repeat a word or a sentence, never add, skip or invent a word, and stop speaking right after the last word.';

export function buildFirstSegmentPrompt(scenePrompt, text) {
  return `${scenePrompt}. The person speaks clearly, in French, with natural lip movement synced to the speech. ${SPEECH_RULES} Text: "${text}"`;
}

export function buildContinuationPrompt(text) {
  return `Continue this exact scene naturally, maintaining the same character, setting, and visual style, as one continuous take. Everything said earlier in this video has already been said: do NOT say any earlier word again, not even the last word of the previous sentence. Begin speaking directly with the first word of the new text, with no restart, no pause and no repeated word at the junction. The person keeps speaking clearly, in French, with natural lip movement synced to the speech. ${SPEECH_RULES} New text: "${text}"`;
}
