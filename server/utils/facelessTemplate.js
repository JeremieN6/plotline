import { buildChibiSvg } from './facelessAvatar.js';

/**
 * Video faceless : timeline -> une page HTML autonome. La page expose
 * `window.__seek(t)`, qui dessine l image a l instant t sans aucune animation
 * CSS en temps reel : le rendu image par image est donc deterministe.
 *
 * Theme "papercraft pastel" : papier rose, cartes dechirees, scotch washi,
 * autocollants a contour blanc, mouvement en stop motion (12 images/s pour les
 * entrees, legere vibration du papier a 8 images/s).
 */

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

/** Pur : echappe le texte puis transforme **mot** en surlignage. */
export function richText(text) {
  const escaped = String(text ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  return escaped.replace(/\*\*(.+?)\*\*/g, '<mark>$1</mark>').replace(/\n/g, '<br>');
}

let seedCounter = 1;
const nextSeed = () => (seedCounter += 7919);

/**
 * Un element anime : position absolue, entree, vibration. `id` + `follow`
 * (id d un autre element) : l element est pose SOUS celui-ci une fois la page
 * mise en page, pour qu un titre sur deux lignes ne chevauche pas la carte.
 */
function fx(html, { x, y, w, h, enter = 'pop', at = 0, until, rot = 0, boil = 1, z = 1, cls = '', id, follow, gap = 36 } = {}) {
  const style = [
    `left:${x}px`, `top:${y}px`,
    w != null ? `width:${w}px` : '', h != null ? `height:${h}px` : '',
    `z-index:${z}`,
  ].filter(Boolean).join(';');
  return `<div class="fx ${cls}"${id ? ` id="${id}"` : ''} style="${style}" data-enter="${enter}" data-at="${at}"`
    + `${follow ? ` data-follow="${follow}" data-gap="${gap}"` : ''}`
    + `${until != null ? ` data-until="${until}"` : ''} data-rot="${rot}" data-boil="${boil}" data-seed="${nextSeed()}">${html}</div>`;
}

const uid = (prefix) => `${prefix}-${nextSeed()}`;

function card(text, { size = 72, seed, tape = true, align = 'center', tone = 'cream' } = {}) {
  const tapeHtml = tape
    ? `<span class="tape" style="left:-24px;top:-18px;transform:rotate(-24deg)"></span><span class="tape" style="right:-24px;top:-18px;transform:rotate(22deg)"></span>`
    : '';
  return `<div class="card-wrap">${tapeHtml}<div class="card ${tone}" style="clip-path:${tornClipPath(seed ?? nextSeed())};text-align:${align}">`
    + `<div class="card-text" style="font-size:${size}px">${richText(text)}</div></div></div>`;
}

function sticker(content, size) {
  return `<div class="sticker" style="font-size:${size}px">${content}</div>`;
}

const AVATAR_SPOTS = {
  'bottom-left': { x: SAFE.left - 10, y: 1000, size: 520 },
  'bottom-right': { x: 1080 - SAFE.right - 520, y: 1000, size: 520 },
  'peek-left': { x: SAFE.left - 30, y: 1110, size: 420 },
  'peek-right': { x: 1080 - SAFE.right - 400, y: 1110, size: 420 },
  center: { x: 115, y: 640, size: 780 },
  // Buste qui "monte du bas de l ecran" : on ne le voit jamais coupe en l air.
  'from-bottom': { x: 130, y: 860, size: 760 },
};

function avatarBlock(scene, defaults) {
  const avatar = { ...defaults, ...(scene.avatar || {}) };
  if (avatar.hidden) return '';
  const spot = AVATAR_SPOTS[avatar.pos] || AVATAR_SPOTS[defaults.pos];
  const size = avatar.size || spot.size;
  const mode = avatar.mode || 'head';
  const beats = scene.beats?.length ? scene.beats : [{ at: 0, expr: avatar.expr || 'neutral' }];
  const height = mode === 'body' ? Math.round(size * 580 / 420) : Math.round(size * 320 / 340);

  return beats.map((beat, i) => {
    const until = i + 1 < beats.length ? beats[i + 1].at : undefined;
    const flip = beat.flip ?? avatar.flip ?? false;
    const svg = buildChibiSvg({ expression: beat.expr || avatar.expr || 'neutral', mode, pose: beat.pose || avatar.pose || 'idle', id: `s${nextSeed()}` });
    return fx(`<div class="avatar${flip ? ' flip' : ''}">${svg}</div>`, {
      x: spot.x, y: spot.y, w: size, h: height,
      enter: i === 0 ? (avatar.enter || 'rise') : 'hop',
      at: beat.at, until, rot: beat.rot ?? avatar.rot ?? (flip ? 3 : -3), z: 5,
    });
  }).join('');
}

const LAYOUTS = {
  // Grosse accroche sur carte dechiree + avatar en bas.
  hook(scene) {
    return fx(card(scene.text, { size: scene.size || 96 }), { x: SAFE.left + 10, y: 420, w: 840, enter: scene.enter || 'drop', rot: -2 })
      + (scene.emoji ? fx(sticker(scene.emoji, 170), { x: 700, y: 200, w: 200, enter: 'pop', at: 0.25, rot: 12, z: 3 }) : '')
      + avatarBlock(scene, { pos: 'bottom-left', mode: 'head' });
  },
  // Numero + titre + phrase courte.
  title(scene) {
    const headlineId = uid('h');
    return (scene.number ? fx(`<div class="badge">${richText(scene.number)}</div>`, { x: SAFE.left + 20, y: 330, w: 200, h: 200, enter: 'pop', rot: -8, z: 3 }) : '')
      + fx(`<div class="headline">${richText(scene.title)}</div>`, { x: SAFE.left + 10, y: 560, w: 860, enter: scene.enter || 'slide-left', rot: -1.5, z: 2, id: headlineId })
      + (scene.text ? fx(card(scene.text, { size: 62, tone: 'white' }), { x: SAFE.left + 30, y: 790, w: 800, enter: 'rise', at: 0.35, rot: 1.5, follow: headlineId, gap: 50 }) : '')
      + (scene.emoji ? fx(sticker(scene.emoji, 170), { x: 700, y: 320, w: 200, enter: 'pop', at: 0.2, rot: 10, z: 4 }) : '')
      + avatarBlock(scene, { pos: 'peek-right', mode: 'head' });
  },
  // Liste qui se remplit au fil des mots.
  list(scene) {
    const headerId = uid('lh');
    const header = scene.title
      ? fx(`<div class="headline small">${richText(scene.title)}</div>`, { x: SAFE.left + 10, y: 340, w: 860, enter: 'drop', rot: -1.5, id: headerId })
      : '';
    let previous = scene.title ? headerId : '';
    const items = (scene.items || []).map((item, i) => {
      const id = uid('li');
      const html = fx(
        `<div class="list-item">${item.emoji ? `<span class="li-emoji">${item.emoji}</span>` : ''}<span>${richText(item.text)}</span></div>`,
        { x: SAFE.left + 20 + (i % 2) * 40, y: 530 + i * 200, w: 780, enter: i % 2 ? 'slide-right' : 'slide-left', at: item.at, rot: i % 2 ? 1.5 : -1.5, id, follow: previous, gap: 40 },
      );
      previous = id;
      return html;
    }).join('');
    return header + items + avatarBlock(scene, { pos: 'peek-left', mode: 'head', flip: true });
  },
  // L avatar seul, grand, avec une courte bulle de texte.
  avatar(scene) {
    return (scene.text ? fx(card(scene.text, { size: 70 }), { x: SAFE.left + 30, y: 260, w: 800, enter: 'drop', rot: -2, z: 6 }) : '')
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
};

const DECOR = [
  { svg: '<path d="M10 60 Q10 20 50 25 Q60 0 95 15 Q130 5 135 40 Q165 45 155 75 Q150 95 120 92 L30 92 Q5 90 10 60 Z" fill="#ffffff"/>', x: 40, y: 1500, w: 260, rot: -4 },
  { svg: '<path d="M80 140 C10 95 0 40 40 25 C60 18 75 30 80 45 C85 30 100 18 120 25 C160 40 150 95 80 140 Z" fill="#ff8fb1"/>', x: 880, y: 150, w: 130, rot: 12 },
  { svg: '<path d="M80 5 L98 58 L155 60 L110 95 L126 150 L80 118 L34 150 L50 95 L5 60 L62 58 Z" fill="#ffd166"/>', x: 30, y: 120, w: 110, rot: -10 },
  { svg: '<circle cx="80" cy="80" r="70" fill="#bde4ff"/>', x: 930, y: 1600, w: 120, rot: 0 },
];

function decorLayer() {
  return DECOR.map((d) => fx(
    `<svg viewBox="0 0 160 160" width="100%" class="paper-shape">${d.svg}</svg>`,
    { x: d.x, y: d.y, w: d.w, enter: 'cut', rot: d.rot, boil: 2.2, z: 0 },
  )).join('');
}

const CSS = `
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1080px;height:1920px;overflow:hidden}
body{background:#f9dbe5;font-family:"Bahnschrift","Segoe UI",sans-serif;color:#3b2433}
#paper{position:absolute;inset:0;background:
  radial-gradient(circle at 20% 15%,rgba(255,255,255,.55),transparent 45%),
  radial-gradient(circle at 85% 80%,rgba(255,200,220,.6),transparent 50%),
  url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 .45  0 0 0 0 .25  0 0 0 0 .3  0 0 0 .09 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")}
.scene{position:absolute;inset:0;display:none}
.fx{position:absolute;transform-origin:50% 50%;visibility:hidden}
.card-wrap{position:relative;filter:drop-shadow(5px 9px 0 rgba(122,59,82,.18))}
.card{padding:46px 52px;background:#fffaf1}
.card.white{background:#ffffff}
.card-text{font-weight:700;line-height:1.12;letter-spacing:-.5px}
mark{background:linear-gradient(transparent 52%,#ffb3cb 52%,#ffb3cb 90%,transparent 90%);color:inherit;padding:0 4px}
.tape{position:absolute;width:150px;height:46px;background:rgba(255,182,206,.78);z-index:2;
  box-shadow:0 1px 0 rgba(0,0,0,.05);background-image:repeating-linear-gradient(90deg,rgba(255,255,255,.35) 0 8px,transparent 8px 16px)}
.headline{font-size:118px;font-weight:800;line-height:1;color:#3b2433;letter-spacing:-2px;
  filter:drop-shadow(0 0 0 #fff) drop-shadow(7px 0 0 #fff) drop-shadow(-7px 0 0 #fff) drop-shadow(0 7px 0 #fff) drop-shadow(0 -7px 0 #fff) drop-shadow(6px 10px 0 rgba(122,59,82,.22))}
.headline mark{background:none;color:#ff4f8b}
.headline.small{font-size:96px}
.badge{width:200px;height:200px;border-radius:50%;background:#ff6f9c;color:#fff;display:flex;align-items:center;justify-content:center;
  font-size:130px;font-weight:800;border:10px solid #fff;box-shadow:6px 10px 0 rgba(122,59,82,.2)}
.sticker{line-height:1;text-align:center;font-family:"Segoe UI Emoji","Noto Color Emoji",sans-serif;
  filter:drop-shadow(0 0 0 #fff) drop-shadow(4px 0 0 #fff) drop-shadow(-4px 0 0 #fff) drop-shadow(0 4px 0 #fff) drop-shadow(0 -4px 0 #fff) drop-shadow(5px 9px 0 rgba(122,59,82,.2))}
.list-item{display:flex;align-items:center;gap:28px;background:#fff;padding:30px 40px;border-radius:14px;font-size:64px;font-weight:700;
  box-shadow:6px 10px 0 rgba(122,59,82,.16);border:4px dashed #ffc2d6}
.li-emoji{font-family:"Segoe UI Emoji","Noto Color Emoji",sans-serif;font-size:76px}
.big-word{font-weight:800;color:#ff5c93;text-align:center;line-height:1;letter-spacing:-4px;white-space:nowrap;
  filter:drop-shadow(0 0 0 #fff) drop-shadow(8px 0 0 #fff) drop-shadow(-8px 0 0 #fff) drop-shadow(0 8px 0 #fff) drop-shadow(0 -8px 0 #fff) drop-shadow(8px 12px 0 rgba(122,59,82,.2))}
.avatar{width:100%;height:100%}
.avatar.flip{transform:scaleX(-1)}
.paper-shape{filter:drop-shadow(4px 6px 0 rgba(122,59,82,.15))}
#captions{position:absolute;left:${SAFE.left}px;width:${1080 - SAFE.left - SAFE.right}px;top:1400px;text-align:center;z-index:20;display:none}
#captions span{display:inline-block;margin:0 18px;font-size:84px;font-weight:800;color:#3b2433;
  filter:drop-shadow(0 0 0 #fff) drop-shadow(6px 0 0 #fff) drop-shadow(-6px 0 0 #fff) drop-shadow(0 6px 0 #fff) drop-shadow(0 -6px 0 #fff)}
#captions span.on{color:#ff4f8b;transform:scale(1.12) rotate(-3deg)}
`;

// Execute dans la page. Aucune animation CSS : tout depend de t.
const RUNTIME = `
(() => {
  const data = JSON.parse(document.getElementById('timeline').textContent);
  const scenes = [...document.querySelectorAll('.scene')];
  const caps = document.getElementById('captions');
  const ENTER = 0.34;
  const hash = (a, b) => { let h = (a * 374761393 + b * 668265263) >>> 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const back = (p) => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2); };
  let lastCaption = '';

  function place(el, local, t) {
    const at = +el.dataset.at, until = el.dataset.until != null ? +el.dataset.until : Infinity;
    if (local < at || local >= until) { el.style.visibility = 'hidden'; return; }
    el.style.visibility = 'visible';
    // Une image d avance : la premiere image d une entree n est jamais vide.
    const p = Math.min(1, (local - at + 1 / 12) / ENTER), e = back(p);
    let x = 0, y = 0, s = 1, r = 0;
    switch (el.dataset.enter) {
      case 'pop': s = 0.2 + 0.8 * e; r = (1 - p) * -14; break;
      case 'hop': s = p < 1 ? 0.9 + 0.1 * e : 1; y = p < 1 ? -24 * Math.sin(p * Math.PI) : 0; break;
      case 'slide-left': x = -1150 * (1 - e); break;
      case 'slide-right': x = 1150 * (1 - e); break;
      case 'drop': y = -1300 * (1 - e); r = (1 - p) * 8; break;
      case 'rise': y = 1300 * (1 - e); break;
      default: break;
    }
    const seed = +el.dataset.seed, step = Math.floor(t * 8), amp = +el.dataset.boil;
    const jr = (hash(seed, step) - 0.5) * 2 * amp, jx = (hash(seed + 1, step) - 0.5) * 4 * amp, jy = (hash(seed + 2, step) - 0.5) * 4 * amp;
    el.style.transform = 'translate(' + (x + jx).toFixed(1) + 'px,' + (y + jy).toFixed(1) + 'px) rotate(' + (+el.dataset.rot + r + jr).toFixed(2) + 'deg) scale(' + s.toFixed(3) + ')';
  }

  window.__seek = (t) => {
    let caption = '';
    data.scenes.forEach((sc, i) => {
      const el = scenes[i];
      const on = t >= sc.start && t < sc.end;
      el.style.display = on ? 'block' : 'none';
      if (!on) return;
      // Entrees en stop motion (12 images/s), comptees depuis le debut de la
      // scene : arrondir t lui-meme laissait une image vide a chaque changement.
      const local = Math.floor((t - sc.start) * 12 + 1e-6) / 12;
      el.querySelectorAll('.fx').forEach((f) => place(f, local, t));
      const chunk = sc.captionChunks.find((c) => t >= c.start && t < c.end);
      if (chunk) {
        caps.style.top = sc.captionTop + 'px';
        caption = chunk.words.map((w) => '<span' + (t >= w.start && t < w.end ? ' class="on"' : '') + '>' + w.text.replace(/[<&]/g, '') + '</span>').join('');
      }
    });
    document.querySelectorAll('#decor .fx').forEach((f) => place(f, 1, t));
    if (caption !== lastCaption) { caps.innerHTML = caption; lastCaption = caption; }
    caps.style.display = caption ? 'block' : 'none';
  };
  // Mise en page une fois les polices chargees : les elements "follow" se
  // posent sous leur reference (les scenes sont rendues visibles le temps de mesurer).
  window.__ready = document.fonts.ready.then(() => {
    scenes.forEach((s) => { s.style.display = 'block'; });
    document.querySelectorAll('[data-follow]').forEach((el) => {
      const ref = document.getElementById(el.dataset.follow);
      if (ref) el.style.top = (ref.offsetTop + ref.offsetHeight + Number(el.dataset.gap || 0)) + 'px';
    });
    scenes.forEach((s) => { s.style.display = 'none'; });
    return true;
  });
})();
`;

/** Pur (a la graine pres) : page HTML complete de la video. */
export function buildFacelessHtml(timeline) {
  seedCounter = 1;
  const scenesHtml = timeline.scenes.map((scene) => {
    const layout = LAYOUTS[scene.layout] || LAYOUTS.avatar;
    return `<section class="scene">${layout(scene)}</section>`;
  }).join('\n');

  const runtimeData = {
    // Sous le mot geant pour "word", sur le buste pour "avatar" (seules mises en page sous-titrees).
    scenes: timeline.scenes.map((s) => ({
      start: s.start, end: s.end, captionChunks: s.captionChunks || [], captionTop: s.layout === 'word' ? 840 : 1400,
    })),
  };

  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>${CSS}</style></head><body>`
    + `<div id="paper"></div><div id="decor">${decorLayer()}</div>${scenesHtml}<div id="captions"></div>`
    + `<script type="application/json" id="timeline">${JSON.stringify(runtimeData).replace(/</g, '\\u003c')}</script>`
    + `<script>${RUNTIME}</script></body></html>`;
}
