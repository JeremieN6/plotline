import Anthropic from '@anthropic-ai/sdk';

import { buildFallbackIdea } from './contentPlanner.js';
import { autoHashtagsEnabled } from './hashtagPolicy.js';
import { TEXT_STYLE_PROMPT_LINES, stripDashPunctuation } from './textStyleRules.js';
import { buildPlannerPersonalityBlock, buildVisualUniverse, pillarForSlot } from './personalityPlanning.js';

/**
 * Redaction des idees d un plan editorial.
 *
 * Claude propose le texte (angle, legende, hashtags) pour des creneaux dont la
 * date et le format sont deja fixes par la cadence. Il ne decide donc jamais du
 * rythme: si l appel echoue, le plan existe quand meme, avec des amorces
 * editables au lieu d une page vide.
 */

const DEFAULT_MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 4096;

function getAnthropicModel() {
  return String(process.env.ANTHROPIC_MODEL || DEFAULT_MODEL).trim() || DEFAULT_MODEL;
}

// Une STORY n a pas de scene : son clip est choisi a la generation dans une banque Pinterest, jamais depuis un texte ecrit ici.
// Ce texte est ce qui est enregistre comme "prompt" du contenu : il dit la verite plutot que de laisser croire a une scene.
export const STORY_CLIP_NOTE = 'Clip choisi automatiquement dans la banque Pinterest (paysage, objets, pièce, sans personnage).';

/**
 * @param {object} profile
 * @param {{ personality?: unknown, reelEngine?: 'faceless'|'legacy' }} [options]
 *   `personality` : personnalite enregistree du profil (facultative) ;
 *   `reelEngine` : comment les REEL seront produits (voir reelEngine.js).
 */
export function buildPlanSystemPrompt(profile, { personality, reelEngine = 'legacy', hashtags = autoHashtagsEnabled() } = {}) {
  const name = String(profile?.name || '').trim();
  const niche = String(profile?.niche || '').trim();
  const style = String(profile?.style || '').trim();
  const audience = String(profile?.targetAudience || '').trim();
  const description = String(profile?.description || '').trim();
  const personalityBlock = buildPlannerPersonalityBlock(personality);
  const hasPillars = /Piliers de contenu/.test(personalityBlock);
  const hasUniverse = Boolean(buildVisualUniverse(personality));
  const faceless = reelEngine === 'faceless';

  return [
    `Tu es directeur artistique pour ${name || 'un compte social'}.`,
    niche ? `Niche: ${niche}${personalityBlock ? ' (indicative : la personnalité ci-dessous prime).' : '.'}` : '',
    // Le champ "style" du profil est souvent une description physique : l univers visuel de la personnalite le remplace quand il existe.
    style && !hasUniverse ? `Style visuel: ${style}.` : '',
    audience ? `Audience visee: ${audience}.` : '',
    description ? `Contexte: ${description}` : '',
    personalityBlock ? `\n${personalityBlock}` : '',
    '',
    'On te donne des creneaux de publication deja dates, avec leur format impose.',
    'Pour chaque creneau, ecris une idee de contenu coherente avec la ligne editoriale.',
    hasPillars ? 'Chaque creneau indique un pilier de contenu : l idee doit le traiter vraiment, sans recopier son intitule. Respecte les lignes rouges.' : '',
    '',
    'Contraintes:',
    faceless
      ? '- Le champ "prompt" depend du format. FEED : la scene d une image fixe (sujet, cadrage, lumiere, decor, pas de texte a incruster). REEL : une video faceless (voix off, avatar dessine, textes animes) : ecris le SUJET et l angle precis, en francais, avec les 3 ou 4 idees que la voix va developper ; aucune scene a filmer, aucun decor reel.'
      : '- Le champ "prompt" decrit la scene a generer en image ou video. Il doit etre\n  concret et visuel: sujet, cadrage, lumiere, decor. Pas de texte a incruster.',
    '- Pour un creneau STORY, le clip est choisi automatiquement dans une banque de videos (paysage, objets, piece, sans personnage) : laisse "prompt" vide et ecris seulement la legende' + (hashtags ? ' et les hashtags' : '') + ' ; la legende evoque une ambiance, sans parler d un personnage a l ecran.',
    '- Le champ "caption" est la legende publiee, en francais, ton naturel.',
    ...TEXT_STYLE_PROMPT_LINES,
    hashtags
      ? '- Le champ "hashtags" contient 3 a 6 hashtags separes par des espaces.'
      : '- Le champ "hashtags" reste une chaine vide : aucun hashtag. Place plutot dans la legende, naturellement, les mots que le public cherche (domaine, sujet precis).',
    '- Les idees d un meme plan doivent se completer, pas se repeter.',
    '- Un format STORY est spontane, FEED est soigne, REEL est en mouvement.',
    '',
    'Reponds uniquement avec un tableau JSON brut, sans markdown ni commentaire.',
    'Chaque element: {"position": number, "prompt": string, "caption": string, "hashtags": string}',
  ].filter(Boolean).join('\n');
}

