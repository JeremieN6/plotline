import {
  DEFAULT_PRESET,
  FACELESS_ACCESSORIES,
  FACELESS_BACKGROUNDS,
  FACELESS_CAPTION_STYLES,
  FACELESS_CARD_STYLES,
  FACELESS_DENSITIES,
  FACELESS_ENTERS,
  FACELESS_FONTS,
  FACELESS_HAIR_STYLES,
  FACELESS_MOTIONS,
  FACELESS_PALETTE_KEYS,
  FACELESS_PRESETS,
} from '../data/facelessThemes.js';
import { DEFAULT_FACELESS_VOICE_ID, findFacelessVoice } from '../data/facelessCatalog.js';
import { ILLUSTRATION_KINDS, ILLUSTRATION_SOURCES, MAX_ILLUSTRATIONS, MAX_ILLUSTRATION_PROMPT } from '../data/facelessIllustrations.js';

/**
 * Direction artistique d une persona : normalisation et valeurs par defaut.
 * Tout ce qui vient du client ou de Claude passe par `normalizeFacelessStyle` :
 * listes blanches, couleurs hexadecimales verifiees, textes bornes.
 * Le pack d avatars et les illustrations (images generees, URL) ne sont JAMAIS
 * acceptes du client : ils sont ecrits par le serveur seulement (voir `mergeClientStyle`).
 */

export const STYLE_VERSION = 1;
const MAX_RULES = 1500;
const MAX_AVATAR_PROMPT = 400;

const HEX = /^#[0-9a-f]{6}$/i;
const pick = (value, allowed, fallback) => (Object.hasOwn(allowed, value) ? value : fallback);
const text = (value, max) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

/**
 * Pur : regles de montage en texte, une par ligne. Claude renvoie parfois une
 * LISTE : on la met en lignes "- ..." au lieu de la coller avec des virgules.
 */
export function rulesText(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? '').trim()).filter(Boolean).map((item) => (item.startsWith('-') ? item : `- ${item}`)).join('\n');
  }
  // Une liste "- a,- b" collee sur une seule ligne : on la redecoupe.
  return String(value ?? '').replace(/,\s*(?=- )/g, '\n');
}

export function isHexColor(value) {
  return HEX.test(String(value || ''));
}

/** Pur : coloris hexadecimal valide, sinon le repli. */
export function safeHexColor(value, fallback) {
  const v = String(value || '').trim();
  return HEX.test(v) ? v.toLowerCase() : fallback;
}

/** Pur : parametres de l avatar dessine par defaut selon le genre de la persona. */
export function defaultSvgAvatar(gender) {
  return gender === 'MALE'
    ? { hair: 'short', hairColor: '#2b2a33', skin: '#e9bf9b', accessory: 'none', top: '#3a4a73' }
    : { hair: 'long', hairColor: '#5b3a2e', skin: '#ffe2cf', accessory: 'bow', top: '#c9b6ff' };
}

/** Pur : voix par defaut selon le genre (les deux premieres du catalogue pour chaque genre). */
export function defaultVoiceFor(gender) {
  return gender === 'MALE' ? 'bIHbv24MWmeRgasZH58o' : DEFAULT_FACELESS_VOICE_ID;
}

/** Pur : DA de depart pour un preset, adaptee au genre. */
export function defaultFacelessStyle(preset = DEFAULT_PRESET, gender = 'FEMALE') {
  const base = FACELESS_PRESETS[preset] || FACELESS_PRESETS[DEFAULT_PRESET];
  return normalizeFacelessStyle({
    ...base.style,
    avatar: { kind: 'svg', svg: defaultSvgAvatar(gender) },
    voiceId: defaultVoiceFor(gender),
  });
}

function normalizePack(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const entries = {};
  for (const [id, value] of Object.entries(raw.entries || {})) {
    if (!/^[a-z0-9-]{2,40}$/.test(id) || !value || typeof value !== 'object') continue;
    const status = ['done', 'failed', 'pending'].includes(value.status) ? value.status : 'pending';
    entries[id] = {
      status,
      mode: value.mode === 'body' ? 'body' : 'head',
      // L adresse d une image precedente est gardee pendant une regeneration ou apres un echec.
      url: String(value.url || ''),
      error: status === 'failed' ? text(value.error, 200) : '',
    };
  }
  return {
    baseUrl: String(raw.baseUrl || ''),
    baseSource: raw.baseSource === 'upload' ? 'upload' : 'generated',
    generating: raw.generating === true,
    startedAt: Number.isFinite(Number(raw.startedAt)) ? Number(raw.startedAt) : 0,
    entries,
  };
}

