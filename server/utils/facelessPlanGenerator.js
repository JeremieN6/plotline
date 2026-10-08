/**
 * Video faceless : Claude ecrit le script ET le plan de montage (JSON), a
 * partir d une idee et, si choisi, du profil d une persona (ton, public).
 * Le plan est ensuite nettoye par `sanitizeFacelessPlan` (liste blanche des
 * mises en page, expressions, bruitages) : le moteur de rendu ne recoit jamais
 * une valeur qu il ne sait pas dessiner.
 */

import Anthropic from '@anthropic-ai/sdk';

import { AVATAR_EXPRESSIONS } from './facelessAvatar.js';
import { countSpokenTokens } from './facelessTimeline.js';
import { FACELESS_LAYOUTS, FACELESS_POSES, FACELESS_SFX } from '../data/facelessCatalog.js';

const DEFAULT_MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 4096;

export const FACELESS_DURATIONS = [20, 30, 45, 60];
// Debit observe d une voix ElevenLabs en francais : ~2,6 mots/s.
const WORDS_PER_SECOND = 2.6;
const MAX_SCENES = 14;
// Plafond de caracteres dits par video (quota ElevenLabs, ~1 min 30 de voix).
export const MAX_SPOKEN_CHARS = 1400;

export function normalizeFacelessDuration(value) {
  const n = Number.parseInt(String(value ?? ''), 10);
  return FACELESS_DURATIONS.includes(n) ? n : 30;
}

function clip(value, max) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

// Les sauts de ligne voulus dans les cartes sont gardes.
function clipMultiline(value, max) {
  return String(value ?? '').replace(/[ \t]+/g, ' ').replace(/\n{2,}/g, '\n').trim().slice(0, max);
}

// Emoji retires des textes a l ecran : l emoji a sa propre place (autocollant),
// le doubler dans la carte la surcharge.
function withoutEmoji(value) {
  return String(value ?? '').replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, '').replace(/[ \t]{2,}/g, ' ').trim();
}

// Seules ces mises en page laissent la place aux sous-titres.
const CAPTION_LAYOUTS = new Set(['avatar', 'word']);

/** Pur : description de la persona injectee dans le prompt (vide si aucune). */
export function describeFacelessPersona(persona) {
  if (!persona) return '';
  return [
    persona.name ? `Nom : ${persona.name}` : '',
    persona.gender ? `Genre : ${persona.gender === 'MALE' ? 'homme' : 'femme'}` : '',
    persona.niche ? `Niche : ${persona.niche}` : '',
    persona.style ? `Style / ton : ${persona.style}` : '',
    persona.targetAudience ? `Public : ${persona.targetAudience}` : '',
    persona.description ? `Presentation : ${persona.description}` : '',
  ].filter(Boolean).join('\n');
}

