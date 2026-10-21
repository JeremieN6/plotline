import { buildChibiSvg } from './facelessAvatar.js';
import { FACELESS_FONTS, FACELESS_TEMPLATE_EXTRA_FONTS, FACELESS_TEMPLATE_MONO } from '../data/facelessThemes.js';
import { normalizeFacelessStyle } from './facelessStyle.js';
import { FENETRE_CAPTION_TOP, fenetreCss, fenetreScene } from './facelessTemplateFenetre.js';
import { CAHIER_CAPTION_TOP, cahierCss, cahierScene } from './facelessTemplateCahier.js';
import { EDITEUR_CAPTION_TOP, editeurCss, editeurScene } from './facelessTemplateEditeur.js';
import { BRUTAL_CAPTION_TOP, brutalBg, brutalCss, brutalScene } from './facelessTemplateBrutal.js';
import { DASHBOARD_CAPTION_TOP, dashboardBg, dashboardCss, dashboardScene } from './facelessTemplateDashboard.js';
import { HERBIER_CAPTION_TOP, herbierCss, herbierScene } from './facelessTemplateHerbier.js';
import { HANKO_CAPTION_TOP, hankoCss, hankoScene } from './facelessTemplateHanko.js';

// Modeles visuels autres que "classic" : dessin des scenes, feuille de style, place des sous-titres.
const ENGINES = {
  fenetre: { scene: fenetreScene, css: fenetreCss, captionTop: FENETRE_CAPTION_TOP, capWrap: true },
  cahier: { scene: cahierScene, css: cahierCss, captionTop: CAHIER_CAPTION_TOP, capWrap: false },
  editeur: { scene: editeurScene, css: editeurCss, captionTop: EDITEUR_CAPTION_TOP, capWrap: true },
  // "bg" : le modele choisit lui-meme le fond de chaque scene (le mot geant est inverse).
  herbier: { scene: herbierScene, css: herbierCss, captionTop: HERBIER_CAPTION_TOP, capWrap: true },
  hanko: { scene: hankoScene, css: hankoCss, captionTop: HANKO_CAPTION_TOP, capWrap: true },
  dashboard: { scene: dashboardScene, css: dashboardCss, captionTop: DASHBOARD_CAPTION_TOP, capWrap: true, bg: dashboardBg },
  brutal: { scene: brutalScene, css: brutalCss, captionTop: BRUTAL_CAPTION_TOP, capWrap: true, bg: brutalBg },
};

/**
 * Video faceless : timeline + direction artistique -> une page HTML autonome.
 * La page expose `window.__seek(t)`, qui dessine l image a l instant t sans
 * aucune animation CSS en temps reel : le rendu image par image est donc
 * deterministe.
 *
 * La DA (palette, police, cartes, fond, mouvement, sous-titres, avatar) vient
 * de `style` (voir facelessStyle.js). Rien n est ecrit en dur ici sauf la
 * structure des mises en page.
 */

/**
 * Origine fictive des fichiers du theme (polices, images d avatar) : le moteur
 * de rendu intercepte ces requetes. Le rendu est ainsi identique sous Windows
 * et sur le serveur Linux.
 */
export const FACELESS_ASSET_ORIGIN = 'https://faceless.assets';

// Emojis : police systeme (Noto Color Emoji sur le serveur, Segoe sous Windows).
const EMOJI_FONTS = '"Noto Color Emoji","Segoe UI Emoji","Apple Color Emoji"';

// Zone utile : a droite les boutons TikTok/Reels, en bas la legende et le pseudo.
const SAFE = { left: 70, right: 150, top: 170, bottom: 420 };

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pur : contour dechire (clip-path polygon), meme graine = meme dechirure. */
export function tornClipPath(seed, amplitude = 1.6, step = 4) {
  const rand = mulberry32(seed);
  const jitter = () => (rand() * amplitude).toFixed(2);
  const points = [];
  for (let x = 0; x < 100; x += step) points.push(`${x}% ${jitter()}%`);
  for (let y = 0; y < 100; y += step * 2) points.push(`${100 - Number(jitter())}% ${y}%`);
  for (let x = 100; x > 0; x -= step) points.push(`${x}% ${100 - Number(jitter())}%`);
  for (let y = 100; y > 0; y -= step * 2) points.push(`${jitter()}% ${y}%`);
  return `polygon(${points.join(', ')})`;
}

/**
 * Pur : couleur de texte lisible sur un fond (noir ou blanc selon la luminosite
 * percue). Evite du texte blanc sur un accent clair (vert menthe, jaune...).
 */
export function readableTextOn(hex) {
  const m = /^#([0-9a-f]{6})$/i.exec(String(hex || ''));
  if (!m) return '#ffffff';
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#141414' : '#ffffff';
}

