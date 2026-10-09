/**
 * Video faceless : Claude ecrit le script ET le plan de montage (JSON), a
 * partir d une idee et, si choisi, du profil d une persona (ton, public).
 * Le plan est ensuite nettoye par `sanitizeFacelessPlan` (liste blanche des
 * mises en page, expressions, bruitages) : le moteur de rendu ne recoit jamais
 * une valeur qu il ne sait pas dessiner.
 */

import Anthropic from '@anthropic-ai/sdk';

import { AVATAR_EXPRESSIONS } from './facelessAvatar.js';
import { describeStyleForPrompt, normalizeFacelessStyle } from './facelessStyle.js';
import { findCatalogEntry } from '../data/facelessAvatarCatalog.js';
import { ILLUSTRATION_KINDS, MAX_ILLUSTRATION_PROMPT, MAX_NEW_PER_VIDEO } from '../data/facelessIllustrations.js';
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

/** Pur : bloc de consignes sur l avatar, selon qu il s agit d images du pack ou du dessin. */
function avatarPromptLines(packEntries) {
  const ids = Object.keys(packEntries || {});
  if (ids.length) {
    const lines = ids.map((id) => {
      const entry = findCatalogEntry(id);
      return '  - ' + id + ' : ' + (entry?.label || id) + ' (' + (packEntries[id].mode === 'body' ? 'buste' : 'tête seule') + ')';
    });
    return [
      '- "avatar" : { "beats": [{ "at": 0, "expr": "<id>", "flip": false }, ...] } avec UNIQUEMENT ces images d avatar (un id = une image) :',
      ...lines,
      '  Choisis l image qui correspond à ce qui est dit (tête seule pour une simple réaction, buste quand le geste compte). 1 à 3 beats par scène ; le 1er à "at": 0 ; un beat suivant change d image SUR UN MOT ("at": "mot exact de say"). "flip": true retourne l avatar (varie de temps en temps).',
    ];
  }
  const expressions = Object.keys(AVATAR_EXPRESSIONS).filter((e) => e !== 'blink');
  return [
    '- "avatar" : { "mode": "head"|"body", "pose": ' + FACELESS_POSES.map((p) => '"' + p + '"').join('|') + ', "beats": [{ "at": 0, "expr": "...", "flip": false }, ...] }',
    '  expressions possibles : ' + expressions.join(', ') + '. 1 a 2 beats par scene ; le 1er a "at": 0 ; un beat suivant change d expression SUR UN MOT ("at": "mot exact de say").',
    '  L expression suit l emotion de la phrase. "flip": true retourne l avatar (varie de temps en temps).',
  ];
}

/** Pur : bloc de consignes sur les illustrations du dossier de la persona. */
function illustrationPromptLines(illustrations, maxNew) {
  const ids = Object.keys(illustrations || {});
  const lines = ['', 'ILLUSTRATIONS DISPONIBLES (dossier de la persona)'];
  if (ids.length) {
    for (const id of ids) lines.push('- ' + id + ' : ' + (illustrations[id].label || id) + ' (' + (ILLUSTRATION_KINDS[illustrations[id].kind] || illustrations[id].kind) + ')');
  } else {
    lines.push('- aucune');
  }
  lines.push('Mise en page "photo" : une image dans un cadre, pour illustrer concretement ce qui est dit (un lieu, un objet, une situation), jamais pour decorer. Au plus une scene "photo" sur trois.');
  if (maxNew > 0) {
    lines.push('Tu peux demander AU PLUS ' + maxNew + ' nouvelle(s) image(s) : a la place de "image", mets "newImage": { "kind": "photo" | "illustration" | "mockup", "prompt": "<description EN ANGLAIS, une phrase concrete, sans visage ni texte>" }. Chaque image coute de l argent : ne la demande que si elle apporte vraiment quelque chose, et prefere reutiliser celles de la liste.');
  } else {
    lines.push('Tu n as PAS le droit de demander de nouvelle image : n utilise que les images de la liste, et si aucune ne convient, n utilise pas la mise en page "photo".');
  }
  return lines;
}

