import Anthropic from '@anthropic-ai/sdk';
import { FACELESS_LAYOUTS } from '../data/facelessCatalog.js';
import { describeStyleForPrompt, normalizeFacelessStyle } from './facelessStyle.js';
import { describeFacelessPersona, MAX_SOURCE_TEXT, normalizeFacelessDuration } from './facelessPlanGenerator.js';
import { TEXT_STYLE_PROMPT_LINES } from './textStyleRules.js';

const DEFAULT_MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 900;
export const MAX_ADVICE_QUESTION = 1500;
export const MAX_ADVICE_HISTORY = 8;
const MAX_HISTORY_CHARS = 2500;
const MAX_PLAN_CHARS = 6000;
const WORDS_PER_SECOND = 2.5;

const clip = (value, max) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

/**
 * Pur : le plan en cours, en lignes lisibles (une scene par ligne). Tolere un plan incomplet
 * (trame a ecrire soi-meme : scenes vides) : c est un simple texte pour Claude, rien n est applique.
 */
export function summarizePlanForAdvice(plan) {
  const scenes = Array.isArray(plan?.scenes) ? plan.scenes : [];
  const lines = scenes.map((scene, index) => {
    const parts = [
      `Scène ${index + 1} [${clip(scene?.layout, 20) || 'avatar'}]`,
      scene?.say ? `dit : « ${clip(scene.say, 400)} »` : 'dit : (vide)',
      scene?.title ? `titre : ${clip(scene.title, 80)}` : '',
      scene?.text ? `texte écran : ${clip(scene.text, 160)}` : '',
      scene?.word ? `mot : ${clip(scene.word, 40)}` : '',
      Array.isArray(scene?.items) && scene.items.length ? `éléments : ${scene.items.map((item) => clip(item?.text, 60)).filter(Boolean).join(' / ')}` : '',
    ].filter(Boolean);
    return parts.join(' ; ');
  });
  const header = [plan?.title ? `Titre : ${clip(plan.title, 120)}` : '', plan?.caption ? `Légende : ${clip(plan.caption, 300)}` : ''].filter(Boolean);
  return [...header, ...lines].join('\n').slice(0, MAX_PLAN_CHARS);
}

/** Pur : historique de discussion garde en memoire cote page, reborne et nettoye. */
export function normalizeAdviceHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .filter((item) => item && (item.role === 'user' || item.role === 'assistant') && typeof item.content === 'string' && item.content.trim())
    .slice(-MAX_ADVICE_HISTORY)
    .map((item) => ({ role: item.role, content: item.content.trim().slice(0, MAX_HISTORY_CHARS) }));
}

export function buildAdviceSystemPrompt({ persona = null, style = null, targetSeconds = 30 } = {}) {
  const da = style || normalizeFacelessStyle({});
  const personaText = describeFacelessPersona(persona);
  const seconds = normalizeFacelessDuration(targetSeconds);
  return [
    'Tu es un scenariste et monteur experimente de videos verticales "faceless" (TikTok, Reels) : une voix off, des cartes de texte a l ecran, parfois un avatar.',
    'Le createur te parle pendant qu il prepare son script. Tu es son avis de confiance : tu reponds a sa question, tu ne modifies RIEN toi-meme.',
    '',
    'COMMENT REPONDRE',
    '- En francais, tutoiement, direct et concret. Court : 120 mots environ, plus seulement si la question l exige.',
    '- Franc : si le script ou la direction sont bons tels quels, dis-le et dis pourquoi. Ne propose pas de changements pour en proposer.',
    '- Chaque conseil est justifie en une phrase (ce que ca change pour le spectateur : accroche, rythme, clarte, retention).',
    '- Cite les scenes par leur numero. Quand tu proposes une reformulation, donne la phrase exacte.',
    '- Si le createur n a pas encore de script, dis-lui comment t y prendre (structure, ce qu il faut dire en premier, ce qu il faut couper) pour la direction qu il donne.',
    '- Ne renvoie jamais de JSON ni de plan complet : le createur te demandera de l appliquer s il le souhaite.',
    '- Si une information manque pour bien repondre, dis laquelle plutot que d inventer.',
    ...TEXT_STYLE_PROMPT_LINES,
    '',
    'CE QUE LE MONTAGE SAIT FAIRE',
    `- Duree visee : environ ${seconds} s, soit ${Math.round(seconds * WORDS_PER_SECOND)} mots dits.`,
    '- Mises en page possibles : ' + Object.entries(FACELESS_LAYOUTS).map(([key, desc]) => `${key} (${desc})`).join(' ; ') + '.',
    '- La premiere scene est une accroche, la derniere un appel a l action. Le texte a l ecran resume, il ne recopie pas ce que dit la voix.',
    '',
    'DIRECTION ARTISTIQUE DE LA VIDEO',
    describeStyleForPrompt(da),
    personaText ? `\nPERSONA QUI PARLE :\n${personaText}` : '',
  ].filter((line) => line !== '').join('\n');
}

/** Pur : message utilisateur = contexte actuel (brief, texte source, plan) + la question. */
export function buildAdviceUserMessage({ question, idea = '', sourceText = '', direction = '', plan = null } = {}) {
  const planText = plan ? summarizePlanForAdvice(plan) : '';
  const blocks = [
    idea.trim() ? `BRIEF DU CREATEUR :\n${idea.trim().slice(0, 2000)}` : '',
    String(direction || '').trim() ? `DIRECTIVES DE MONTAGE :\n${String(direction).trim().slice(0, 1500)}` : '',
    sourceText.trim() ? `TEXTE SOURCE (matiere premiere) :\n${sourceText.trim().slice(0, MAX_SOURCE_TEXT)}` : '',
    planText ? `PLAN ACTUEL (tel que le createur le voit maintenant) :\n${planText}` : 'Pas de plan pour l instant.',
    `QUESTION :\n${String(question).trim().slice(0, MAX_ADVICE_QUESTION)}`,
  ].filter(Boolean);
  return blocks.join('\n\n');
}

/** Appel Claude, texte seulement. `createMessage` est injectable (tests). */
export async function askFacelessAdvice({ question, history = [], idea = '', sourceText = '', direction = '', plan = null, persona = null, style = null, targetSeconds = 30, apiKey, createMessage } = {}) {
  if (!String(question || '').trim()) throw new Error('Question vide');
  const key = String(apiKey || process.env.ANTHROPIC_API_KEY || '').trim();
  if (!createMessage && !key) throw new Error('ANTHROPIC_API_KEY non configuree');

  const request = {
    model: String(process.env.ANTHROPIC_MODEL || DEFAULT_MODEL).trim() || DEFAULT_MODEL,
    max_tokens: MAX_TOKENS,
    system: buildAdviceSystemPrompt({ persona, style, targetSeconds }),
    messages: [
      ...normalizeAdviceHistory(history),
      { role: 'user', content: buildAdviceUserMessage({ question, idea, sourceText, direction, plan }) },
    ],
  };
  const response = await (createMessage ? createMessage(request) : new Anthropic({ apiKey: key }).messages.create(request));
  const text = (response?.content || []).filter((block) => block?.type === 'text').map((block) => block.text).join('\n').trim();
  if (!text) throw new Error('Reponse vide');
  return text;
}