/** Pur : id d une illustration (ecrit par le serveur). */
export const ILLUSTRATION_ID = /^ill-[a-z0-9]{6,12}$/;

function normalizeIllustrations(raw) {
  const seen = new Set();
  const list = [];
  for (const item of Array.isArray(raw) ? raw : []) {
    const id = String(item?.id || '');
    const url = String(item?.url || '');
    if (!ILLUSTRATION_ID.test(id) || !url || seen.has(id)) continue;
    seen.add(id);
    list.push({
      id,
      kind: Object.hasOwn(ILLUSTRATION_KINDS, item?.kind) ? item.kind : 'photo',
      label: text(item?.label, 80) || 'Illustration',
      prompt: text(item?.prompt, MAX_ILLUSTRATION_PROMPT),
      url,
      source: ILLUSTRATION_SOURCES.includes(item?.source) ? item.source : 'generated',
      createdAt: Number.isFinite(Number(item?.createdAt)) ? Number(item.createdAt) : 0,
    });
    if (list.length >= MAX_ILLUSTRATIONS) break;
  }
  return list;
}

/**
 * Pur : DA complete et sure. `keepPack` n est vrai que pour une lecture en base
 * (ecrite par le serveur), jamais pour une entree venant du client.
 */
export function normalizeFacelessStyle(raw, { keepPack = false } = {}) {
  const input = raw && typeof raw === 'object' ? raw : {};
  const preset = pick(input.preset, FACELESS_PRESETS, DEFAULT_PRESET);
  const base = FACELESS_PRESETS[preset].style;
  const pal = input.palette && typeof input.palette === 'object' ? input.palette : {};

  const palette = {};
  for (const key of Object.keys(FACELESS_PALETTE_KEYS)) palette[key] = safeHexColor(pal[key], base.palette[key]);

  const enters = (Array.isArray(input.enters) ? input.enters : base.enters).filter((e) => FACELESS_ENTERS.includes(e));
  const caps = input.captions && typeof input.captions === 'object' ? input.captions : {};
  const avatarIn = input.avatar && typeof input.avatar === 'object' ? input.avatar : {};
  const svgIn = avatarIn.svg && typeof avatarIn.svg === 'object' ? avatarIn.svg : {};
  const svgBase = defaultSvgAvatar('FEMALE');

  const style = {
    version: STYLE_VERSION,
    name: text(input.name, 60) || base.name,
    preset,
    palette,
    font: pick(input.font, FACELESS_FONTS, base.font),
    card: pick(input.card, FACELESS_CARD_STYLES, base.card),
    background: pick(input.background, FACELESS_BACKGROUNDS, base.background),
    decor: input.decor === 'none' ? 'none' : (input.decor === 'shapes' ? 'shapes' : base.decor),
    motion: pick(input.motion, FACELESS_MOTIONS, base.motion),
    // Au moins une entree : sinon rien ne pourrait apparaitre.
    enters: enters.length ? [...new Set(enters)] : ['pop'],
    captions: {
      enabled: caps.enabled === undefined ? base.captions.enabled : caps.enabled === true,
      position: caps.position === 'top' ? 'top' : (caps.position === 'bottom' ? 'bottom' : base.captions.position),
      style: pick(caps.style, FACELESS_CAPTION_STYLES, base.captions.style),
    },
    density: pick(input.density, FACELESS_DENSITIES, base.density),
    rules: rulesText(input.rules ?? base.rules ?? '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, MAX_RULES),
    avatarPrompt: text(input.avatarPrompt ?? base.avatarPrompt, MAX_AVATAR_PROMPT),
    voiceId: findFacelessVoice(String(input.voiceId || '')) ? String(input.voiceId) : DEFAULT_FACELESS_VOICE_ID,
    avatar: {
      kind: avatarIn.kind === 'pack' ? 'pack' : 'svg',
      svg: {
        hair: pick(svgIn.hair, FACELESS_HAIR_STYLES, svgBase.hair),
        hairColor: safeHexColor(svgIn.hairColor, svgBase.hairColor),
        skin: safeHexColor(svgIn.skin, svgBase.skin),
        accessory: pick(svgIn.accessory, FACELESS_ACCESSORIES, svgBase.accessory),
        top: safeHexColor(svgIn.top, svgBase.top),
      },
      pack: keepPack ? normalizePack(avatarIn.pack) : null,
    },
    illustrations: keepPack ? normalizeIllustrations(input.illustrations) : [],
  };

  // Un pack choisi mais vide ne dessinerait aucun avatar : retour au dessin.
  if (style.avatar.kind === 'pack' && !(style.avatar.pack && Object.values(style.avatar.pack.entries).some((e) => e.url))) {
    style.avatar.kind = 'svg';
  }
  return style;
}

/** Pur : DA envoyee par le client + pack deja en base (jamais celui du client). */
export function mergeClientStyle(existingStyle, clientStyle) {
  const next = normalizeFacelessStyle(clientStyle);
  const pack = existingStyle?.avatar?.pack || null;
  next.avatar.pack = pack;
  next.illustrations = existingStyle?.illustrations || [];
  if (clientStyle?.avatar?.kind === 'pack' && pack && Object.values(pack.entries).some((e) => e.url)) next.avatar.kind = 'pack';
  return next;
}

/** Pur : entrees du pack effectivement utilisables : { id: { mode, url } }. */
export function readyPackEntries(style) {
  const pack = style?.avatar?.kind === 'pack' ? style.avatar.pack : null;
  const out = {};
  for (const [id, entry] of Object.entries(pack?.entries || {})) {
    if (entry.url) out[id] = { mode: entry.mode, url: entry.url };
  }
  return out;
}

/** Pur : illustrations utilisables : { id: { kind, label, url } }. */
export function readyIllustrations(style) {
  const out = {};
  for (const item of style?.illustrations || []) {
    if (item.url) out[item.id] = { kind: item.kind, label: item.label, url: item.url };
  }
  return out;
}

/** Pur : ajoute une illustration au dossier (les plus anciennes partent au-dela du plafond). */
export function addIllustration(style, entry) {
  const list = [...(style?.illustrations || []), entry];
  return { ...style, illustrations: list.slice(-MAX_ILLUSTRATIONS) };
}

/** Pur : retire une illustration du dossier. */
export function removeIllustration(style, id) {
  return { ...style, illustrations: (style?.illustrations || []).filter((item) => item.id !== id) };
}

/** Pur : ajoute une regle de montage retenue (consigne de style) a la DA, sans doublon ni depassement. */
export function appendStyleRule(style, rule) {
  const line = text(rule, 300);
  if (!line) return style;
  const current = String(style?.rules || '');
  if (current.toLowerCase().includes(line.toLowerCase())) return style;
  let next = current ? `${current}\n- ${line}` : `- ${line}`;
  // Au-dela du plafond, on retire les plus anciennes lignes.
  while (next.length > MAX_RULES && next.includes('\n')) next = next.slice(next.indexOf('\n') + 1);
  return { ...style, rules: next.slice(-MAX_RULES) };
}

/** Pur : description textuelle de la DA donnee a Claude. */
export function describeStyleForPrompt(style) {
  const lines = [
    `Direction artistique "${style.name}" : cartes ${FACELESS_CARD_STYLES[style.card]}, fond ${FACELESS_BACKGROUNDS[style.background]}, mouvement ${style.motion === 'stopmotion' ? 'stop motion' : 'fluide'}.`,
    `Densité : ${FACELESS_DENSITIES[style.density]}.`,
    `Transitions autorisées : ${style.enters.join(', ')}.`,
    style.captions.enabled ? `Sous-titres : ${FACELESS_CAPTION_STYLES[style.captions.style]}, placés en ${style.captions.position === 'top' ? 'haut' : 'bas'}.` : 'Sous-titres : aucun.',
  ];
  if (style.rules) lines.push(`Règles de montage de cette DA :\n${style.rules}`);
  return lines.join('\n');
}