export function buildFacelessPlanSystemPrompt({ targetSeconds = 30, persona = null, captions = true, style = null, packEntries = null, illustrations = null, maxNew = 0 } = {}) {
  const words = Math.round(targetSeconds * WORDS_PER_SECOND);
  const personaText = describeFacelessPersona(persona);
  const da = style || normalizeFacelessStyle({});

  return [
    'Tu es scenariste et monteur de videos verticales "faceless" (TikTok, Reels) pour Plotline.',
    'La video : une voix off raconte, un avatar illustre reagit avec des expressions,',
    'et des cartes affichent les mots cles dans la direction artistique ci-dessous. Aucun visage filme.',
    '',
    'DIRECTION ARTISTIQUE (a respecter)',
    describeStyleForPrompt(da),
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
    ...avatarPromptLines(packEntries),
    '- "image" (layout photo) : l id EXACT d une illustration disponible ; "frame" facultatif : "polaroid" ou "plain".',
    '- "bg" : le fond de la scene, "main" (fond principal), "alt" (fond secondaire) ou "dark" (fond sombre). Varie les fonds toutes les 2 ou 3 scenes (jamais plus de 2 scenes "dark" d affilee).',
    '- "items" (layout list) : "at" = un mot EXACT du "say" de la scene, dans l ordre ou il est dit.',
    `- "sfx" : 0 a 2 bruitages par scene, [{ "name": ..., "at": 0 ou "mot exact" }]. Pas de musique de fond. Noms autorises :`,
    ...Object.entries(FACELESS_SFX).map(([name, desc]) => `  - ${name} : ${desc}`),
    captions
      ? '- "captions": true seulement sur les scenes "avatar" et "word" (les autres affichent deja du texte), false ailleurs.'
      : '- "captions": false partout (pas de sous-titres).',
    ...illustrationPromptLines(illustrations, maxNew),
    '',
    'Reponds uniquement avec un objet JSON brut, sans markdown ni commentaire. Forme exacte :',
    '{"title": string, "caption": string (legende du post, 1 a 3 phrases), "hashtags": [string], "scenes": [{"say": string, "layout": string, "text"?: string, "title"?: string, "number"?: string, "word"?: string, "image"?: string, "newImage"?: {"kind": string, "prompt": string}, "frame"?: string, "emoji"?: string, "items"?: [{"emoji": string, "text": string, "at": string}], "bg": string, "avatar": {...}, "sfx": [...], "captions": boolean}]}',
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

function sanitizeAvatar(avatar, layout, packIds = []) {
  // Images du pack : seuls les id disponibles sont acceptes (repli : la premiere tete).
  if (packIds.length) {
    const fallback = packIds.find((id) => findCatalogEntry(id)?.mode === 'head') || packIds[0];
    const packBeats = (Array.isArray(avatar?.beats) ? avatar.beats : []).slice(0, 3).map((beat, i) => ({
      at: i === 0 ? 0 : sanitizeCue(beat?.at),
      expr: packIds.includes(beat?.expr) ? beat.expr : fallback,
      flip: beat?.flip === true,
    }));
    return { beats: packBeats.length ? packBeats : [{ at: 0, expr: fallback, flip: false }] };
  }

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
export function sanitizeFacelessScene(raw, { captions = true, packIds = [], illustrationIds = [], newBudget = { left: 0 } } = {}) {
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

  // Mise en page photo : une illustration du dossier, ou (si autorise, dans la limite du budget) une nouvelle image a generer.
  if (layout === 'photo') {
    scene.image = illustrationIds.includes(raw?.image) ? raw.image : '';
    scene.newImage = null;
    if (!scene.image && newBudget.left > 0 && raw?.newImage && typeof raw.newImage === 'object') {
      const prompt = clip(raw.newImage.prompt, MAX_ILLUSTRATION_PROMPT);
      if (prompt.length >= 8) {
        scene.newImage = { kind: Object.hasOwn(ILLUSTRATION_KINDS, raw.newImage.kind) ? raw.newImage.kind : 'photo', prompt };
        newBudget.left -= 1;
      }
    }
    scene.frame = ['polaroid', 'plain'].includes(raw?.frame) ? raw.frame : '';
  }

  // Une mise en page sans son contenu obligatoire retombe sur "avatar".
  const incomplete = (layout === 'hook' && !scene.text)
    || (layout === 'photo' && !scene.image && !scene.newImage)
    || (layout === 'title' && !scene.title)
    || (layout === 'list' && scene.items.length < 2)
    || ((layout === 'word' || layout === 'logo') && !scene.word);
  if (incomplete) {
    layout = 'avatar';
    scene.layout = layout;
    scene.text = scene.text || scene.title || scene.word;
    delete scene.image;
    delete scene.newImage;
    delete scene.frame;
  }

  scene.avatar = sanitizeAvatar(raw?.avatar, layout, packIds);
  scene.bg = ['main', 'alt', 'dark'].includes(raw?.bg) ? raw.bg : 'main';
  scene.captions = scene.captions && CAPTION_LAYOUTS.has(layout);
  return scene;
}

/** Pur : plan complet nettoye. Leve une erreur si moins de 2 scenes exploitables. */
export function sanitizeFacelessPlan(raw, { captions = true, packIds = [], illustrationIds = [], maxNew = 0, maxScenes = MAX_SCENES, maxChars = MAX_SPOKEN_CHARS } = {}) {
  const scenes = [];
  const newBudget = { left: Math.max(0, Math.min(Number(maxNew) || 0, MAX_NEW_PER_VIDEO)) };
  let spokenChars = 0;

  for (const candidate of (Array.isArray(raw?.scenes) ? raw.scenes : []).slice(0, maxScenes)) {
    const scene = sanitizeFacelessScene(candidate, { captions, packIds, illustrationIds, newBudget });
    if (!scene) continue;
    if (spokenChars + scene.say.length > maxChars) break;
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

/** Pur : les nouvelles images demandees par un plan : [{ sceneIndex, kind, prompt }]. */
export function collectNewImageRequests(plan) {
  return (plan?.scenes || [])
    .map((scene, sceneIndex) => (scene?.newImage ? { sceneIndex, kind: scene.newImage.kind, prompt: scene.newImage.prompt } : null))
    .filter(Boolean);
}

/**
 * Pur : range les images generees dans le plan. `results[sceneIndex]` = id de la
 * nouvelle illustration, ou rien si la generation a echoue : la scene retombe
 * alors sur une scene "avatar" avec son texte (la video se fait quand meme).
 */
export function applyNewImages(plan, results) {
  return {
    ...plan,
    scenes: plan.scenes.map((scene, index) => {
      if (!scene.newImage) return scene;
      const { newImage, ...rest } = scene;
      const id = results?.[index];
      if (id) return { ...rest, image: id };
      const { image, frame, ...fallback } = rest;
      return { ...fallback, layout: 'avatar', text: fallback.text || fallback.title || '' };
    }),
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

async function askClaudeForPlan({ system, userContent, captions, packIds, illustrationIds, maxNew, apiKey, createMessage }) {
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

  return sanitizeFacelessPlan(parseFacelessPlanResponse(text), { captions, packIds, illustrationIds, maxNew });
}

/** Appel Claude. `createMessage` est injectable (tests). */
export async function generateFacelessPlan({ idea, persona, targetSeconds, captions = true, style = null, packEntries = null, illustrations = null, maxNew = 0, apiKey, createMessage } = {}) {
  return askClaudeForPlan({
    system: buildFacelessPlanSystemPrompt({ targetSeconds: normalizeFacelessDuration(targetSeconds), persona, captions, style, packEntries, illustrations, maxNew }),
    userContent: buildFacelessPlanUserPrompt(idea),
    captions,
    packIds: Object.keys(packEntries || {}),
    illustrationIds: Object.keys(illustrations || {}),
    maxNew,
    apiKey,
    createMessage,
  });
}

// --- Retouches --------------------------------------------------------------

/** Pur : le plan tel qu on le montre a Claude (sans champs internes vides). */
export function planForEditing(plan) {
  // Le fond principal est la valeur par defaut : inutile de l afficher a Claude.
  const compact = (value) => (Array.isArray(value) ? value.length > 0 : value !== '' && value != null && value !== false && value !== 'main');
  return {
    title: plan?.title || '',
    caption: plan?.caption || '',
    hashtags: plan?.hashtags || [],
    scenes: (plan?.scenes || []).map((scene) => Object.fromEntries(
      ['say', 'layout', 'text', 'title', 'number', 'word', 'emoji', 'items', 'image', 'frame', 'bg', 'avatar', 'sfx', 'captions']
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

export function buildFacelessRetouchSystemPrompt({ targetSeconds = 30, persona = null, captions = true, style = null, packEntries = null, illustrations = null } = {}) {
  return [
    buildFacelessPlanSystemPrompt({ targetSeconds, persona, captions, style, packEntries, illustrations, maxNew: 0 }),
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
export async function retouchFacelessPlan({ plan, instruction, persona, targetSeconds, captions = true, style = null, packEntries = null, illustrations = null, apiKey, createMessage } = {}) {
  if (!String(instruction || '').trim()) throw new Error('Consigne de retouche vide');
  return askClaudeForPlan({
    system: buildFacelessRetouchSystemPrompt({ targetSeconds: normalizeFacelessDuration(targetSeconds), persona, captions, style, packEntries, illustrations }),
    userContent: buildFacelessRetouchUserPrompt(plan, instruction),
    captions,
    packIds: Object.keys(packEntries || {}),
    illustrationIds: Object.keys(illustrations || {}),
    maxNew: 0,
    apiKey,
    createMessage,
  });
}
