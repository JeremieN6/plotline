/**
 * Decrit AUTOMATIQUEMENT le style graphique d une image d avatar (3D animee, chibi,
 * aplats, aquarelle...), pour que le style demande au modele d image colle a l image
 * de base (importee ou generee) sans que l utilisateur ait a le rediger. Un seul appel
 * Claude (vision), environ 1 centime. Ne decrit QUE le rendu, jamais l identite.
 */

import Anthropic from '@anthropic-ai/sdk';

const DEFAULT_MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 300;
const MAX_SIDE_PX = 768;
export const MAX_STYLE_CHARS = 400;

function getAnthropicModel() {
  return String(process.env.ANTHROPIC_MODEL || DEFAULT_MODEL).trim() || DEFAULT_MODEL;
}

/** Pur : consigne donnee a Claude. */
export function buildStyleDescriptionPrompt() {
  return [
    'Tu decris le STYLE GRAPHIQUE d\'une image de personnage, pour qu\'un modele d\'image puisse redessiner le MEME personnage dans le MEME style avec d\'autres expressions.',
    'Decris uniquement le rendu, pas qui est le personnage : la technique (rendu 3D de film d\'animation, dessin plat, chibi, aquarelle, pixel art...), la forme de la tete et des yeux, le niveau de detail de la peau et des cheveux, la lumiere et l\'ombrage, les contours (presents ou non), la palette.',
    'Ecris en francais simple, sans jargon inutile, en UNE phrase ou deux separees par des virgules, 40 mots maximum, a l\'imperatif implicite (une liste de caracteristiques, pas de phrase complete). Exemple : "rendu 3D de film d\'animation, grands yeux expressifs, peau lisse avec ombrage doux, cheveux detailles, eclairage studio chaud, sans contour".',
    'N\'ecris ni la couleur de peau ni les traits personnels (visage, coiffure, vetements) : seulement la maniere dont l\'image est dessinee.',
    'Reponds uniquement avec la description, sans guillemets, sans titre, sans commentaire.',
  ].join('\n');
}

/** Pur : nettoie la reponse de Claude ; chaine vide si inexploitable. */
export function cleanStyleDescription(rawText) {
  const text = String(rawText || '')
    .replace(/^```[a-z]*\s*/i, '')
    .replace(/\s*```$/, '')
    .replace(/^["'«\s]+|["'»\s]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length < 8) return '';
  if (text.length <= MAX_STYLE_CHARS) return text;
  // Coupe a la derniere virgule avant la limite plutot qu au milieu d un mot.
  const cut = text.slice(0, MAX_STYLE_CHARS);
  const comma = cut.lastIndexOf(',');
  return (comma > 60 ? cut.slice(0, comma) : cut.replace(/\s+\S*$/, '')).trim();
}

async function shrinkForVision(buffer) {
  const sharp = (await import('sharp')).default;
  return sharp(buffer)
    .rotate()
    .resize({ width: MAX_SIDE_PX, height: MAX_SIDE_PX, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toBuffer();
}

/** `imageBuffer` : l image de base. Renvoie la description du style (chaine non vide) ou leve une erreur. */
export async function describeAvatarStyle({ imageBuffer, apiKey, createMessage } = {}) {
  if (!imageBuffer?.length) throw new Error('Image requise');
  const key = String(apiKey || process.env.ANTHROPIC_API_KEY || '').trim();
  if (!createMessage && !key) throw new Error('ANTHROPIC_API_KEY non configuree');

  const small = await shrinkForVision(imageBuffer);
  const request = {
    model: getAnthropicModel(),
    max_tokens: MAX_TOKENS,
    system: buildStyleDescriptionPrompt(),
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: small.toString('base64') } },
        { type: 'text', text: 'Decris le style graphique de cette image.' },
      ],
    }],
  };

  const send = createMessage || ((params) => new Anthropic({ apiKey: key }).messages.create(params));
  const response = await send(request);
  const text = (response?.content || [])
    .filter((block) => block?.type === 'text')
    .map((block) => block.text)
    .join(' ');

  const description = cleanStyleDescription(text);
  if (!description) throw new Error('Claude n a pas renvoye de description exploitable');
  return description;
}
