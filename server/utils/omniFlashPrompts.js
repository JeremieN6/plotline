import { ART_DIRECTIONS } from '../data/artDirections.js';

/**
 * Prompts de parole d Omni Flash, sans appel reseau. Le modele "joue" le texte
 * plus qu il ne le lit : sans consigne explicite il comble un creneau de 10s en
 * repetant des mots, et sur un segment chaine il reprend souvent le dernier
 * mot du segment precedent (constate sur une video de blog de 40s).
 */

// Rythme par defaut (videos d articles) : pose contre les repetitions. Une
// direction artistique peut le remplacer par son propre `speechPace`.
const DEFAULT_SPEECH_PACE = 'at a calm natural pace that fills about 10 seconds';

/**
 * Rythme de parole a utiliser pour une scene : celui de la direction artistique
 * dont le texte figure dans la scene (le texte de la DA est ajoute tel quel en
 * tete de la scene, voir artDirections.js), sinon le rythme par defaut.
 */
export function resolveSpeechPace(scenePrompt) {
  const scene = String(scenePrompt || '');
  const direction = ART_DIRECTIONS.find((item) => item.speechPace && scene.includes(item.scenePrompt));
  return direction ? direction.speechPace : DEFAULT_SPEECH_PACE;
}

function speechRules(scenePrompt) {
  return `Say the quoted text exactly once, word for word, in French, ${resolveSpeechPace(scenePrompt)}. Never repeat a word or a sentence, never add, skip or invent a word, and stop speaking right after the last word. Do not show subtitles, captions or any on-screen text: the video must contain no written words at all.`;
}

export function buildFirstSegmentPrompt(scenePrompt, text) {
  return `${scenePrompt}. The person speaks clearly, in French, with natural lip movement synced to the speech. ${speechRules(scenePrompt)} Text: "${text}"`;
}

// `scenePrompt` (optionnel) ne sert qu a retrouver le rythme de la direction
// artistique de la video ; sans lui, le rythme par defaut s applique.
export function buildContinuationPrompt(text, scenePrompt) {
  return `Continue this exact scene naturally, maintaining the same character, setting, and visual style, as one continuous take. Everything said earlier in this video has already been said: do NOT say any earlier word again, not even the last word of the previous sentence. Begin speaking directly with the first word of the new text, with no restart, no pause and no repeated word at the junction. The person keeps speaking clearly, in French, with natural lip movement synced to the speech. ${speechRules(scenePrompt)} New text: "${text}"`;
}