export function buildFacelessPlanSystemPrompt({ targetSeconds = 30, persona = null, captions = true } = {}) {
  const words = Math.round(targetSeconds * WORDS_PER_SECOND);
  const personaText = describeFacelessPersona(persona);
  const expressions = Object.keys(AVATAR_EXPRESSIONS).filter((e) => e !== 'blink');

  return [
    'Tu es scenariste et monteur de videos verticales "faceless" (TikTok, Reels) pour Plotline.',
    'La video : une voix off raconte, un petit avatar dessine (style chibi) reagit avec des expressions,',
    'et des cartes de papier (style papercraft pastel) affichent les mots cles. Aucun visage filme.',
    '',
    'SCRIPT',
    `- En francais, environ ${words} mots au total (video d environ ${targetSeconds} s).`,
    '- Ton oral, naturel, comme une vraie personne qui parle a sa communaute : phrases courtes, tutoiement.',
    '- La premiere scene est une ACCROCHE forte (promesse, question, contraste) ; la derniere un appel a l action (s abonner, commenter, suivre la suite).',
    '- Une scene = une ou deux phrases dites ("say"). Ecris les nombres et sigles comme on les prononce.',
    '- Jamais de chiffres de revenus inventes, de promesse de gain garantie, de fausses statistiques.',
    '- Ne cite aucune marque deposee ni logo.',
    personaText ? `\nPERSONA QUI PARLE (respecte son ton et son public) :\n${personaText}` : '\nPas de persona : narratrice neutre, chaleureuse.',
    '',
    'MONTAGE (par scene)',
    '- "layout" parmi :',
    ...Object.entries(FACELESS_LAYOUTS).map(([key, desc]) => `  - ${key} : ${desc}`),
    '- Varie les mises en page, jamais deux fois la meme d affilee sauf "title" pour des chapitres numerotes.',
    '- Le texte a l ecran RESUME, il ne recopie pas la phrase : 2 a 8 mots par carte. Entoure 1 mot cle de **double asterisques** pour le surligner.',
    '- "emoji" : UN seul emoji pertinent, ou rien. Jamais d emoji dans text, title, word ou items.text (il a deja sa place).',
    `- "avatar" : { "mode": "head"|"body", "pose": ${FACELESS_POSES.map((p) => `"${p}"`).join('|')}, "beats": [{ "at": 0, "expr": "...", "flip": false }, ...] }`,
    `  expressions possibles : ${expressions.join(', ')}. 1 a 2 beats par scene ; le 1er a "at": 0 ; un beat suivant change d expression SUR UN MOT ("at": "mot exact de say").`,
    '  L expression suit l emotion de la phrase. "flip": true retourne l avatar (varie de temps en temps).',
    '- "items" (layout list) : "at" = un mot EXACT du "say" de la scene, dans l ordre ou il est dit.',
    `- "sfx" : 0 a 2 bruitages par scene, [{ "name": ..., "at": 0 ou "mot exact" }]. Pas de musique de fond. Noms autorises :`,
    ...Object.entries(FACELESS_SFX).map(([name, desc]) => `  - ${name} : ${desc}`),
    captions
      ? '- "captions": true seulement sur les scenes "avatar" et "word" (les autres affichent deja du texte), false ailleurs.'
      : '- "captions": false partout (pas de sous-titres).',
    '',
    'Reponds uniquement avec un objet JSON brut, sans markdown ni commentaire. Forme exacte :',
    '{"title": string, "caption": string (legende du post, 1 a 3 phrases), "hashtags": [string], "scenes": [{"say": string, "layout": string, "text"?: string, "title"?: string, "number"?: string, "word"?: string, "emoji"?: string, "items"?: [{"emoji": string, "text": string, "at": string}], "avatar": {...}, "sfx": [...], "captions": boolean}]}',
  ].join('\n');
}

export function buildFacelessPlanUserPrompt(idea) {
  return `Idee de la video :\n${String(idea || '').trim()}`;
}

function sanitizeCue(at) {
  if (typeof at === 'number' && Number.isFinite(at)) return Math.max(0, Math.min(at, 30));
  const text = clip(at, 40);
  return text || 0;
}

function sanitizeAvatar(avatar, layout) {
  const beats = (Array.isArray(avatar?.beats) ? avatar.beats : [])
    .slice(0, 3)
    .map((beat, i) => ({
      at: i === 0 ? 0 : sanitizeCue(beat?.at),
      expr: AVATAR_EXPRESSIONS[beat?.expr] && beat.expr !== 'blink' ? beat.expr : 'neutral',
      flip: beat?.flip === true,
    }));
  return {
    mode: avatar?.mode === 'body' || (avatar?.mode !== 'head' && layout === 'avatar') ? 'body' : 'head',
    pose: FACELESS_POSES.includes(avatar?.pose) ? avatar.pose : 'idle',
    beats: beats.length ? beats : [{ at: 0, expr: 'neutral', flip: false }],
  };
}