export function buildPlanUserPrompt(slots, { pillars = [], pillarOffset = 0 } = {}) {
  const lines = slots.map((slot) => {
    const date = slot.scheduledAt instanceof Date
      ? slot.scheduledAt.toISOString().slice(0, 16).replace('T', ' ')
      : String(slot.scheduledAt);
    const pillar = pillarForSlot(pillars, slot.position, pillarOffset);
    return `- position ${slot.position} | ${date} | format ${slot.format} | plateforme ${slot.platform}${pillar ? ` | pilier : ${pillar}` : ''}`;
  });

  return `Creneaux a remplir:\n${lines.join('\n')}`;
}

/**
 * Claude renvoie parfois le JSON entoure de texte ou d une cloture markdown,
 * malgre la consigne. On isole le tableau plutot que d echouer sur un detail
 * de mise en forme.
 */
export function parsePlanIdeas(rawText) {
  const text = String(rawText || '').trim();
  if (!text) return [];

  const withoutFence = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  const start = withoutFence.indexOf('[');
  const end = withoutFence.lastIndexOf(']');
  const candidate = start !== -1 && end > start ? withoutFence.slice(start, end + 1) : withoutFence;

  let parsed;
  try {
    parsed = JSON.parse(candidate);
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) return [];

  return parsed
    .map((item) => ({
      position: Number(item?.position),
      prompt: String(item?.prompt || '').trim(),
      caption: stripDashPunctuation(String(item?.caption || '')).trim(),
      hashtags: String(item?.hashtags || '').trim(),
    }))
    .filter((item) => Number.isFinite(item.position) && (item.prompt || item.caption));
}

/**
 * Associe chaque creneau a son idee. Un creneau sans idee exploitable recoit
 * l amorce deterministe: le plan reste complet et editable.
 */
export function mergeIdeasIntoSlots(slots, ideas, profile, { reelEngine } = {}) {
  const byPosition = new Map(ideas.map((idea) => [idea.position, idea]));

  return slots.map((slot) => {
    const idea = byPosition.get(slot.position);
    const isStory = String(slot.format || '').toUpperCase() === 'STORY';

    if (!idea) {
      const fallback = buildFallbackIdea({ profile, format: slot.format, position: slot.position, reelEngine });
      return { ...slot, ...fallback, ...(isStory ? { prompt: STORY_CLIP_NOTE } : {}) };
    }

    return {
      ...slot,
      prompt: isStory ? STORY_CLIP_NOTE : (idea.prompt || buildFallbackIdea({ profile, format: slot.format, position: slot.position, reelEngine }).prompt),
      caption: idea.caption,
      hashtags: idea.hashtags,
      isFallback: false,
    };
  });
}

/**
 * Remplit les creneaux. Ne leve jamais: un plan de repli vaut mieux qu une
 * erreur, l utilisateur relira de toute facon chaque idee avant generation.
 */
export async function generatePlanIdeas({ profile, slots, apiKey, personality, reelEngine = 'legacy', pillars = [], pillarOffset = 0 }) {
  const key = String(apiKey || process.env.ANTHROPIC_API_KEY || '').trim();

  if (!key || !slots.length) {
    return {
      items: mergeIdeasIntoSlots(slots, [], profile, { reelEngine }),
      usedFallback: true,
      reason: key ? 'Aucun creneau a remplir' : 'ANTHROPIC_API_KEY non configuree',
    };
  }

  try {
    const anthropic = new Anthropic({ apiKey: key });
    const response = await anthropic.messages.create({
      model: getAnthropicModel(),
      max_tokens: MAX_TOKENS,
      system: buildPlanSystemPrompt(profile, { personality, reelEngine }),
      messages: [{ role: 'user', content: buildPlanUserPrompt(slots, { pillars, pillarOffset }) }],
    });

    const text = (response?.content || [])
      .filter((block) => block?.type === 'text')
      .map((block) => block.text)
      .join('\n');

    // Hashtags automatiques desactives (hashtagPolicy.js) : meme si Claude en renvoie, on ne les garde pas.
    const ideas = parsePlanIdeas(text).map((idea) => (autoHashtagsEnabled() ? idea : { ...idea, hashtags: '' }));
    const items = mergeIdeasIntoSlots(slots, ideas, profile, { reelEngine });
    const missing = items.filter((item) => item.isFallback).length;

    return {
      items,
      usedFallback: missing > 0,
      reason: missing ? `${missing} idee(s) non exploitables, repli applique` : '',
    };
  } catch (error) {
    return {
      items: mergeIdeasIntoSlots(slots, [], profile, { reelEngine }),
      usedFallback: true,
      reason: String(error?.message || 'Appel Claude impossible'),
    };
  }
}
