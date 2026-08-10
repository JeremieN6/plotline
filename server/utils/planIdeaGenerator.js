import Anthropic from '@anthropic-ai/sdk';

import { buildFallbackIdea } from './contentPlanner.js';

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

export function buildPlanSystemPrompt(profile) {
  const name = String(profile?.name || '').trim();
  const niche = String(profile?.niche || '').trim();
  const style = String(profile?.style || '').trim();
  const audience = String(profile?.targetAudience || '').trim();
  const description = String(profile?.description || '').trim();

  return [
    `Tu es directeur artistique pour ${name || 'un compte social'}.`,
    niche ? `Niche: ${niche}.` : '',
    style ? `Style visuel: ${style}.` : '',
    audience ? `Audience visee: ${audience}.` : '',
    description ? `Contexte: ${description}` : '',
    '',
    'On te donne des creneaux de publication deja dates, avec leur format impose.',
    'Pour chaque creneau, ecris une idee de contenu coherente avec la ligne editoriale.',
    '',
    'Contraintes:',
    '- Le champ "prompt" decrit la scene a generer en image ou video. Il doit etre',
    '  concret et visuel: sujet, cadrage, lumiere, decor. Pas de texte a incruster.',
    '- Le champ "caption" est la legende publiee, en francais, ton naturel.',
    '- Le champ "hashtags" contient 3 a 6 hashtags separes par des espaces.',
    '- Les idees d un meme plan doivent se completer, pas se repeter.',
    '- Un format STORY est spontane, FEED est soigne, REEL est en mouvement.',
    '',
    'Reponds uniquement avec un tableau JSON brut, sans markdown ni commentaire.',
    'Chaque element: {"position": number, "prompt": string, "caption": string, "hashtags": string}',
  ].filter(Boolean).join('\n');
}

export function buildPlanUserPrompt(slots) {
  const lines = slots.map((slot) => {
    const date = slot.scheduledAt instanceof Date
      ? slot.scheduledAt.toISOString().slice(0, 16).replace('T', ' ')
      : String(slot.scheduledAt);
    return `- position ${slot.position} | ${date} | format ${slot.format} | plateforme ${slot.platform}`;
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
      caption: String(item?.caption || '').trim(),
      hashtags: String(item?.hashtags || '').trim(),
    }))
    .filter((item) => Number.isFinite(item.position) && item.prompt);
}

/**
 * Associe chaque creneau a son idee. Un creneau sans idee exploitable recoit
 * l amorce deterministe: le plan reste complet et editable.
 */
export function mergeIdeasIntoSlots(slots, ideas, profile) {
  const byPosition = new Map(ideas.map((idea) => [idea.position, idea]));

  return slots.map((slot) => {
    const idea = byPosition.get(slot.position);

    if (!idea) {
      const fallback = buildFallbackIdea({ profile, format: slot.format, position: slot.position });
      return { ...slot, ...fallback };
    }

    return {
      ...slot,
      prompt: idea.prompt,
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
export async function generatePlanIdeas({ profile, slots, apiKey }) {
  const key = String(apiKey || process.env.ANTHROPIC_API_KEY || '').trim();

  if (!key || !slots.length) {
    return {
      items: mergeIdeasIntoSlots(slots, [], profile),
      usedFallback: true,
      reason: key ? 'Aucun creneau a remplir' : 'ANTHROPIC_API_KEY non configuree',
    };
  }

  try {
    const anthropic = new Anthropic({ apiKey: key });
    const response = await anthropic.messages.create({
      model: getAnthropicModel(),
      max_tokens: MAX_TOKENS,
      system: buildPlanSystemPrompt(profile),
      messages: [{ role: 'user', content: buildPlanUserPrompt(slots) }],
    });

    const text = (response?.content || [])
      .filter((block) => block?.type === 'text')
      .map((block) => block.text)
      .join('\n');

    const ideas = parsePlanIdeas(text);
    const items = mergeIdeasIntoSlots(slots, ideas, profile);
    const missing = items.filter((item) => item.isFallback).length;

    return {
      items,
      usedFallback: missing > 0,
      reason: missing ? `${missing} idee(s) non exploitables, repli applique` : '',
    };
  } catch (error) {
    return {
      items: mergeIdeasIntoSlots(slots, [], profile),
      usedFallback: true,
      reason: String(error?.message || 'Appel Claude impossible'),
    };
  }
}