/** Pur : nettoie une scene ; renvoie null si elle n a rien a dire. */
export function sanitizeFacelessScene(raw, { captions = true } = {}) {
  const say = clip(raw?.say, 320);
  if (!say) return null;

  let layout = FACELESS_LAYOUTS[raw?.layout] ? raw.layout : 'avatar';
  const scene = {
    say,
    layout,
    text: clipMultiline(withoutEmoji(raw?.text), 110),
    title: clip(withoutEmoji(raw?.title), 40),
    number: clip(raw?.number, 3),
    word: clip(withoutEmoji(raw?.word), 14),
    emoji: clip(raw?.emoji, 8),
    items: (Array.isArray(raw?.items) ? raw.items : []).slice(0, 4)
      .map((item) => ({ emoji: clip(item?.emoji, 8), text: clip(withoutEmoji(item?.text), 40), at: sanitizeCue(item?.at) }))
      .filter((item) => item.text),
    sfx: (Array.isArray(raw?.sfx) ? raw.sfx : []).slice(0, 2)
      .filter((s) => Object.hasOwn(FACELESS_SFX, s?.name))
      .map((s) => ({ name: s.name, at: sanitizeCue(s?.at) })),
    captions: captions && raw?.captions === true,
  };

  // Une mise en page sans son contenu obligatoire retombe sur "avatar".
  const incomplete = (layout === 'hook' && !scene.text)
    || (layout === 'title' && !scene.title)
    || (layout === 'list' && scene.items.length < 2)
    || (layout === 'word' && !scene.word);
  if (incomplete) {
    layout = 'avatar';
    scene.layout = layout;
    scene.text = scene.text || scene.title || scene.word;
  }

  scene.avatar = sanitizeAvatar(raw?.avatar, layout);
  scene.captions = scene.captions && CAPTION_LAYOUTS.has(layout);
  return scene;
}