/** Pur : echappe le texte puis transforme **mot** en surlignage. */
export function richText(text) {
  const escaped = String(text ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  return escaped.replace(/\*\*(.+?)\*\*/g, '<mark>$1</mark>').replace(/\n/g, '<br>');
}

let seedCounter = 1;
const nextSeed = () => (seedCounter += 7919);
const uid = (prefix) => `${prefix}-${nextSeed()}`;

// DA et images d avatar de la page en cours de construction.
let T = { style: null, packEntries: {}, illustrations: {} };

/** Entree d animation autorisee par la DA (sinon "pop", sinon la premiere permise). */
function ent(name) {
  const allowed = T.style.enters;
  if (allowed.includes(name)) return name;
  return allowed.includes('pop') ? 'pop' : allowed[0];
}

/**
 * Un element anime : position absolue, entree, vibration. `id` + `follow`
 * (id d un autre element) : l element est pose SOUS celui-ci une fois la page
 * mise en page, pour qu un titre sur deux lignes ne chevauche pas la carte.
 */
function fx(html, { x, y, w, h, enter = 'pop', at = 0, until, rot = 0, boil = 1, z = 1, cls = '', id, follow, gap = 36, fixedEnter = false, data = null } = {}) {
  const style = [
    `left:${x}px`, `top:${y}px`,
    w != null ? `width:${w}px` : '', h != null ? `height:${h}px` : '',
    `z-index:${z}`,
  ].filter(Boolean).join(';');
  // Entrees propres a un modele (fenetre, peek...) : hors liste de la DA, donnees telles quelles.
  const extra = data ? Object.entries(data).map(([k, v]) => ` data-${k}="${v}"`).join('') : '';
  return `<div class="fx ${cls}"${id ? ` id="${id}"` : ''} style="${style}" data-enter="${fixedEnter ? enter : ent(enter)}" data-at="${at}"${extra}`
    + `${follow ? ` data-follow="${follow}" data-gap="${gap}"` : ''}`
    + `${until != null ? ` data-until="${until}"` : ''} data-rot="${rot}" data-boil="${boil}" data-seed="${nextSeed()}">${html}</div>`;
}

function card(text, { size = 72, seed, align = 'center', tone = 'cream' } = {}) {
  const torn = T.style.card === 'torn';
  const tapeHtml = torn
    ? `<span class="tape" style="left:-24px;top:-18px;transform:rotate(-24deg)"></span><span class="tape" style="right:-24px;top:-18px;transform:rotate(22deg)"></span>`
    : '';
  const clip = torn ? `clip-path:${tornClipPath(seed ?? nextSeed())};` : '';
  return `<div class="card-wrap">${tapeHtml}<div class="card ${tone}" style="${clip}text-align:${align}">`
    + `<div class="card-text" style="font-size:${size}px">${richText(text)}</div></div></div>`;
}

function sticker(content, size) {
  return `<div class="sticker" style="font-size:${size}px">${content}</div>`;
}

const AVATAR_SPOTS = {
  'bottom-left': { x: SAFE.left - 10, y: 1000, size: 520 },
  'bottom-right': { x: 1080 - SAFE.right - 520, y: 1000, size: 520 },
  'peek-left': { x: SAFE.left - 30, y: 1150, size: 420 },
  'peek-right': { x: 1080 - SAFE.right - 400, y: 1150, size: 420 },
  // Sous une photo : plus bas et plus petit, pour ne pas cacher la legende du cadre.
  'photo-low': { x: 1080 - SAFE.right - 400, y: 1215, size: 390 },
  center: { x: 115, y: 640, size: 780 },
  // Buste qui "monte du bas de l ecran" : on ne le voit jamais coupe en l air.
  'from-bottom': { x: 130, y: 860, size: 760 },
};

const HEAD_RATIO = 320 / 340;
const BODY_RATIO = 580 / 420;

/** Image d avatar (ou dessin) pour un repere : { mode, html }. */
function avatarVisual(beat, avatar) {
  const wanted = beat.expr;
  const entry = T.packEntries[wanted];
  if (entry) {
    return { mode: entry.mode, html: `<img class="avatar-img" alt="" src="${FACELESS_ASSET_ORIGIN}/avatar/${encodeURIComponent(wanted)}.png">` };
  }
  const mode = avatar.mode === 'body' ? 'body' : 'head';
  const svg = buildChibiSvg({
    expression: wanted || avatar.expr || 'neutral',
    mode,
    pose: beat.pose || avatar.pose || 'idle',
    look: T.style.avatar.svg,
    accent: T.style.palette.accent,
    id: `s${nextSeed()}`,
  });
  return { mode, html: svg };
}

function avatarBlock(scene, defaults) {
  const avatar = { ...defaults, ...(scene.avatar || {}) };
  if (avatar.hidden) return '';
  const beats = scene.beats?.length ? scene.beats : [{ at: 0, expr: avatar.expr || 'neutral' }];

  return beats.map((beat, i) => {
    const until = i + 1 < beats.length ? beats[i + 1].at : undefined;
    const flip = beat.flip ?? avatar.flip ?? false;
    const visual = avatarVisual(beat, avatar);

    let spot = AVATAR_SPOTS[avatar.pos] || AVATAR_SPOTS[defaults.pos];
    let size = avatar.size || spot.size;
    let x = spot.x;
    let y = spot.y;
    let height = Math.round(size * (visual.mode === 'body' ? BODY_RATIO : HEAD_RATIO));

    if (visual.mode === 'body' && avatar.pos !== 'from-bottom') {
      // Un buste dans une mise en page prevue pour une tete : plus petit, pose en bas de l ecran.
      size = Math.round(size * 0.85);
      height = Math.round(size * BODY_RATIO);
      y = 1940 - height;
    } else if (visual.mode === 'head' && avatar.pos === 'from-bottom') {
      spot = AVATAR_SPOTS.center;
      size = spot.size;
      x = spot.x;
      y = spot.y;
      height = Math.round(size * HEAD_RATIO);
    }

    return fx(`<div class="avatar${flip ? ' flip' : ''}">${visual.html}</div>`, {
      x, y, w: size, h: height,
      enter: i === 0 ? (avatar.enter || 'rise') : 'hop',
      at: beat.at, until, rot: beat.rot ?? avatar.rot ?? (flip ? 3 : -3), z: 5,
    });
  }).join('');
}

const LAYOUTS = {
  // Grosse accroche sur carte + avatar en bas.
  hook(scene) {
    return fx(card(scene.text, { size: scene.size || 96 }), { x: SAFE.left + 10, y: 420, w: 840, enter: scene.enter || 'drop', rot: -2 })
      + (scene.emoji ? fx(sticker(scene.emoji, 170), { x: 720, y: 1090, w: 200, enter: 'pop', at: 0.25, rot: 12, z: 3 }) : '')
      + avatarBlock(scene, { pos: 'bottom-left', mode: 'head' });
  },
  // Numero + titre + phrase courte.
  title(scene) {
    const headlineId = uid('h');
    return (scene.number ? fx(`<div class="badge">${richText(scene.number)}</div>`, { x: SAFE.left + 20, y: 400, w: 200, h: 200, enter: 'pop', rot: -8, z: 3 }) : '')
      + fx(`<div class="headline">${richText(scene.title)}</div>`, { x: SAFE.left + 10, y: 620, w: 860, enter: scene.enter || 'slide-left', rot: -1.5, z: 2, id: headlineId })
      + (scene.text ? fx(card(scene.text, { size: 62, tone: 'white' }), { x: SAFE.left + 30, y: 790, w: 800, enter: 'rise', at: 0.35, rot: 1.5, follow: headlineId, gap: 50 }) : '')
      + (scene.emoji ? fx(sticker(scene.emoji, 170), { x: 700, y: 410, w: 200, enter: 'pop', at: 0.2, rot: 10, z: 4 }) : '')
      + avatarBlock(scene, { pos: 'peek-right', mode: 'head' });
  },
  // Liste qui se remplit au fil des mots.
  list(scene) {
    const headerId = uid('lh');
    const header = scene.title
      ? fx(`<div class="headline small">${richText(scene.title)}</div>`, { x: SAFE.left + 10, y: 410, w: 860, enter: 'drop', rot: -1.5, id: headerId })
      : '';
    let previous = scene.title ? headerId : '';
    const items = (scene.items || []).map((item, i) => {
      const id = uid('li');
      const html = fx(
        `<div class="list-item">${item.emoji ? `<span class="li-emoji">${item.emoji}</span>` : ''}<span>${richText(item.text)}</span></div>`,
        { x: SAFE.left + 20 + (i % 2) * 40, y: 590 + i * 190, w: 780, enter: i % 2 ? 'slide-right' : 'slide-left', at: item.at, rot: i % 2 ? 1.5 : -1.5, id, follow: previous, gap: 40 },
      );
      previous = id;
      return html;
    }).join('');
    return header + items + avatarBlock(scene, { pos: 'peek-left', mode: 'head', flip: true });
  },
  // L avatar seul, grand, avec une courte bulle de texte.
  avatar(scene) {
    return (scene.text ? fx(card(scene.text, { size: 70 }), { x: SAFE.left + 30, y: 410, w: 800, enter: 'drop', rot: -2, z: 6 }) : '')
      + avatarBlock(scene, { pos: 'from-bottom', mode: 'body' });
  },
  // Un seul mot en tres grand (emphase).
  word(scene) {
    // Taille ajustee a la longueur : un mot ne passe jamais a la ligne.
    const size = scene.size || Math.min(200, Math.floor(1500 / Math.max(4, String(scene.word || '').length)));
    return fx(`<div class="big-word" style="font-size:${size}px">${richText(scene.word)}</div>`, { x: SAFE.left, y: 560, w: 860, enter: 'pop', rot: -3 })
      + (scene.emoji ? fx(sticker(scene.emoji, 200), { x: 620, y: 1040, w: 220, enter: 'pop', at: 0.2, rot: 8 }) : '')
      + avatarBlock(scene, { pos: 'peek-left', mode: 'head', hidden: !scene.avatar });
  },
  // Photo dans un cadre : polaroid (papier, scotch, legende) ou cadre simple selon la DA.
  photo(scene) {
    const entry = T.illustrations[scene.image];
    // Image introuvable (supprimee du dossier ?) : la scene reste lisible en "avatar".
    if (!entry) return LAYOUTS.avatar({ ...scene, text: scene.text || scene.title || '' });

    const polaroid = (scene.frame || (T.style.card === 'flat' ? 'plain' : 'polaroid')) === 'polaroid';
    const tape = polaroid
      ? '<span class="tape" style="left:-26px;top:-20px;transform:rotate(-24deg)"></span><span class="tape" style="right:-26px;top:-20px;transform:rotate(22deg)"></span>'
      : '';
    const caption = scene.text ? `<div class="photo-cap">${richText(scene.text)}</div>` : '';
    const html = `<div class="photo-wrap">${tape}<div class="photo ${polaroid ? 'polaroid' : 'plainframe'}">`
      + `<img class="photo-img" alt="" src="${FACELESS_ASSET_ORIGIN}/illustration/${encodeURIComponent(scene.image)}.jpg">${caption}</div></div>`;
    return fx(html, { x: SAFE.left + 150, y: 410, w: 560, enter: scene.enter || 'drop', rot: polaroid ? -3 : -1.5, z: 3 })
      + avatarBlock(scene, { pos: 'photo-low', mode: 'head' });
  },
  // Chiffre cle : le chiffre en tres grand, la phrase et la comparaison sur une carte.
  stat(scene) {
    const size = Math.min(200, Math.floor(1500 / Math.max(4, String(scene.word || '').length)));
    const lines = (scene.compare || []).map((row) => `${row.label} : **${row.value}**`).join('\n');
    const text = [scene.text, lines].filter(Boolean).join('\n');
    return fx(`<div class="big-word" style="font-size:${size}px">${richText(scene.word)}</div>`, { x: SAFE.left, y: 480, w: 860, enter: 'pop', rot: -3 })
      + (text ? fx(card(text, { size: 58, tone: 'white' }), { x: SAFE.left + 30, y: 860, w: 800, enter: 'rise', at: 0.3, rot: 1.5 }) : '')
      + avatarBlock(scene, { pos: 'peek-left', mode: 'head' });
  },
  // Carte de nom (marque, outil) : un grand emoji et le nom dessous.
  logo(scene) {
    const size = Math.min(110, Math.floor(980 / Math.max(5, String(scene.word || '').length)));
    return fx(sticker(scene.emoji || '✨', 300), { x: 330, y: 470, w: 340, enter: 'pop', rot: -6, z: 3 })
      + fx(card(scene.word, { size }), { x: SAFE.left + 90, y: 850, w: 680, enter: 'rise', at: 0.15, rot: 2 })
      + avatarBlock(scene, { pos: 'peek-left', mode: 'head', hidden: !scene.avatar });
  },
};

function decorLayer() {
  if (T.style.decor !== 'shapes') return '';
  const p = T.style.palette;
  const shapes = [
    { svg: `<path d="M10 60 Q10 20 50 25 Q60 0 95 15 Q130 5 135 40 Q165 45 155 75 Q150 95 120 92 L30 92 Q5 90 10 60 Z" fill="${p.card}"/>`, x: 40, y: 1500, w: 260, rot: -4 },
    { svg: `<path d="M80 140 C10 95 0 40 40 25 C60 18 75 30 80 45 C85 30 100 18 120 25 C160 40 150 95 80 140 Z" fill="${p.accent}" fill-opacity=".8"/>`, x: 880, y: 150, w: 130, rot: 12 },
    { svg: `<path d="M80 5 L98 58 L155 60 L110 95 L126 150 L80 118 L34 150 L50 95 L5 60 L62 58 Z" fill="${p.accent2}"/>`, x: 30, y: 120, w: 110, rot: -10 },
    { svg: `<circle cx="80" cy="80" r="70" fill="${p.dark}" fill-opacity=".3"/>`, x: 930, y: 1600, w: 120, rot: 0 },
  ];
  return shapes.map((d) => fx(
    `<svg viewBox="0 0 160 160" width="100%" class="paper-shape">${d.svg}</svg>`,
    { x: d.x, y: d.y, w: d.w, enter: 'cut', rot: d.rot, boil: 2.2, z: 0 },
  )).join('');
}

const NOISE = "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 .35  0 0 0 0 .25  0 0 0 0 .2  0 0 0 .09 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

function backgroundCss(style) {
  switch (style.background) {
    case 'grid':
      return '.bg::before{background-image:linear-gradient(var(--line) 2px,transparent 2px),linear-gradient(90deg,var(--line) 2px,transparent 2px);background-size:54px 54px}';
    case 'notebook':
      return '.bg::before{background-image:linear-gradient(90deg,transparent 106px,rgba(214,80,80,.4) 106px,rgba(214,80,80,.4) 110px,transparent 110px),linear-gradient(transparent 62px,var(--line) 62px,var(--line) 64px,transparent 64px);background-size:100% 100%,100% 64px}';
    case 'kraft':
      return `.bg::before{background-image:${NOISE}}.bg{filter:saturate(.9) brightness(.97)}`;
    case 'solid':
      return '';
    default:
      return `.bg::before{background-image:radial-gradient(circle at 20% 15%,rgba(255,255,255,.5),transparent 45%),radial-gradient(circle at 85% 80%,rgba(255,255,255,.25),transparent 50%),${NOISE}}`;
  }
}

function fontFace(font) {
  return `@font-face{font-family:"${font.family}";src:url("${FACELESS_ASSET_ORIGIN}/${font.file}") format("truetype");font-weight:${font.weights};font-stretch:${font.stretch}}\n`;
}

/** Specification de chargement (document.fonts.load) d une police supplementaire. */
function fontLoadSpec(f) {
  return (f.style === 'italic' ? 'italic ' : '') + f.weights.split(' ')[0] + ' 100px "' + f.family + '"';
}

/** Police supplementaire d un modele (graisses ou italique en plus de la police principale). */
function extraFontFace(f) {
  return `@font-face{font-family:"${f.family}";src:url("${FACELESS_ASSET_ORIGIN}/${f.file}") format("truetype");font-weight:${f.weights};font-style:${f.style || 'normal'}}\n`;
}

function buildCss(style) {
  const p = style.palette;
  const font = FACELESS_FONTS[style.font];
  const flat = style.card === 'flat';
  const sticker = style.card === 'sticker';
  const ink = p.text;
  const white = '#ffffff';
  const onAccent = readableTextOn(p.accent);
  const caps = style.captions;
  const capCommon = `#captions span{display:inline-block;flex:0 0 auto;margin:0 18px;font-size:${flat ? 88 : 84}px;font-weight:${flat ? 900 : 800};${flat ? 'letter-spacing:-1px;' : ''}`;
  let capStyle;
  if (caps.style === 'box') {
    capStyle = `${capCommon}color:var(--cardText);background:var(--card);border:5px solid ${ink};border-radius:${flat ? 0 : 18}px;padding:2px 22px;margin:6px 10px}`;
  } else if (caps.style === 'plain') {
    capStyle = `${capCommon}color:${ink}}#captions.tone-dark span{color:#fff}`;
  } else {
    capStyle = `${capCommon}color:${ink};filter:drop-shadow(0 0 0 #fff) drop-shadow(6px 0 0 #fff) drop-shadow(-6px 0 0 #fff) drop-shadow(0 6px 0 #fff) drop-shadow(0 -6px 0 #fff)}`;
  }
  const outlineShadow = 'drop-shadow(0 0 0 #fff) drop-shadow(7px 0 0 #fff) drop-shadow(-7px 0 0 #fff) drop-shadow(0 7px 0 #fff) drop-shadow(0 -7px 0 #fff)';

  return `
@font-face{font-family:"${font.family}";src:url("${FACELESS_ASSET_ORIGIN}/${font.file}") format("truetype");font-weight:${font.weights};font-stretch:${font.stretch}}
:root{--text:${p.text};--accent:${p.accent};--accent2:${p.accent2};--card:${p.card};--cardText:${p.cardText};--ink:${ink};--card2:${style.card === 'torn' ? white : p.card}}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1080px;height:1920px;overflow:hidden}
body{background:${p.background};font-family:"${font.family}",${EMOJI_FONTS},sans-serif;color:${p.text}}
.scene{position:absolute;inset:0;display:none}
.scene.bg-main{--bgc:${p.background};--line:rgba(0,0,0,.07)}
.scene.bg-alt{--bgc:${p.backgroundAlt};--line:rgba(0,0,0,.07)}
.scene.bg-dark{--bgc:${p.dark};--line:rgba(255,255,255,.1)}
.bg{position:absolute;inset:0;background-color:var(--bgc)}
.bg::before{content:"";position:absolute;inset:0}
${backgroundCss(style)}
.fx{position:absolute;transform-origin:50% 50%;visibility:hidden}
.card-wrap{position:relative;${style.card === 'torn' ? 'filter:drop-shadow(5px 9px 0 rgba(0,0,0,.16));' : ''}}
.card{padding:${flat ? '40px 46px' : '46px 52px'};background:var(--card);color:var(--cardText);${flat ? `border:6px solid ${ink};box-shadow:12px 12px 0 ${ink};` : ''}${sticker ? `border:12px solid #fff;border-radius:44px;box-shadow:0 10px 0 rgba(0,0,0,.14);` : ''}}
.card.white{background:var(--card2)}
.card-text{font-weight:${flat ? 900 : 700};line-height:1.12;letter-spacing:-.5px;${flat ? 'text-transform:uppercase;' : ''}}
mark{${flat ? `background:var(--accent);color:${onAccent};padding:0 12px` : 'background:linear-gradient(transparent 52%,color-mix(in srgb,var(--accent) 38%,transparent) 52%,color-mix(in srgb,var(--accent) 38%,transparent) 90%,transparent 90%);color:inherit;padding:0 4px'}}
.tape{position:absolute;width:150px;height:46px;background:color-mix(in srgb,var(--accent) 45%,#fff);opacity:.85;z-index:2;
  box-shadow:0 1px 0 rgba(0,0,0,.05);background-image:repeating-linear-gradient(90deg,rgba(255,255,255,.35) 0 8px,transparent 8px 16px)}
.headline{font-size:${flat ? 112 : 118}px;font-weight:${flat ? 900 : 800};line-height:${flat ? 1.02 : 1};color:var(--text);letter-spacing:${flat ? -1 : -2}px;${flat ? 'text-transform:uppercase;' : `filter:${outlineShadow} drop-shadow(6px 10px 0 rgba(0,0,0,.2));`}}
.headline mark{background:none;color:var(--accent);padding:0}
.headline.small{font-size:${flat ? 90 : 96}px}
.badge{width:200px;height:200px;border-radius:${flat ? 0 : 50}%;background:${flat ? 'var(--accent2)' : 'var(--accent)'};color:${flat ? readableTextOn(p.accent2) : onAccent};display:flex;align-items:center;justify-content:center;
  font-size:130px;font-weight:${flat ? 900 : 800};border:${flat ? `6px solid ${ink}` : '10px solid #fff'};box-shadow:${flat ? `9px 9px 0 ${ink}` : '6px 10px 0 rgba(0,0,0,.2)'}}
.sticker{line-height:1;text-align:center;font-family:${EMOJI_FONTS},sans-serif;
  filter:drop-shadow(0 0 0 #fff) drop-shadow(4px 0 0 #fff) drop-shadow(-4px 0 0 #fff) drop-shadow(0 4px 0 #fff) drop-shadow(0 -4px 0 #fff) drop-shadow(5px 9px 0 rgba(0,0,0,.2))}
.list-item{display:flex;align-items:center;gap:28px;background:var(--card);color:var(--cardText);padding:30px 40px;font-size:${flat ? 62 : 64}px;font-weight:${flat ? 900 : 700};
  ${flat ? `border:6px solid ${ink};box-shadow:10px 10px 0 ${ink};text-transform:uppercase;` : (sticker ? 'border:10px solid #fff;border-radius:36px;box-shadow:0 10px 0 rgba(0,0,0,.14);' : `border-radius:14px;box-shadow:6px 10px 0 rgba(0,0,0,.14);border:4px dashed color-mix(in srgb,var(--accent) 45%,#fff);`)}}
.li-emoji{font-family:${EMOJI_FONTS},sans-serif;font-size:76px}
.big-word{font-weight:${flat ? 900 : 800};color:var(--accent);text-align:center;line-height:1;letter-spacing:${flat ? -6 : -4}px;white-space:nowrap;${flat ? `text-transform:uppercase;text-shadow:10px 10px 0 ${ink};` : `filter:${outlineShadow.replace(/7px/g, '8px')} drop-shadow(8px 12px 0 rgba(0,0,0,.2));`}}
.photo-wrap{position:relative;${flat ? '' : 'filter:drop-shadow(6px 10px 0 rgba(0,0,0,.18));'}}
.photo{background:#fff;overflow:hidden}
.photo-img{display:block;width:100%;aspect-ratio:4/5;object-fit:cover;background:#ddd}
.photo.polaroid{padding:26px 26px 0}
.photo.polaroid .photo-cap{padding:22px 10px 32px;min-height:104px;text-align:center;font-size:58px;font-weight:700;line-height:1.1;color:var(--ink)}
.photo.plainframe{${flat ? `border:6px solid ${ink};box-shadow:12px 12px 0 ${ink};` : (sticker ? 'border:12px solid #fff;border-radius:36px;' : 'border:10px solid #fff;')}}
.photo.plainframe .photo-cap{padding:18px 24px;text-align:center;font-size:54px;font-weight:${flat ? 900 : 700};background:var(--card);color:var(--cardText);${flat ? 'text-transform:uppercase;' : ''}}
.avatar{width:100%;height:100%}
.avatar.flip{transform:scaleX(-1)}
.avatar-img{width:100%;height:100%;object-fit:contain;object-position:center bottom;display:block;
  filter:drop-shadow(0 0 0 #fff) drop-shadow(6px 0 0 #fff) drop-shadow(-6px 0 0 #fff) drop-shadow(0 6px 0 #fff) drop-shadow(0 -6px 0 #fff)${flat ? '' : ' drop-shadow(6px 10px 0 rgba(0,0,0,.16))'}}
.paper-shape{filter:drop-shadow(4px 6px 0 rgba(0,0,0,.14))}
#captions{position:absolute;left:${SAFE.left}px;width:${1080 - SAFE.left - SAFE.right}px;top:1400px;text-align:center;z-index:20;display:none;justify-content:center;white-space:nowrap}
${capStyle}
#captions span.on{color:var(--accent);transform:scale(1.12) rotate(${flat ? 0 : -3}deg)}
`;
}

// Execute dans la page. Aucune animation CSS : tout depend de t.
function buildRuntime(fontFamilies, extraLoads = []) {
  return `
(() => {
  const data = JSON.parse(document.getElementById('timeline').textContent);
  const scenes = [...document.querySelectorAll('.scene')];
  const caps = document.getElementById('captions');
  const smooth = data.motion === 'smooth';
  const ENTER = smooth ? 0.4 : 0.34;
  const hash = (a, b) => { let h = (a * 374761393 + b * 668265263) >>> 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const back = (p) => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2); };
  const ease = (p) => (smooth ? 1 - Math.pow(1 - p, 3) : back(p));
  let lastCaption = '';
  let lastTone = '';
  const clamp = (v) => Math.max(0, Math.min(1, v));
  const cubic = (p) => 1 - Math.pow(1 - p, 3);
  const backC = (p, c) => 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2);
  const inout = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
  const expo = (p) => (p >= 1 ? 1 : 1 - Math.pow(2, -10 * p));
  // Ressort amorti (zeta 0,55, omega 14 rad/s) : 1 au repos.
  const spring = (s) => { const z = 0.55, w = 14, wd = w * Math.sqrt(1 - z * z); return 1 - Math.exp(-z * w * s) * (Math.cos(wd * s) + (z / Math.sqrt(1 - z * z)) * Math.sin(wd * s)); };
  // Entrees des modeles autres que "classic" : duree propre, opacite et flou possibles.
  const EXTRA = {
    window: { dur: 0.45, f: (p) => { const e = backC(p, 1.2); return { y: 120 * (1 - e), s: 0.94 + 0.06 * e, o: clamp(p * 2.2) }; } },
    'blur-up': { dur: 0.28, f: (p) => { const e = cubic(p); return { y: 24 * (1 - e), o: clamp(p / 0.9), b: 14 * (1 - e) }; } },
    'blur-soft': { dur: 0.45, f: (p, since) => { const e = cubic(p); return { y: 14 * (1 - e), o: clamp(since / 0.25), b: 18 * (1 - e) }; } },
    'blur-big': { dur: 0.6, f: (p, since) => { const e = cubic(p); return { s: 1.04 - 0.04 * e, o: clamp(since / 0.3), b: 24 * (1 - e) }; } },
    'giant-soft': { dur: 0.55, f: (p) => { const e = expo(p); return { s: 1.12 - 0.12 * e, b: 30 * (1 - e), o: clamp(p * 2) }; } },
    'rise-soft': { dur: 0.4, f: (p) => { const e = cubic(p); return { y: 80 * (1 - e), o: e }; } },
    'fade-in': { dur: 0.3, f: (p) => ({ o: p }) },
    flag: { dur: 0.3, f: (p) => ({ sy: backC(p, 1.6) }) },
    // Brutal : coupes franches. Les lignes s ouvrent de gauche a droite (masque), le numero tombe en frappe.
    // Dashboard : cartes douces. Une carte monte (0,4 s), une notification glisse (0,35 s), une pastille rebondit.
    card: { dur: 0.4, f: (p) => { const e = cubic(p); return { y: 50 * (1 - e), s: 0.98 + 0.02 * e, o: e }; } },
    'alert-in': { dur: 0.35, f: (p) => { const e = cubic(p); return { x: 80 * (1 - e), o: e }; } },
    pill: { dur: 0.25, f: (p) => ({ s: Math.max(0, 0.7 + 0.3 * backC(p, 2)), o: clamp(p * 4) }) },
    'word-rise': { dur: 0.25, f: (p) => { const e = cubic(p); return { y: 12 * (1 - e), o: e }; } },
    // Herbier : doux et naturel. Les mots arrivent en 0,5 s (flou 6 -> 0), l etiquette monte, le mot geant se pose.
    'serif-in': { dur: 0.5, f: (p) => { const e = 1 - Math.pow(1 - p, 2); return { y: 14 * (1 - e), b: 6 * (1 - e), o: p }; } },
    'rise-card': { dur: 0.35, f: (p) => { const e = cubic(p); return { y: 24 * (1 - e), o: e }; } },
    'rise-label': { dur: 0.4, f: (p) => { const e = cubic(p); return { y: 60 * (1 - e), o: e }; } },
    'herb-giant': { dur: 0.8, f: (p) => { const e = cubic(p); return { s: 0.95 + 0.05 * e, b: 16 * (1 - e), o: p }; } },
    disc: { dur: 0.5, f: (p) => { const e = cubic(p); return { s: 0.85 + 0.15 * e, o: e }; } },
    // Hanko : le tampon frappe (echelle 2,2 -> 1 et rotation +12 deg en 0,14 s, petit rebond), le disque grandit du centre.
    hanko: { dur: 0.24, f: (p, since) => { if (since < 0.14) { const e = expo(since / 0.14); return { s: 2.2 - 1.2 * e, r: 12 * (1 - e), o: clamp(since * 20) }; } return { s: 1 - 0.04 * Math.sin(Math.PI * clamp((since - 0.14) / 0.1)) }; } },
    'hk-disc': { dur: 0.5, f: (p) => ({ s: expo(p) }) },
    'jp-line': { dur: 0.3, f: (p) => { const e = cubic(p); return { y: 40 * (1 - e), o: e }; } },
    'hk-giant': { dur: 0.35, f: (p) => { const e = expo(p); return { s: 1.25 - 0.25 * e, b: 20 * (1 - e), o: clamp(p * 2) }; } },
    'hk-bubble': { dur: 0.25, f: (p) => ({ s: Math.max(0, 0.7 + 0.3 * backC(p, 1.7)), o: clamp(p * 4) }) },
    'hk-card': { dur: 0.4, f: (p) => { const e = backC(p, 1.3); return { y: 120 * (1 - e), r: -6 * (1 - e), o: clamp(p * 3) }; } },
    'clip-row': { dur: 0.3, f: (p) => ({ c: 1 - cubic(p) }) },
    'tier-fall': { dur: 0.25, f: (p) => ({ y: -300 * (1 - backC(p, 1.2)), o: clamp(p * 4) }) },
    wipe: { dur: 0.22, f: (p) => { const e = expo(p); return { x: -120 * (1 - e), c: 1 - e }; } },
    stamp: { dur: 0.15, f: (p) => { const e = expo(p); return { s: 1.5 - 0.5 * e, o: clamp(p * 4) }; } },
    fall: { dur: 0.15, f: (p) => { const e = cubic(p); return { y: -60 * (1 - e), o: clamp(p * 4) }; } },
    shock: { dur: 0.27, f: (p, since) => (since < 0.15 ? { y: -60 * (1 - cubic(since / 0.15)), o: clamp(since * 30) } : { s: 1 + 0.06 * (1 - clamp((since - 0.15) / 0.12)) }) },
    'rise-panel': { dur: 0.35, f: (p) => { const e = cubic(p); return { y: 60 * (1 - e), o: e }; } },
    bubble: { dur: 0.4, f: (p) => ({ s: Math.max(0, backC(p, 1.6)), o: clamp(p * 4) }) },
    label: { dur: 0.35, f: (p) => { const e = backC(p, 1.8); return { s: 0.6 + 0.4 * e, r: -4 * (1 - p), o: clamp(p * 3) }; } },
    'row-in': { dur: 0.3, f: (p) => { const e = cubic(p); return { x: 60 * (1 - e), o: e }; } },
    giant: { dur: 0.4, zoom: 0.04, f: (p) => { const e = expo(p); return { s: 1.35 - 0.35 * e, b: 20 * (1 - e), o: clamp(p * 2) }; } },
    peek: { dur: 0.5, f: (p, since) => ({ y: 260 * (1 - spring(since)) }) },
    instant: { dur: 0.001, f: () => ({}) },
  };
  const hexMix = (a, b, q) => {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const ch = (sh) => Math.round(((pa >> sh) & 255) * (1 - q) + ((pb >> sh) & 255) * q);
    return 'rgb(' + ch(16) + ',' + ch(8) + ',' + ch(0) + ')';
  };

  function placeExtra(el, def, at, local, t, dur) {
    const since = local - at;
    const v = def.f(clamp(since / def.dur), since);
    let x = v.x || 0, y = v.y || 0, s = v.s == null ? 1 : v.s, r = v.r || 0, o = v.o == null ? 1 : v.o, b = v.b || 0;
    // Etirement vertical seul (drapeau qui se deplie depuis le bas).
    const clip = v.c ? 'inset(0 ' + (v.c * 100).toFixed(1) + '% 0 0)' : '';
    const sy = v.sy == null ? '' : ' scale(1,' + Math.max(0, v.sy).toFixed(4) + ')';
    // Zoom lent apres l entree, jusqu a la fin de la scene.
    if (def.zoom && since > def.dur) s *= 1 + def.zoom * clamp((since - def.dur) / Math.max(0.5, dur - at - def.dur));
    // Respiration : leger mouvement vertical continu.
    const br = +el.dataset.breathe || 0;
    // Pulsation lente (disque rouge) : echelle 1 + amplitude * sin(2 pi t / 3).
    if (+el.dataset.pulse) s *= 1 + (+el.dataset.pulse) * Math.sin(2 * Math.PI * t / 3);
    if (br) y += br * Math.sin(2 * Math.PI * t / 2.4);
    // Sortie : la fenetre retrecit et s efface dans les 0,2 dernieres secondes de la scene.
    if (el.dataset.exit && dur - local < 0.2) { const q = clamp(1 - (dur - local) / 0.2); s *= 1 - 0.04 * q; o *= 1 - q; }
    el.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px) rotate(' + (r + (+el.dataset.rot || 0)).toFixed(2) + 'deg) scale(' + s.toFixed(4) + ')' + sy;
    el.style.opacity = o < 0.999 ? o.toFixed(3) : '';
    el.style.filter = b > 0.05 ? 'blur(' + b.toFixed(1) + 'px)' : '';
    el.style.clipPath = clip;
  }

  function place(el, local, t, dur) {
    const at = +el.dataset.at, until = el.dataset.until != null ? +el.dataset.until : Infinity;
    // Un mot dans une fenetre encore cachee reste cache.
    const host = el.classList.contains('wd') ? el.parentElement.closest('.fx') : null;
    if (local < at || local >= until || (host && host.style.visibility === 'hidden')) { el.style.visibility = 'hidden'; return; }
    el.style.visibility = 'visible';
    const def = EXTRA[el.dataset.enter];
    if (def) { placeExtra(el, def, at, local, t, dur); return; }
    // Stop motion : une image d avance, la premiere image d une entree n est jamais vide.
    const p = Math.min(1, (local - at + (smooth ? 0 : 1 / 12)) / ENTER), e = ease(p);
    let x = 0, y = 0, s = 1, r = 0;
    switch (el.dataset.enter) {
      case 'pop': s = 0.2 + 0.8 * e; r = (1 - p) * -14; break;
      case 'hop': s = p < 1 ? 0.9 + 0.1 * e : 1; y = p < 1 ? -24 * Math.sin(p * Math.PI) : 0; break;
      case 'slide-left': x = -1150 * (1 - e); break;
      case 'slide-right': x = 1150 * (1 - e); break;
      // La chute reste sous la bande des sous-titres (y < 400) : elle part 130 px plus haut, jamais du haut de l ecran.
      case 'drop': y = -130 * (1 - e); s = 1 + 0.12 * (1 - e); r = (1 - p) * 8; break;
      case 'rise': y = 1300 * (1 - e); break;
      default: break;
    }
    const seed = +el.dataset.seed, step = Math.floor(t * 8), amp = smooth ? 0 : +el.dataset.boil;
    const jr = (hash(seed, step) - 0.5) * 2 * amp, jx = (hash(seed + 1, step) - 0.5) * 4 * amp, jy = (hash(seed + 2, step) - 0.5) * 4 * amp;
    const baseRot = +el.dataset.rot * (smooth ? 0.35 : 1);
    el.style.transform = 'translate(' + (x + jx).toFixed(1) + 'px,' + (y + jy).toFixed(1) + 'px) rotate(' + (baseRot + r + jr).toFixed(2) + 'deg) scale(' + s.toFixed(3) + ')';
  }

  window.__seek = (t) => {
    // Temps global, pour les fonds qui derivent lentement (quadrillage).
    document.body.style.setProperty('--t', t.toFixed(3));
    let caption = '';
    let tone = '';
    data.scenes.forEach((sc, i) => {
      const el = scenes[i];
      const on = t >= sc.start && t < sc.end;
      el.style.display = on ? 'block' : 'none';
      if (!on) return;
      // Stop motion : entrees a 12 images/s, comptees depuis le debut de la scene
      // (arrondir t lui-meme laissait une image vide a chaque changement).
      const local = smooth ? (t - sc.start) : Math.floor((t - sc.start) * 12 + 1e-6) / 12;
      const dur = sc.end - sc.start;
      el.querySelectorAll('.fx, .wd').forEach((f) => place(f, local, t, dur));
      // Ligne active (liste) : sa couleur passe a la dominante en 0,2 s, jusqu a la ligne suivante.
      el.querySelectorAll('[data-hl-from]').forEach((r) => {
        const from = +r.dataset.hlFrom, until = r.dataset.hlUntil != null ? +r.dataset.hlUntil : Infinity;
        r.style[r.dataset.hlProp || 'backgroundColor'] = hexMix(r.dataset.hlA, r.dataset.hlB, local >= from && local < until ? clamp((local - from) / 0.2) : 0);
      });
      // Compteur d un chiffre cle (0,8 s).
      el.querySelectorAll('[data-count-to]').forEach((c) => {
        const q = cubic(clamp((local - +c.dataset.countAt) / (+c.dataset.countDur || 0.8))), dec = +c.dataset.countDec, from = +c.dataset.countFrom || 0;
        c.textContent = c.dataset.countPre + (from + (+c.dataset.countTo - from) * q).toFixed(dec).replace('.', ',') + c.dataset.countSuf;
      });
      // Encre : un mot passe du gris au noir (0,3 s) au moment ou il est dit.
      el.querySelectorAll('[data-ink-at]').forEach((w) => {
        w.style.color = hexMix(w.dataset.inkA, w.dataset.inkB, clamp((local - +w.dataset.inkAt) / 0.3));
      });
      // Frappe : une ligne de code s affiche caractere par caractere (police a chasse fixe : 1 ch = 1 caractere).
      el.querySelectorAll('[data-type-at]').forEach((ty) => {
        const n = Math.max(0, Math.min(+ty.dataset.typeLen, Math.floor((local - +ty.dataset.typeAt) * +ty.dataset.typeCps)));
        ty.style.width = n + 'ch';
      });
      // Curseur : visible de son repere au suivant, clignote a 1 Hz.
      el.querySelectorAll('[data-cur-from]').forEach((cu) => {
        const until = cu.dataset.curUntil != null ? +cu.dataset.curUntil : Infinity;
        cu.style.visibility = local >= +cu.dataset.curFrom && local < until && Math.floor(t * 2) % 2 === 0 ? 'visible' : 'hidden';
      });
      // Bloc qui se deplie de gauche a droite (lineaire), et trait qui se dessine (cadre).
      el.querySelectorAll('[data-sx-at]').forEach((b) => {
        b.style.transform = 'scaleX(' + clamp((local - +b.dataset.sxAt) / (+b.dataset.sxDur || 0.18)).toFixed(3) + ')';
      });
      el.querySelectorAll('[data-dash-at]').forEach((d) => {
        const p = clamp((local - +d.dataset.dashAt) / (+d.dataset.dashDur || 0.3));
        d.style.strokeDashoffset = (1 - (d.dataset.dashEase === 'inout' ? inout(p) : p)).toFixed(3);
      });
      // Aire d un graphique : se decouvre de gauche a droite, au rythme de la courbe.
      el.querySelectorAll('[data-clip-at]').forEach((a) => {
        const q = inout(clamp((local - +a.dataset.clipAt) / (+a.dataset.clipDur || 1)));
        a.style.clipPath = 'inset(0 ' + ((1 - q) * 100).toFixed(2) + '% 0 0)';
      });
      // Points du graphique : ils apparaissent quand la courbe les atteint.
      el.querySelectorAll('[data-pop-at]').forEach((pt) => {
        pt.style.transform = 'scale(' + Math.max(0, backC(clamp((local - +pt.dataset.popAt) / (+pt.dataset.popDur || 0.2)), +pt.dataset.popC || 2)).toFixed(3) + ')';
      });
      // Balancement leger d un rameau (rotation = deg * sin(2 pi t / 4)).
      el.querySelectorAll('[data-sway]').forEach((sw) => {
        sw.style.transform = 'rotate(' + (+sw.dataset.sway * Math.sin(2 * Math.PI * t / 4)).toFixed(3) + 'deg)';
      });
      // Fondu d un fond (ingredient juge bon) et trait qui balaie une etiquette de haut en bas (lineaire).
      el.querySelectorAll('[data-fade-at]').forEach((fd) => {
        const from = +fd.dataset.fadeFrom || 0;
        fd.style.opacity = (from + (1 - from) * clamp((local - +fd.dataset.fadeAt) / (+fd.dataset.fadeDur || 0.2))).toFixed(3);
      });
      // Flash du papier quand un tampon frappe (opacite 0 -> 0,25 -> 0 en 0,12 s).
      el.querySelectorAll('[data-flash-at]').forEach((fl) => {
        const q = (local - +fl.dataset.flashAt) / 0.12;
        fl.style.opacity = q >= 0 && q <= 1 ? (0.25 * (1 - Math.abs(2 * q - 1))).toFixed(3) : '0';
      });
      el.querySelectorAll('[data-scan-at]').forEach((sc2) => {
        const p = (local - +sc2.dataset.scanAt) / (+sc2.dataset.scanDur || 1);
        sc2.style.opacity = p >= 0 && p <= 1 ? '1' : '0';
        sc2.style.transform = 'translateY(' + (clamp(p) * +sc2.dataset.scanH).toFixed(1) + 'px)';
      });
      // Halo du dernier point : il pulse (rayon 28 + 6 sin(2 pi t / 1,4)).
      el.querySelectorAll('[data-halo-at]').forEach((hl) => {
        hl.setAttribute('r', local >= +hl.dataset.haloAt ? (28 + 6 * Math.sin(2 * Math.PI * t / 1.4)).toFixed(1) : '0');
      });
      // Volumes qui montent (marches) : hauteur 0 -> H en 0,6 s.
      el.querySelectorAll('[data-grow-h]').forEach((g) => {
        g.style.height = (+g.dataset.growH * cubic(clamp((local - +g.dataset.growAt) / 0.6))).toFixed(1) + 'px';
      });
      // Soulignement qui se trace de gauche a droite (0,5 s).
      el.querySelectorAll('[data-line-at]').forEach((u) => {
        u.style.transform = 'scaleX(' + cubic(clamp((local - +u.dataset.lineAt) / 0.5)).toFixed(3) + ')';
      });
      // Barres de comparaison (0,6 s).
      el.querySelectorAll('[data-bar-w]').forEach((bar) => {
        bar.style.width = (+bar.dataset.barW * cubic(clamp((local - +bar.dataset.barAt) / 0.6))).toFixed(2) + '%';
      });
      const chunk = sc.captionChunks.find((c) => t >= c.start && t < c.end);
      if (chunk) {
        caps.style.top = sc.captionTop + 'px';
        tone = sc.bg === 'dark' ? 'tone-dark' : '';
        caption = chunk.words.map((w) => '<span' + (t >= w.start && t < w.end ? ' class="on"' : (t >= w.end ? ' class="past"' : '')) + '>' + w.text.replace(/[<&]/g, '') + '</span>').join('');
        if (data.capWrap) caption = '<div class="cap-in">' + caption + '</div>';
      }
    });
    if (caption !== lastCaption) { caps.innerHTML = caption; lastCaption = caption; }
    if (tone !== lastTone) { caps.className = tone; lastTone = tone; }
    caps.style.display = caption ? 'flex' : 'none';
    // Un sous-titre tient TOUJOURS sur une ligne (jamais sur le contenu de la scene) : s il est trop large, on le reduit.
    caps.style.transform = '';
    if (caption) {
      let used = 0;
      caps.querySelectorAll('span').forEach((s) => {
        const cs = getComputedStyle(s);
        used += s.offsetWidth + parseFloat(cs.marginLeft) + parseFloat(cs.marginRight);
      });
      if (data.capWrap) used = caps.firstElementChild.offsetWidth;
      const avail = caps.clientWidth * 0.96;
      caps.style.transformOrigin = '50% 0';
      if (used > avail) caps.style.transform = 'scale(' + (avail / used).toFixed(3) + ')';
    }
  };
  // La police de la DA est chargee explicitement : les scenes sont masquees au
  // demarrage, le navigateur ne la demanderait qu au premier texte affiche. Mise
  // en page ensuite : les elements "follow" se posent sous leur reference (les
  // scenes sont rendues visibles le temps de mesurer) ; les images d avatar
  // sont attendues pour ne jamais capturer une image manquante.
  window.__ready = Promise.all(${JSON.stringify(fontFamilies)}.flatMap((family) => [
    document.fonts.load('700 100px "' + family + '"', 'Aa€…'),
    document.fonts.load('400 100px "' + family + '"', 'Aa'),
  ]).concat(${JSON.stringify(extraLoads)}.map((spec) => document.fonts.load(spec, 'Aa€…')))).catch(() => null).then(() => document.fonts.ready).then(() => Promise.all(
    [...document.images].map((img) => (img.complete ? null : new Promise((resolve) => { img.onload = resolve; img.onerror = resolve; }))),
  )).then(() => {
    scenes.forEach((s) => { s.style.display = 'block'; });
    // Un texte ne deborde jamais : on reduit sa taille jusqu a ce qu il tienne (largeur ou hauteur maximale).
    document.querySelectorAll('[data-fit-w], [data-fit-h]').forEach((el) => {
      const maxW = +el.dataset.fitW || Infinity, maxH = +el.dataset.fitH || Infinity;
      let size = parseFloat(getComputedStyle(el).fontSize);
      // scrollWidth : un mot trop long deborde d un bloc de largeur fixe sans en changer offsetWidth.
      for (let i = 0; i < 60 && (Math.max(el.offsetWidth, el.scrollWidth) > maxW || el.offsetHeight > maxH) && size > 20; i += 1) {
        size *= 0.95;
        el.style.fontSize = size.toFixed(1) + 'px';
      }
    });
    // Puis les elements "follow" se posent sous leur reference, une fois les tailles ajustees.
    document.querySelectorAll('[data-follow]').forEach((el) => {
      const ref = document.getElementById(el.dataset.follow);
      if (ref) el.style.top = (ref.offsetTop + ref.offsetHeight + Number(el.dataset.gap || 0)) + 'px';
    });
    scenes.forEach((s) => { s.style.display = 'none'; });
    return true;
  });
})();
`;
}

/**
 * Pur (a la graine pres) : page HTML complete de la video.
 * `options.style` : DA normalisee (defaut : papercraft pastel).
 * `options.packEntries` : { id: { mode, url } } images d avatar disponibles
 * (servies au rendu sous FACELESS_ASSET_ORIGIN/avatar/<id>.png).
 * `options.illustrations` : { id: { kind, label, url } } illustrations du dossier
 * (servies sous FACELESS_ASSET_ORIGIN/illustration/<id>.jpg).
 */
export function buildFacelessHtml(timeline, options = {}) {
  seedCounter = 1;
  const style = options.style || normalizeFacelessStyle({});
  T = { style, packEntries: options.packEntries || {}, illustrations: options.illustrations || {} };

  const bgOf = (scene) => (['alt', 'dark'].includes(scene.bg) ? scene.bg : 'main');
  const engine = ENGINES[style.template] || null;
  const ctx = {
    fx,
    avatarVisual,
    style,
    illustrations: T.illustrations,
    illustrationUrl: (id) => `${FACELESS_ASSET_ORIGIN}/illustration/${encodeURIComponent(id)}.jpg`,
    isLast: (scene) => scene === timeline.scenes[timeline.scenes.length - 1],
    seed: nextSeed,
  };
  const bgFor = (scene) => (engine?.bg ? engine.bg(scene) : bgOf(scene));
  const scenesHtml = timeline.scenes.map((scene) => {
    if (engine) return `<section class="scene bg-${bgFor(scene)}"><div class="bg"></div>${engine.scene(scene, ctx)}</section>`;
    const layout = LAYOUTS[scene.layout] || LAYOUTS.avatar;
    return `<section class="scene bg-${bgOf(scene)}"><div class="bg"></div>${decorLayer()}${layout(scene)}</section>`;
  }).join('\n');

  const top = style.captions.position === 'top';
  const runtimeData = {
    motion: style.motion,
    capWrap: Boolean(engine?.capWrap),
    scenes: timeline.scenes.map((s) => ({
      start: s.start,
      end: s.end,
      bg: bgFor(s),
      captionChunks: s.captionChunks || [],
      // Haut : sous la zone de l interface TikTok ; bas : sous le mot geant ou sur le buste.
      captionTop: engine ? engine.captionTop : (top ? 150 : (s.layout === 'word' ? 840 : 1400)),
    })),
  };

  const font = FACELESS_FONTS[style.font];
  const mono = engine ? FACELESS_FONTS[FACELESS_TEMPLATE_MONO[style.template]] : null;
  const extraFaces = engine ? (FACELESS_TEMPLATE_EXTRA_FONTS[style.template] || []) : [];
  const css = engine
    ? fontFace(font) + fontFace(mono) + extraFaces.map(extraFontFace).join('') + engine.css(style, { fontFamily: font.family, monoFamily: mono.family, emojiFonts: EMOJI_FONTS })
    : buildCss(style);
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>${css}</style></head><body>`
    + `${scenesHtml}<div id="captions"></div>`
    + `<script type="application/json" id="timeline">${JSON.stringify(runtimeData).replace(/</g, '\\u003c')}</script>`
    + `<script>${buildRuntime(mono ? [font.family, mono.family] : [font.family], extraFaces.map(fontLoadSpec))}</script></body></html>`;
}
