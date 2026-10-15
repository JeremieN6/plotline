import Anthropic from '@anthropic-ai/sdk';

import { buildBrandContextBlock } from './brandContext.js';
import { autoHashtagsEnabled } from './hashtagPolicy.js';
import { TEXT_STYLE_PROMPT_LINES, stripDashPunctuation } from './textStyleRules.js';

/**
 * Legende d une MARQUE (pur + un appel Claude). Le modele historique des legendes (promptTemplates.js,
 * PROMPT_CAPTION_CONTEXTUALIZED) est ecrit pour une influenceuse : anglais, premiere personne, ton joueur, et suivi d un
 * bloc de hashtags FIXE par categorie ("#lifestyle #dailyvibes..."). Pour une marque : francais, voix de la marque,
 * fondee sur sa fiche et son site, hashtags choisis pour CE contenu.
 */

const DEFAULT_MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 500;
const MAX_HASHTAGS = 8;
const MIN_HASHTAGS = 3;

function getAnthropicModel() {
  return String(process.env.ANTHROPIC_MODEL || DEFAULT_MODEL).trim() || DEFAULT_MODEL;
}

export function buildBrandCaptionSystemPrompt(context, { hashtags = autoHashtagsEnabled() } = {}) {
  const lines = [
    `Tu écris la légende Instagram du compte officiel de la marque ${context?.name || ''}.`.trim(),
    '',
    buildBrandContextBlock(context),
    '',
    'Règles :',
    '- Écris en français, sauf si la description de la marque est rédigée dans une autre langue.',
    '- C\'est la voix de la MARQUE ("nous", ou une formulation neutre). Jamais la voix d\'une personne fictive : pas de "je", "mon", "ma peau" ni de témoignage inventé.',
    '- 2 à 4 lignes : une accroche, une idée utile, puis une invitation claire (découvrir, essayer, répondre en commentaire) cohérente avec ce que propose la marque.',
    '- Appuie-toi UNIQUEMENT sur ce que disent la fiche et le site. N\'invente ni offre, ni prix, ni chiffre, ni résultat, ni promesse de santé ou de guérison.',
    '- Au plus 2 emojis. Pas de hashtags dans le texte de la légende.',
    ...TEXT_STYLE_PROMPT_LINES,
    ...(hashtags
      ? [`- Hashtags : de ${MIN_HASHTAGS + 2} à ${MAX_HASHTAGS}, pertinents pour CETTE marque et CE visuel (domaine, sujet précis, public, quelques tags plus larges), en minuscules, sans espaces, sans doublon, sans #lifestyle ni #dailyvibes génériques.`]
      : ['- Aucun hashtag. Place plutôt, naturellement dans le texte, les mots que ton public chercherait (domaine, sujet précis, public visé) : c\'est ce qui sert la recherche.']),
    '',
    'Réponds uniquement avec un objet JSON brut, sans markdown ni commentaire.',
    hashtags ? 'Forme exacte : {"caption": string, "hashtags": [string, ...]}' : 'Forme exacte : {"caption": string}',
  ];
  return lines.join('\n');
}

export function buildBrandCaptionUserPrompt({ contentType, sceneDescription }) {
  const kind = { story: 'story', reel: 'reel' }[String(contentType || '').toLowerCase()] || 'post (feed)';
  return `Type de contenu : ${kind}\nVisuel du contenu :\n${String(sceneDescription || '').trim() || '(non précisé)'}`;
}

/** Hashtags propres (pur) : sans #, sans espaces ni ponctuation, en minuscules, sans doublon, 8 au plus. */
export function normalizeHashtags(list) {
  const seen = new Set();
  const result = [];
  for (const item of Array.isArray(list) ? list : []) {
    const tag = String(item || '')
      .toLowerCase()
      .normalize('NFC')
      .replace(/^#+/, '')
      .replace(/[^\p{L}\p{N}_]/gu, '');
    if (tag.length < 2 || tag.length > 40 || seen.has(tag)) continue;
    seen.add(tag);
    result.push(tag);
    if (result.length >= MAX_HASHTAGS) break;
  }
  return result;
}

/** Reponse de Claude -> { caption, hashtags } (pur) ; null si inexploitable. */
export function parseBrandCaption(rawText) {
  const text = String(rawText || '').trim();
  if (!text) return null;

  const withoutFence = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const start = withoutFence.indexOf('{');
  const end = withoutFence.lastIndexOf('}');
  const candidate = start !== -1 && end > start ? withoutFence.slice(start, end + 1) : withoutFence;

  let parsed;
  try {
    parsed = JSON.parse(candidate);
  } catch {
    return null;
  }

  const caption = stripDashPunctuation(String(parsed?.caption || '')).replace(/#[\p{L}\p{N}_]+/gu, '').replace(/[ \t]+\n/g, '\n').trim();
  if (!caption) return null;
  return { caption, hashtags: normalizeHashtags(parsed?.hashtags) };
}

/** Texte final enregistre : legende, ligne vide, hashtags (pur). */
export function formatBrandCaption({ caption, hashtags }) {
  const tags = normalizeHashtags(hashtags).map((tag) => `#${tag}`).join(' ');
  return tags ? `${caption}\n\n${tags}` : caption;
}

/**
 * Ecrit la legende de la marque. Ne leve jamais : '' si le contexte manque, si Claude echoue ou renvoie quelque
 * chose d inexploitable (l appelant retombe alors sur l ancien comportement).
 */
export async function generateBrandCaption({ context, contentType, sceneDescription, apiKey }) {
  const key = String(apiKey || process.env.ANTHROPIC_API_KEY || '').trim();
  if (!key || !context?.name) return '';

  try {
    const anthropic = new Anthropic({ apiKey: key });
    const response = await anthropic.messages.create({
      model: getAnthropicModel(),
      max_tokens: MAX_TOKENS,
      system: buildBrandCaptionSystemPrompt(context),
      messages: [{ role: 'user', content: buildBrandCaptionUserPrompt({ contentType, sceneDescription }) }],
    });

    const text = (response?.content || []).filter((block) => block?.type === 'text').map((block) => block.text).join('\n');
    const parsed = parseBrandCaption(text);
    // Hashtags automatiques desactives : meme si Claude en renvoie, on ne les ajoute pas.
    return parsed ? formatBrandCaption({ ...parsed, hashtags: autoHashtagsEnabled() ? parsed.hashtags : [] }) : '';
  } catch (error) {
    console.warn('[brand] legende de marque impossible, repli sur la legende standard', {
      reason: String(error?.message || error).split('\n')[0].slice(0, 160),
    });
    return '';
  }
}