/** Pur : plan complet nettoye. Leve une erreur si moins de 2 scenes exploitables. */
export function sanitizeFacelessPlan(raw, { captions = true } = {}) {
  const scenes = [];
  let spokenChars = 0;

  for (const candidate of (Array.isArray(raw?.scenes) ? raw.scenes : []).slice(0, MAX_SCENES)) {
    const scene = sanitizeFacelessScene(candidate, { captions });
    if (!scene) continue;
    if (spokenChars + scene.say.length > MAX_SPOKEN_CHARS) break;
    // Une scene sans aucun mot (ponctuation seule) casserait la repartition des mots.
    if (!countSpokenTokens(scene.say)) continue;
    spokenChars += scene.say.length + 1;
    scenes.push(scene);
  }

  if (scenes.length < 2) throw new Error('Plan de montage inexploitable (moins de 2 scenes)');

  return {
    title: clip(raw?.title, 80),
    caption: clipMultiline(raw?.caption, 600),
    hashtags: (Array.isArray(raw?.hashtags) ? raw.hashtags : []).slice(0, 8)
      .map((tag) => clip(tag, 40).replace(/^#?/, '#').replace(/\s+/g, ''))
      .filter((tag) => tag.length > 1),
    theme: 'papercraft-pastel',
    scenes,
  };
}

/** Pur : extrait l objet JSON de la reponse de Claude. */
export function parseFacelessPlanResponse(rawText) {
  const text = String(rawText || '').trim()
    .replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('Reponse de Claude sans JSON');
  return JSON.parse(text.slice(start, end + 1));
}

async function askClaudeForPlan({ system, userContent, captions, apiKey, createMessage }) {
  const key = String(apiKey || process.env.ANTHROPIC_API_KEY || '').trim();
  if (!createMessage && !key) throw new Error('ANTHROPIC_API_KEY non configuree');

  const request = {
    model: String(process.env.ANTHROPIC_MODEL || DEFAULT_MODEL).trim() || DEFAULT_MODEL,
    max_tokens: MAX_TOKENS,
    system,
    messages: [{ role: 'user', content: userContent }],
  };
  const response = await (createMessage ? createMessage(request) : new Anthropic({ apiKey: key }).messages.create(request));
  const text = (response?.content || []).filter((b) => b?.type === 'text').map((b) => b.text).join('\n');

  return sanitizeFacelessPlan(parseFacelessPlanResponse(text), { captions });
}

/** Appel Claude. `createMessage` est injectable (tests). */
export async function generateFacelessPlan({ idea, persona, targetSeconds, captions = true, apiKey, createMessage } = {}) {
  return askClaudeForPlan({
    system: buildFacelessPlanSystemPrompt({ targetSeconds: normalizeFacelessDuration(targetSeconds), persona, captions }),
    userContent: buildFacelessPlanUserPrompt(idea),
    captions,
    apiKey,
    createMessage,
  });
}

// --- Retouches --------------------------------------------------------------

/** Pur : le plan tel qu on le montre a Claude (sans champs internes vides). */
export function planForEditing(plan) {
  const compact = (value) => (Array.isArray(value) ? value.length > 0 : value !== '' && value != null && value !== false);
  return {
    title: plan?.title || '',
    caption: plan?.caption || '',
    hashtags: plan?.hashtags || [],
    scenes: (plan?.scenes || []).map((scene) => Object.fromEntries(
      ['say', 'layout', 'text', 'title', 'number', 'word', 'emoji', 'items', 'avatar', 'sfx', 'captions']
        .filter((key) => key === 'say' || key === 'layout' || key === 'avatar' || compact(scene[key]))
        .map((key) => [key, scene[key]]),
    )),
  };
}

/**
 * Pur : le texte dit a-t-il change (sinon la voix existante est reutilisee) ?
 * On compare le script COMPLET, tel qu il est lu par la voix : couper une scene
 * en deux sans changer un mot garde la meme voix (les mots se repartissent
 * entre scenes par leur nombre).
 */
export function spokenTextChanged(previousPlan, nextPlan) {
  const spoken = (plan) => (plan?.scenes || []).map((scene) => String(scene.say || '')).join(' ').replace(/\s+/g, ' ').trim();
  return spoken(previousPlan) !== spoken(nextPlan);
}

export function buildFacelessRetouchSystemPrompt({ targetSeconds = 30, persona = null, captions = true } = {}) {
  return [
    buildFacelessPlanSystemPrompt({ targetSeconds, persona, captions }),
    '',
    'RETOUCHE',
    'Tu ne crees pas une nouvelle video : tu RETOUCHES un plan existant selon la consigne de l utilisateur.',
    '- Applique la consigne precisement, et ne change RIEN d autre (meme ordre de scenes, memes textes, memes expressions, memes bruitages ailleurs).',
    '- Ne modifie le texte dit ("say") QUE si la consigne porte sur ce qui est dit (script, ton, duree, une phrase precise). Sinon recopie chaque "say" a l identique, caractere pour caractere : la voix deja enregistree sera reutilisee.',
    '- Si tu modifies un "say", verifie que les reperes "at" de cette scene citent toujours des mots exacts de la nouvelle phrase.',
    '- "Plus long a l ecran", "trop rapide" sur un element : ajuste son repere "at" (plus tot) ou separe la scene en deux scenes.',
    '- Renvoie le plan COMPLET, dans la meme forme JSON que d habitude.',
  ].join('\n');
}

export function buildFacelessRetouchUserPrompt(plan, instruction) {
  return [
    'Plan actuel :',
    JSON.stringify(planForEditing(plan)),
    '',
    'Consigne de retouche :',
    String(instruction || '').trim(),
  ].join('\n');
}

/** Retouche d un plan par Claude. `createMessage` est injectable (tests). */
export async function retouchFacelessPlan({ plan, instruction, persona, targetSeconds, captions = true, apiKey, createMessage } = {}) {
  if (!String(instruction || '').trim()) throw new Error('Consigne de retouche vide');
  return askClaudeForPlan({
    system: buildFacelessRetouchSystemPrompt({ targetSeconds: normalizeFacelessDuration(targetSeconds), persona, captions }),
    userContent: buildFacelessRetouchUserPrompt(plan, instruction),
    captions,
    apiKey,
    createMessage,
  });
}
