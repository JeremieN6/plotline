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
  FACELESS_TEMPLATES,
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
/** Une persona (ou marque, ou autre) a une DA principale + au plus 2 DA en option. */
export const MAX_ALTERNATES = 2;
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
export function defaultFacelessStyle(preset = DEFAULT_PRESET, gender = 'FEMALE', { avatar = 'none' } = {}) {
  const base = FACELESS_PRESETS[preset] || FACELESS_PRESETS[DEFAULT_PRESET];
  return normalizeFacelessStyle({
    ...base.style,
    // Par defaut AUCUN avatar : le dessin (gratuit) et le pack sont des choix explicites.
    avatar: { kind: avatar === 'svg' ? 'svg' : 'none', svg: defaultSvgAvatar(gender) },
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

/** Pur : forme d un identifiant de voix ElevenLabs. */
export const CLONE_VOICE_ID = /^[A-Za-z0-9]{10,40}$/;

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
    // Modele visuel : celui demande, sinon celui du preset (les DA enregistrees avant les modeles sont "classic").
    template: pick(input.template, FACELESS_TEMPLATES, base.template || 'classic'),
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
    // Rendu des images du pack : « stylized » (le style ci-dessus) ou « faithful » = la meme personne que sa fiche de reference, en photo realiste.
    avatarRender: input.avatarRender === 'faithful' ? 'faithful' : 'stylized',
    voiceId: findFacelessVoice(String(input.voiceId || '')) ? String(input.voiceId) : DEFAULT_FACELESS_VOICE_ID,
    // Voix CLONEE par defaut (id ElevenLabs), reservee au proprietaire : le format est verifie ici,
    // l appartenance au compte ElevenLabs l est a l enregistrement et a l usage.
    cloneVoiceId: CLONE_VOICE_ID.test(String(input.cloneVoiceId || '')) ? String(input.cloneVoiceId) : '',
    avatar: {
      kind: avatarIn.kind === 'pack' ? 'pack' : (avatarIn.kind === 'none' ? 'none' : 'svg'),
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
    // DA en option (lues en base seulement : on les ecrit une par une via `setAlternate`).
    alternates: keepPack ? normalizeAlternates(input.alternates) : [],
  };

  // Un pack choisi mais vide (lecture en base, ou le pack est connu) ne dessinerait aucun avatar : on ne dessine rien
  // (jamais de dessin impose). Hors lecture en base le pack est volontairement absent : le choix "pack" est GARDE,
  // les images viennent d ailleurs (apercu, plan fige d une video).
  if (keepPack && style.avatar.kind === 'pack' && !(style.avatar.pack && Object.values(style.avatar.pack.entries).some((e) => e.url))) {
    style.avatar.kind = 'none';
  }
  return style;
}

/** Pur : DA en option lues en base (sans pack ni illustrations : elles partagent ceux de la DA principale). */
export function normalizeAlternates(raw) {
  return (Array.isArray(raw) ? raw : []).slice(0, MAX_ALTERNATES).map((item) => {
    const style = normalizeFacelessStyle(item);
    // "pack" est une intention : le pack (commun aux 3 DA) est lu a l usage, voir `pickStyleSlot`.
    const kind = item?.avatar?.kind === 'pack' ? 'pack' : style.avatar.kind;
    return { ...style, avatar: { ...style.avatar, kind, pack: null }, illustrations: [], alternates: [] };
  });
}

/**
 * Pur : la DA du rang demande (0 = principale, 1 et 2 = options), avec le pack d avatars
 * et les illustrations de la persona (communs aux trois). Un rang inconnu = la principale.
 */
export function pickStyleSlot(style, slot = 0) {
  const index = Number(slot);
  const alt = Number.isInteger(index) && index >= 1 ? style?.alternates?.[index - 1] : null;
  if (!alt) return style;
  const merged = { ...alt, avatar: { ...alt.avatar, pack: style.avatar?.pack || null }, illustrations: style.illustrations || [], alternates: style.alternates };
  // Un pack choisi mais vide ne dessinerait rien.
  if (merged.avatar.kind === 'pack' && !Object.values(merged.avatar.pack?.entries || {}).some((e) => e.url)) merged.avatar.kind = 'none';
  return merged;
}

/** Pur : range une DA en option (rang 1 ou 2) ; le rang 2 exige que le rang 1 existe. `null` = refus. */
export function setAlternate(style, slot, clientStyle) {
  const index = Number(slot) - 1;
  const list = style?.alternates || [];
  if (!Number.isInteger(index) || index < 0 || index >= MAX_ALTERNATES || index > list.length) return null;
  const next = [...list];
  next[index] = normalizeAlternates([clientStyle])[0];
  return { ...style, alternates: next };
}

/** Pur : retire une DA en option (les suivantes remontent d un rang). */
export function removeAlternate(style, slot) {
  const index = Number(slot) - 1;
  const list = style?.alternates || [];
  if (!Number.isInteger(index) || index < 0 || index >= list.length) return null;
  return { ...style, alternates: list.filter((_, i) => i !== index) };
}

/** Pur : DA envoyee par le client + pack deja en base (jamais celui du client). */
export function mergeClientStyle(existingStyle, clientStyle) {
  const next = normalizeFacelessStyle(clientStyle);
  const pack = existingStyle?.avatar?.pack || null;
  next.avatar.pack = pack;
  next.illustrations = existingStyle?.illustrations || [];
  next.alternates = existingStyle?.alternates || [];
  // Le client ne peut choisir "pack" que s il existe des images en base ; sinon : aucun avatar.
  const packReady = Boolean(pack && Object.values(pack.entries).some((e) => e.url));
  if (next.avatar.kind === 'pack') next.avatar.kind = packReady ? 'pack' : 'none';
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
/** Une regle retenue pour les prochaines videos est GENERALE et courte ; une retouche propre a une video ne l est jamais. */
export const MAX_REMEMBERED_RULE = 160;

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
  if (style.template === 'journal') {
    const lines = [
      `Direction artistique "${style.name}" : modèle JOURNAL, le journal de bord d’un créateur qui construit en public. Papier clair, serif italique pour la voix, une couleur d’accent, cartes de produit et liste de ce qui est livré. Ton humain, direct, sans effet.`,
      'Le texte à l’écran ("text", ou "title" pour une liste) est une phrase courte avec UN mot ou groupe de mots entre ** (il passe en italique de couleur). Chiffres UNIQUEMENT ceux du script.',
      'Mises en page : "hook" (grand titre ; "title" = petit libellé en capitales, ex. "Journal de bord" ; trois disques de personas décoratifs), "title" (une phrase ; "title" = libellé ; "tab" = notification facultative, ex. "Persona créé" ; l’avatar apparaît en bas à droite), "list" (SHIP LOG : "tab" = libellé, "title" = titre, 2 à 4 éléments ; "tone": "watch" = pas encore livré, ligne en tirets grisée, sinon livré avec une coche), "word" (le mot du problème en très grand ; "title" = libellé ; "text" = phrase de soutien), "stat" ("word" = le chiffre, "compare" de 2 ou 3 valeurs dites dans le script), "photo" (capture du produit dans une fenêtre : "tab" = adresse, "text" = légende), "avatar" (appel à l’action), "logo".',
      style.captions.enabled ? 'Sous-titres : en haut, en karaoké : les mots à venir en gris, le mot dit en couleur d’accent.' : 'Sous-titres : aucun.',
    ];
    if (style.rules) lines.push(`Règles de montage de cette DA :\n${style.rules}`);
    return lines.join('\n');
  }
  if (style.template === 'hanko') {
    const lines = [
      `Direction artistique "${style.name}" : modèle HANKO, une affiche de cinéma japonais. Papier crème, grand serif mincho, un disque rouge, un tampon (hanko) pour faire claquer un avis, une tier list pour classer. Un seul clin d’œil au Japon par écran, pas de décor : l’énergie vient du rythme et des tampons.`,
      'Le texte à l’écran ("text", ou "title" pour une liste) est court (3 à 7 mots) avec UN mot ou groupe de mots entre ** (il devient rouge et se souligne). Le champ "jp" (1 à 4 caractères japonais, katakana ou kanji) donne le katakana vertical d’une accroche ou le tampon d’un mot clé : vide si rien ne colle, jamais deux éléments japonais par écran.',
      'Mises en page : "hook" (titre énorme devant le disque rouge ; "jp" = katakana vertical ; "tab" = petite légende en bas), "title" et "avatar" (une bulle de dialogue, puis l’avatar dans le disque rouge avec un tampon "!"), "list" (TIER LIST : "title" = titre, 2 à 4 éléments classés dans l’ordre S, A, B, C, la lettre voulue peut aller dans "sub"), "word" (le verdict en un mot géant ; "title" = petite légende ; "jp" = tampon vertical), "stat" ("word" = le chiffre, "compare" de 2 ou 3 valeurs dites dans le script), "photo" (une affiche : "tab" = note en tampon, ex. "9/10" ; "items" = genres en pastilles), "logo". Ne cite que des faits du script.',
      style.captions.enabled ? 'Sous-titres : en haut, en mincho noir, le mot dit est souligné de rouge.' : 'Sous-titres : aucun.',
    ];
    if (style.rules) lines.push(`Règles de montage de cette DA :
${style.rules}`);
    return lines.join('\n');
  }
  if (style.template === 'herbier') {
    const lines = [
      `Direction artistique "${style.name}" : modèle HERBIER, pour un persona produits bio et hair care. Papier crème, serif doux, un rameau de feuilles au trait, et une ÉTIQUETTE DE PRODUIT décryptée ligne par ligne. Naturel, rassurant, mais précis : le persona lit les ingrédients pour la personne.`,
      'Le texte à l\'écran ("text", ou "title" pour une liste) est un titre en serif avec UN mot ou groupe de mots entre ** (il passe en italique de couleur). Rouge et vert uniquement pour JUGER un ingrédient, avec un mot et un signe.',
      'Mises en page : "hook" (titre + rameau qui pousse ; "title" = petit libellé en capitales, ex. "Décryptage"), "title" ("title" = libellé ; l\'avatar apparaît dans un disque de sauge), "list" ("tab" = libellé, "title" = titre, éléments avec "tone" : good par défaut, avoid pour ce qu\'on évite), "word" (un ingrédient en très grand ; "text" = son nom latin), "label" (l\'étiquette : "title" = libellé, "tab" = contenance, 4 à 8 "items" avec "tone" avoid / good / watch et "sub" = mot court de la pastille, "text" = le verdict), "stat", "avatar" (appel à l\'action), "photo", "logo". Ne juge que ce que le script dit.',
      style.captions.enabled ? 'Sous-titres : en haut, dans une pastille beige.' : 'Sous-titres : aucun.',
    ];
    if (style.rules) lines.push(`Règles de montage de cette DA :\n${style.rules}`);
    return lines.join('\n');
  }
  if (style.template === 'dashboard') {
    const lines = [
      `Direction artistique "${style.name}" : modèle DASHBOARD, une interface produit claire. Fond gris froid, cartes blanches, pastilles de statut, un graphique qui se construit sous les yeux. Rouge et vert uniquement pour une baisse ou une hausse, toujours avec un mot.`,
      'Le texte à l\'écran ("text") est le titre d\'une carte : une phrase courte avec UN mot clé entre ** (il passe en couleur d\'accent). Chiffres UNIQUEMENT ceux du script.',
      'Mises en page : "hook" (carte-titre ; "tab" = texte de la pastille, ex. "Alerte" ; "compare" de 2 éléments = deux petites cartes de métriques, avec un mot de sens comme "stables" ou "en baisse"), "title" ("title" = libellé de la carte ; "tab" = texte d\'une notification, facultatif ; l\'avatar apparaît ici), "list" ("title" = libellé ; 2 à 4 éléments avec "text" et une sous-ligne "sub"), "word" (un mot en très grand, "title" = libellé), "stat" ("title" = libellé, "word" = le chiffre final, "text" = pastille de variation ex. "↓ 3,1 pts", "compare" avant puis après, et "series" = les points de la courbe s\'il y en a au moins deux dans le script), "avatar" (appel à l\'action, avatar devant la carte), "photo", "logo".',
      style.captions.enabled ? 'Sous-titres : en haut, dans une pastille blanche à point de couleur.' : 'Sous-titres : aucun.',
    ];
    if (style.rules) lines.push(`Règles de montage de cette DA :\n${style.rules}`);
    return lines.join('\n');
  }
  if (style.template === 'brutal') {
    const lines = [
      `Direction artistique "${style.name}" : modèle BRUTAL, affiche de stade. Capitales condensées énormes, noir et blanc cassé, UN seul fluo par écran sur le mot qui compte, cadre épais, coupes franches.`,
      'Le texte à l\'écran ("text", ou "title" pour une liste) est découpé en lignes d\'affiche : 3 à 7 mots, avec UN seul mot ou groupe de mots entre ** (il devient le bloc fluo). Pas de phrase longue.',
      'Mises en page : "hook" (4 lignes énormes), "title" et "avatar" (phrase + petit avatar posé sur l’affiche : le seul endroit où il apparaît), "list" (2 à 4 rangées numérotées de 1 à 3 mots), "word" (le mot s\'affiche 5 fois en cascade, 12 caractères max), "stat" (chiffre clé + "compare" de 2 ou 3 valeurs, uniquement des chiffres dits), "photo", "logo". Le champ "tab" est une petite légende en bas de l\'accroche (facultatif).',
      style.captions.enabled ? 'Sous-titres : en haut, dans une étiquette noire à ombre fluo.' : 'Sous-titres : aucun.',
    ];
    if (style.rules) lines.push(`Règles de montage de cette DA :\n${style.rules}`);
    return lines.join('\n');
  }
  if (style.template === 'editeur') {
    const lines = [
      `Direction artistique "${style.name}" : modèle ÉDITEUR. Chaque scène s'affiche dans un éditeur de code sombre (lignes numérotées, coloration syntaxique, frappe au fil de la voix), avec une phrase de conclusion en dessous ; l'avatar apparaît dans une bulle ronde (chapitre, appel à l'action).`,
      'Champ "code" (scènes "hook" et "title") : 2 à 5 lignes de pseudo-code JavaScript très court qui illustre la phrase (32 caractères max par ligne). Sans "code", le moteur affiche le mot clé dans une ligne simple.',
      'Champ "tab" : le nom de fichier de l\'onglet (ex. "site.js", "solution.js", "perf.diff"). "list" : 2 à 4 éléments de 1 à 3 mots (ils deviennent un tableau). "word" : le mot apparaît dans un terminal. "stat" avec "compare" (2 valeurs, avant puis après) devient un diff avec des barres et le chiffre de "word".',
      style.captions.enabled ? 'Sous-titres : en haut, dans une étiquette sombre, tapés au fil de la voix.' : 'Sous-titres : aucun.',
    ];
    if (style.rules) lines.push(`Règles de montage de cette DA :\n${style.rules}`);
    return lines.join('\n');
  }
  if (style.template === 'cahier') {
    const lines = [
      `Direction artistique "${style.name}" : modèle CAHIER, éditorial et sobre. Fond de papier quadrillé, beaucoup d'air. Le texte à l'écran ("text", ou "title" pour une liste ou un chiffre) est une phrase à deux niveaux : les mots ordinaires en gris, le ou les mots entre ** en très grand et en noir. Ne mets donc qu'UN groupe entre ** par phrase, de 1 ou 2 mots courts.`,
      'Le centre de l\'écran est toujours une animation : privilégie "list" (phrase + 2 à 4 cartes), "stat" (phrase + marches en volume : "compare" avec 2 ou 3 valeurs chiffrées, de la plus grande à la plus petite), "word" (un mot en très grand, souligné ; "text" facultatif au-dessus) et "photo". "hook" et "title" montrent seulement la phrase, en grand au centre : pas plus d\'une scène sur trois. L\'avatar n\'apparaît QUE sur la dernière scène (mise en page "avatar", appel à l\'action), petit, en bas. Le champ "tab" ne sert pas.',
      style.captions.enabled ? 'Sous-titres : en haut, sans boîte, mots déjà dits en gris.' : 'Sous-titres : aucun.',
    ];
    if (style.rules) lines.push(`Règles de montage de cette DA :\n${style.rules}`);
    return lines.join('\n');
  }
  if (style.template === 'fenetre') {
    const lines = [
      `Direction artistique "${style.name}" : modèle FENÊTRE. Chaque scène s'affiche dans une fenêtre d'ordinateur posée sur un aplat de couleur, l'avatar passe devant la fenêtre. Les textes apparaissent mot par mot ; le mot clé entre ** devient une étiquette de couleur (accroche, appel à l'action) ou passe en jaune (chapitre).`,
      'Champ "tab" (toutes les scènes) : le nom affiché dans la barre de la fenêtre, comme un fichier ou une adresse (ex. "monsite.fr", "couches.md", "resultat.live"), 24 caractères max, cohérent avec ce qui est dit.',
      'Mise en page "stat" bienvenue pour un chiffre clé dit dans le script ; "list" : 2 à 4 lignes de 1 à 4 mots.',
      style.captions.enabled ? 'Sous-titres : dans une étiquette noire au-dessus de la fenêtre.' : 'Sous-titres : aucun.',
    ];
    if (style.rules) lines.push(`Règles de montage de cette DA :\n${style.rules}`);
    return lines.join('\n');
  }
  const lines = [
    `Direction artistique "${style.name}" : cartes ${FACELESS_CARD_STYLES[style.card]}, fond ${FACELESS_BACKGROUNDS[style.background]}, mouvement ${style.motion === 'stopmotion' ? 'stop motion' : 'fluide'}.`,
    `Densité : ${FACELESS_DENSITIES[style.density]}.`,
    `Transitions autorisées : ${style.enters.join(', ')}.`,
    style.captions.enabled ? `Sous-titres : ${FACELESS_CAPTION_STYLES[style.captions.style]}, placés en ${style.captions.position === 'top' ? 'haut' : 'bas'}.` : 'Sous-titres : aucun.',
  ];
  if (style.rules) lines.push(`Règles de montage de cette DA :\n${style.rules}`);
  return lines.join('\n');
}
