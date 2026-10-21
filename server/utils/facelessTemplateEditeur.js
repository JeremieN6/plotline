/**
 * Modele visuel "Editeur" (DA C de Claude Design, docs/faceless-design-brief) : le propos s affiche comme
 * du code dans un editeur sombre (lignes numerotees, coloration, frappe au fil de la voix), un terminal
 * pour un mot cle, un diff pour une comparaison chiffree ; une phrase de conclusion sous le panneau ;
 * l avatar dans une bulle ronde, comme une vignette de camera.
 * Le code vient du champ de scene "code" (ecrit par Claude), sinon il est deduit du texte.
 */

import { compareWidths, esc, parseCountable, revealTimes, revealUnits } from './facelessTemplateFenetre.js';

const PANEL_X = 90;
const PANEL_W = 900;
const TOP = 440;
// Largeur utile du code : panneau - padding (2 x 34) - numeros (60) - liseré et marges.
const CODE_W = PANEL_W - 68 - 60 - 40;
const PANEL = '#171a26';
const ACTIVE = '#262b44';

// Couleurs de role de la coloration (fixes) ; la "fonction" prend la couleur de surbrillance de la DA.
const ROLE = { kw: '#b79cff', str: '#ffd166', num: '#ff7a6e', com: '#8b91ab', id: '#e6e8f2', punct: '#e6e8f2' };
const KEYWORDS = new Set(['const', 'let', 'var', 'return', 'if', 'else', 'await', 'async', 'function', 'new', 'true', 'false', 'null', 'import', 'from', 'export', 'for', 'of', 'while']);

const noMarks = (text) => String(text ?? '').replace(/\*\*/g, '');

/** Pur : decoupe une ligne de pseudo-code en jetons colores : [{ t, v }]. */
export function tokenizeCode(line) {
  const tokens = [];
  const src = String(line ?? '');
  let i = 0;
  while (i < src.length) {
    const rest = src.slice(i);
    let m;
    if ((m = /^\/\/.*$/.exec(rest)) || (m = /^#.*$/.exec(rest))) tokens.push({ t: 'com', v: m[0] });
    else if ((m = /^"[^"]*"?|^'[^']*'?/.exec(rest))) tokens.push({ t: 'str', v: m[0] });
    else if ((m = /^\d+(?:[.,]\d+)?/.exec(rest))) tokens.push({ t: 'num', v: m[0] });
    else if ((m = /^[A-Za-zÀ-ÿ_$][\wÀ-ÿ$]*/.exec(rest))) {
      const after = src.slice(i + m[0].length).trimStart();
      tokens.push({ t: KEYWORDS.has(m[0]) ? 'kw' : (after.startsWith('(') ? 'fn' : 'id'), v: m[0] });
    } else if ((m = /^\s+/.exec(rest))) tokens.push({ t: 'punct', v: m[0] });
    else {
      m = [rest[0]];
      tokens.push({ t: 'punct', v: rest[0] });
    }
    i += m[0].length;
  }
  // Jetons voisins de meme role fusionnes (moins de balises).
  return tokens.reduce((out, tok) => {
    const last = out[out.length - 1];
    if (last && last.t === tok.t && tok.t === 'punct') last.v += tok.v;
    else out.push({ ...tok });
    return out;
  }, []);
}

/** Pur : premier groupe **mot cle** d un texte, ou ''. */
function keywordOf(text) {
  return /\*\*(.+?)\*\*/.exec(String(text || ''))?.[1]?.trim() || '';
}

/**
 * Pur : code affiche pour une scene : celui ecrit par Claude, sinon deduit du texte
 * (un commentaire avec le titre, puis le mot cle en chaine).
 */
export function codeLinesFor(scene, max = 6) {
  const given = (scene.code || []).map((line) => String(line)).filter((line) => line.trim());
  if (given.length) return given.slice(0, max);
  const lines = [];
  if (scene.title) lines.push(`// ${noMarks(scene.title).toLowerCase()}`);
  const kw = keywordOf(scene.text) || scene.word || noMarks(scene.text).split(/\s+/).slice(0, 3).join(' ');
  if (kw) lines.push(`const idee = "${kw}";`);
  return lines.slice(0, max);
}

/** Pur : indice de la ligne a surligner : celle qui contient le mot cle, sinon la derniere ligne utile. */
export function activeLineIndex(lines, keyword) {
  const key = String(keyword || '').toLowerCase();
  if (key) {
    const hit = lines.findIndex((line) => line.toLowerCase().includes(key));
    if (hit >= 0) return hit;
  }
  for (let i = lines.length - 1; i >= 0; i -= 1) if (/[\w"']/.test(lines[i]) && !/^\s*\/\//.test(lines[i])) return i;
  return lines.length - 1;
}

/**
 * Pur : debut de frappe (s, local a la scene) de chaque ligne et vitesse (caracteres/s) : les lignes se
 * tapent a la suite a partir de 0,35 s, au moins 28 caracteres/s, plus vite si le code doit finir avant
 * les 60 % de la voix de la scene. `cues[i]` (facultatif) : une ligne ne commence pas avant son repere.
 */
export function typingSchedule(lines, scene, cues = []) {
  const voice = Math.max(1, Number(scene?.voiceEnd ?? 0) - Number(scene?.voiceStart ?? 0));
  const chars = lines.reduce((sum, line) => sum + line.length, 0);
  const cps = Math.max(28, Math.ceil(chars / (voice * 0.6)));
  let cursor = 0.35;
  const starts = lines.map((line, i) => {
    const start = Math.max(cursor, Number.isFinite(cues[i]) ? cues[i] : 0);
    cursor = start + line.length / cps + 0.08;
    return Number(start.toFixed(3));
  });
  return { starts, cps, end: cursor };
}

function codeHtml(ctx, lines, { starts, cps }, active) {
  const accent = ctx.style.palette.accent;
  return lines.map((line, i) => {
    const html = tokenizeCode(line).map((tok) => `<span style="color:${tok.t === 'fn' ? accent : ROLE[tok.t]}">${esc(tok.v)}</span>`).join('');
    const next = starts[i + 1];
    const hl = i === active ? ` data-hl-a="${PANEL}" data-hl-b="${ACTIVE}" data-hl-from="${starts[i]}"` : '';
    const bar = i === active ? `<span class="lbar" data-hl-a="${PANEL}" data-hl-b="${accent}" data-hl-from="${starts[i]}"></span>` : '<span class="lbar"></span>';
    return `<div class="cl"${hl}>${bar}<span class="ln">${i + 1}</span><span class="cw">`
      + `<span class="typed" data-type-at="${starts[i]}" data-type-cps="${cps}" data-type-len="${line.length}" style="width:${line.length}ch">${html || ' '}</span>`
      + `<span class="cursor" data-cur-from="${starts[i]}"${next != null ? ` data-cur-until="${next}"` : ''}></span></span></div>`;
  }).join('');
}

/** Panneau d editeur (onglet + code). */
function panel(ctx, { id, tab, inner, y = TOP, fit = true }) {
  // Une ligne trop longue reduit tout le code : rien n est jamais coupe a droite du panneau.
  const html = `<div class="panel"><div class="ptab"><span class="pdot"></span><span>${esc(tab)}</span></div><div class="pbody"${fit ? ` data-fit-w="${PANEL_W - 4}"` : ''}>${inner}</div></div>`;
  return ctx.fx(html, { x: PANEL_X, y, w: PANEL_W, enter: 'rise-panel', fixedEnter: true, rot: 0, boil: 0, z: 2, id });
}

/** Phrase de conclusion (Sora 800), mot par mot ; le mot cle prend une couleur. */
function phrase(ctx, scene, text, { follow, gap = 70, y = TOP, size = 88, kwColor, start, center = false } = {}) {
  if (!String(text || '').trim()) return '';
  const voice = Math.max(1, Number(scene.voiceEnd ?? 0) - Number(scene.voiceStart ?? 0));
  const units = revealUnits(text);
  const times = revealTimes(units, scene, { start: start ?? Math.min(1.2, voice * 0.4) });
  const html = units.map((unit, i) => (unit.br ? '<br>'
    : `<span class="wd${unit.kw ? ' kw' : ''}" data-enter="blur-up" data-at="${times[i]}" data-rot="0" data-boil="0"${unit.kw ? ` style="color:${kwColor}"` : ''}>${esc(unit.text)}</span>`)).join(' ');
  return ctx.fx(`<div class="concl${center ? ' center' : ''}" data-fit-h="${Math.round(size * 1.08 * 3)}" style="font-size:${size}px">${html}</div>`, {
    x: PANEL_X, y, w: PANEL_W, enter: 'instant', fixedEnter: true, rot: 0, boil: 0, z: 3, follow, gap,
  });
}

/** Avatar dans une bulle ronde (anneau de couleur et lueur) ; la pose change en coupe. */
function bubble(ctx, scene, { follow, gap = -120, y = 0, size = 480, cx = 540, id } = {}) {
  const settings = scene.avatar || {};
  if (settings.hidden) return '';
  const beats = scene.beats?.length ? scene.beats : [{ at: 0, expr: settings.expr || 'neutral' }];
  const box = { x: Math.round(cx - size / 2), y, w: size, h: size, fixedEnter: true, rot: 0, boil: 0, follow, gap };
  const ring = ctx.fx('<div class="ring"></div>', { ...box, enter: 'bubble', z: 7, id });
  const images = beats.map((beat, i) => {
    const until = i + 1 < beats.length ? beats[i + 1].at : undefined;
    const visual = ctx.avatarVisual(beat, settings);
    const flip = beat.flip ?? settings.flip ?? false;
    return ctx.fx(`<div class="bub"><div class="avatar m-${visual.mode}${flip ? ' flip' : ''}">${visual.html}</div></div>`, {
      ...box, enter: i === 0 ? 'bubble' : 'instant', at: beat.at, until, z: 6,
    });
  }).join('');
  return ring + images;
}

/** Terminal : une commande tapee puis un mot en tres grand, curseur clignotant. */
function terminal(ctx, scene, { command, word, y, id }) {
  const cmd = `$ ${command}`;
  const cps = 28;
  const html = '<div class="panel term"><div class="ptab"><span class="pdot"></span><span>terminal</span></div><div class="pbody">'
    + `<div class="cmd"><span class="typed" data-type-at="${at(scene, 0.3)}" data-type-cps="${Math.max(cps, Math.ceil(cmd.length / (0.6 * pace(scene))))}" data-type-len="${cmd.length}" style="width:${cmd.length}ch">${esc(cmd)}</span></div>`
    + `<div class="tword"><span class="prompt">›</span><span class="giant wd" data-enter="giant-soft" data-at="${at(scene, 0.95)}" data-rot="0" data-boil="0" data-fit-w="${CODE_W - 40}">${esc(word)}</span>`
    + `<span class="bigcur" data-cur-from="${at(scene, 1.3)}"></span></div></div></div>`;
  return ctx.fx(html, { x: PANEL_X, y, w: PANEL_W, enter: 'rise-panel', fixedEnter: true, rot: 0, boil: 0, z: 2, id });
}

/** Pur : facteur de rythme : une scene de moins de 3 s resserre les reperes fixes (sinon le mot geant ou le chiffre arriverait apres la fin). */
export const pace = (scene) => Math.max(0.3, Math.min(1, (Number(scene?.end ?? 3) - Number(scene?.start ?? 0)) / 3));
const at = (scene, value) => (value * pace(scene)).toFixed(2);

const slug = (text, fallback) => {
  const s = noMarks(text).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
    .split(' ').filter(Boolean).slice(0, 2).map((w, i) => (i ? w[0].toUpperCase() + w.slice(1) : w)).join('');
  return s.slice(0, 16) || fallback;
};

const LAYOUTS = {
  // Accroche : le propos en code, puis la phrase (mot cle en couleur secondaire).
  hook(scene, ctx) {
    const lines = codeLinesFor(scene, 6);
    const kw = keywordOf(scene.text);
    const schedule = typingSchedule(lines, scene);
    const id = `p${ctx.seed()}`;
    return panel(ctx, { id, tab: scene.tab || 'idee.js', inner: codeHtml(ctx, lines, schedule, activeLineIndex(lines, kw)) })
      + phrase(ctx, scene, scene.text, { follow: id, kwColor: ctx.style.palette.accent2 });
  },
  // Chapitre : un peu de code, l avatar dans sa bulle qui chevauche le panneau, la phrase dessous.
  title(scene, ctx) {
    const lines = codeLinesFor(scene, 3);
    const schedule = typingSchedule(lines, scene);
    const id = `p${ctx.seed()}`;
    const bid = `b${ctx.seed()}`;
    return panel(ctx, { id, tab: scene.tab || 'solution.js', inner: codeHtml(ctx, lines, schedule, activeLineIndex(lines, keywordOf(scene.text))) })
      // La bulle chevauche le bas du panneau, a droite, sans cacher le code (lignes courtes a gauche).
      + bubble(ctx, scene, { follow: id, id: bid, size: 420, cx: 790, gap: -40 })
      + phrase(ctx, scene, scene.text || scene.title, { follow: bid, gap: 40, kwColor: ctx.style.palette.accent });
  },
  // Liste : un tableau dont chaque element se tape sur son mot ; la ligne dite est surlignee.
  list(scene, ctx) {
    const items = (scene.items || []).slice(0, 4);
    const lines = [`const ${slug(scene.title, 'liste')} = [`, ...items.map((item) => `  "${noMarks(item.text)}",`), '];'];
    const cues = [0, ...items.map((item) => item.at), items.length ? items[items.length - 1].at + 0.2 : 0];
    const schedule = typingSchedule(lines, scene, cues);
    const accent = ctx.style.palette.accent;
    // Chaque element est surligne de son repere au repere suivant.
    let inner = codeHtml(ctx, lines, schedule, -1);
    items.forEach((item, i) => {
      const from = schedule.starts[i + 1];
      const until = schedule.starts[i + 2];
      inner = inner.replace(`<div class="cl"><span class="lbar"></span><span class="ln">${i + 2}</span>`,
        `<div class="cl" data-hl-a="${PANEL}" data-hl-b="${ACTIVE}" data-hl-from="${from}"${i + 1 < items.length ? ` data-hl-until="${until}"` : ''}>`
        + `<span class="lbar" data-hl-a="${PANEL}" data-hl-b="${accent}" data-hl-from="${from}"${i + 1 < items.length ? ` data-hl-until="${until}"` : ''}></span><span class="ln">${i + 2}</span>`);
    });
    const id = `p${ctx.seed()}`;
    return panel(ctx, { id, tab: scene.tab || `${slug(scene.title, 'liste')}.js`, inner })
      + phrase(ctx, scene, scene.title || '', { follow: id, kwColor: accent, start: 0.3 });
  },
  // Mot cle : un terminal, une commande tapee puis le mot en tres grand.
  word(scene, ctx) {
    const id = `t${ctx.seed()}`;
    return terminal(ctx, scene, { id, command: (scene.code || [])[0]?.replace(/^\$\s*/, '') || 'expliquer --mot', word: scene.word, y: 560 })
      + phrase(ctx, scene, scene.text || '', { follow: id, kwColor: ctx.style.palette.accent, start: 1.4 });
  },
  // Chiffre cle : un diff avant / apres, des barres, le chiffre en tres grand avec un compteur.
  stat(scene, ctx) {
    const compare = (scene.compare || []).slice(0, 3);
    const accent = ctx.style.palette.accent;
    const parts = [];
    const diffId = `d${ctx.seed()}`;
    const barsId = `r${ctx.seed()}`;
    if (compare.length >= 2) {
      const last = compare.length - 1;
      const rows = compare.map((row, i) => {
        const plus = i === last;
        return `<div class="drow wd ${plus ? 'plus' : 'minus'}" data-enter="row-in" data-at="${at(scene, 0.35 + i * 0.3)}" data-rot="0" data-boil="0">`
          + `<span class="dsign">${plus ? '+' : '−'}</span><span class="dlabel">${esc(row.label)}</span><span class="dval">${esc(row.value)}</span></div>`;
      }).join('');
      parts.push(panel(ctx, { id: diffId, tab: scene.tab || 'perf.diff', inner: `<div class="diff">${rows}</div>`, fit: false }));
      const widths = compareWidths(compare) || compare.map(() => 100);
      const bars = compare.map((row, i) => `<div class="dbar ${i === last ? 'plus' : 'minus'}" data-bar-w="${widths[i]}" data-bar-at="${at(scene, 0.9 + i * 0.15)}"></div>`).join('');
      parts.push(ctx.fx(`<div class="dbars">${bars}</div>`, { x: PANEL_X, y: TOP, w: PANEL_W, enter: 'instant', fixedEnter: true, rot: 0, boil: 0, follow: diffId, gap: 60, id: barsId }));
    }
    const c = parseCountable(scene.word);
    const count = c ? ` data-count-at="${at(scene, 1.2)}" data-count-to="${c.number}" data-count-dec="${c.decimals}" data-count-pre="${esc(c.prefix)}" data-count-suf="${esc(c.suffix)}"` : '';
    const big = `<div class="statbox"><span class="snum wd" data-enter="giant-soft" data-at="${at(scene, 1.1)}" data-rot="0" data-boil="0" data-fit-w="${PANEL_W}" style="color:${accent}"${count}>${esc(scene.word)}</span>`
      + (scene.text ? `<div class="scom wd" data-enter="fade-in" data-at="${at(scene, 1.9)}" data-rot="0" data-boil="0">${esc(noMarks(scene.text))}</div>` : '') + '</div>';
    parts.push(ctx.fx(big, { x: PANEL_X, y: compare.length >= 2 ? TOP : 640, w: PANEL_W, enter: 'instant', fixedEnter: true, rot: 0, boil: 0, follow: compare.length >= 2 ? barsId : undefined, gap: 50 }));
    return parts.join('');
  },
  // Appel a l action : la phrase en grand, l avatar dans sa bulle dessous.
  avatar(scene, ctx) {
    const id = `c${ctx.seed()}`;
    const text = scene.text || '';
    return (text ? ctx.fx(`<div class="concl center" data-fit-h="420" style="font-size:96px">${phraseWords(scene, text, ctx.style.palette.accent)}</div>`, {
      x: PANEL_X, y: 520, w: PANEL_W, enter: 'instant', fixedEnter: true, rot: 0, boil: 0, z: 3, id,
    }) : '')
      + bubble(ctx, scene, { follow: text ? id : undefined, y: 760, gap: 80, size: 560, cx: 540 });
  },
  // Une illustration du dossier dans le panneau (onglet = nom de fichier).
  photo(scene, ctx) {
    const entry = ctx.illustrations[scene.image];
    if (!entry) return LAYOUTS.avatar({ ...scene, text: scene.text || scene.title || '' }, ctx);
    const id = `p${ctx.seed()}`;
    return panel(ctx, { id, tab: scene.tab || 'apercu.png', inner: `<img class="shot" alt="" src="${ctx.illustrationUrl(scene.image)}">`, fit: false })
      + phrase(ctx, scene, scene.text || '', { follow: id, kwColor: ctx.style.palette.accent, start: 0.4 });
  },
  // Nom d un outil : "$ open <nom>" puis le nom en tres grand.
  logo(scene, ctx) {
    return terminal(ctx, scene, { id: `t${ctx.seed()}`, command: `open ${slug(scene.word, 'outil').toLowerCase()}`, word: scene.word, y: 600 });
  },
};

function phraseWords(scene, text, kwColor) {
  const units = revealUnits(text);
  const times = revealTimes(units, scene, { start: 0.3 });
  return units.map((unit, i) => (unit.br ? '<br>'
    : `<span class="wd${unit.kw ? ' kw' : ''}" data-enter="blur-up" data-at="${times[i]}" data-rot="0" data-boil="0"${unit.kw ? ` style="color:${kwColor}"` : ''}>${esc(unit.text)}</span>`)).join(' ');
}

/** HTML d une scene pour le modele Editeur. */
export function editeurScene(scene, ctx) {
  const layout = LAYOUTS[scene.layout] || LAYOUTS.avatar;
  return layout(scene, ctx);
}

/** Feuille de style du modele Editeur. */
export function editeurCss(style, { fontFamily, monoFamily, emojiFonts }) {
  const p = style.palette;
  const glow = `${p.accent}55`;
  return `
:root{--accent:${p.accent};--accent2:${p.accent2};--text:${p.text}}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1080px;height:1920px;overflow:hidden}
body{background:${p.background};font-family:"${fontFamily}",${emojiFonts},sans-serif;color:var(--text)}
.scene{position:absolute;inset:0;display:none}
.scene.bg-main{--bgc:${p.background}}
.scene.bg-alt{--bgc:${p.backgroundAlt}}
.scene.bg-dark{--bgc:${p.dark}}
/* Lueur radiale qui oscille lentement (centre x = 80 % + 4 % sin(2 pi t / 8)). */
.bg{position:absolute;inset:0;background-color:var(--bgc);background-image:radial-gradient(900px 700px at 80% 12%,#1b1f33,transparent);background-image:radial-gradient(900px 700px at calc(80% + 4% * sin(calc(var(--t, 0) * 0.7854rad))) 12%,#1b1f33,transparent)}
.fx{position:absolute;transform-origin:50% 50%;visibility:hidden}
.wd{display:inline-block;visibility:hidden;transform-origin:50% 60%}
.panel{background:${PANEL};border:2px solid #2c3249;border-radius:30px;box-shadow:0 40px 90px rgba(0,0,0,.45);overflow:hidden}
.ptab{height:88px;background:#12141f;display:flex;align-items:center;gap:16px;padding:0 34px;font-family:"${monoFamily}",monospace;font-size:28px;color:#8b91ab;border-bottom:2px solid #2c3249}
.pdot{width:16px;height:16px;border-radius:50%;background:var(--accent)}
.pbody{padding:30px 0 34px;font-size:58px}
.cl{position:relative;display:flex;align-items:center;font-family:"${monoFamily}",monospace;font-size:1em;line-height:1.62;padding:0 34px 0 0;white-space:pre}
.lbar{width:8px;align-self:stretch;margin-right:26px;background:${PANEL}}
.ln{width:60px;flex:0 0 60px;text-align:right;margin-right:34px;font-size:.62em;color:#6a7192}
.cw{display:inline-flex;align-items:center}
.typed{display:inline-block;overflow:hidden;white-space:pre;vertical-align:top}
.cursor{display:inline-block;width:.58em;height:1.1em;background:var(--accent);visibility:hidden}
.concl{font-weight:800;line-height:1.05;letter-spacing:-.03em;color:var(--text)}
.concl.center{text-align:center}
.term .pbody{padding:44px 44px 54px}
.cmd{font-family:"${monoFamily}",monospace;font-size:44px;color:#8b91ab;white-space:pre}
.tword{display:flex;align-items:center;gap:22px;margin-top:30px}
.prompt{font-family:"${monoFamily}",monospace;font-size:120px;font-weight:800;color:#b79cff}
.giant{font-size:236px;font-weight:800;letter-spacing:-9px;line-height:1;color:var(--accent);white-space:nowrap}
.bigcur{display:inline-block;width:38px;height:190px;background:var(--accent);visibility:hidden}
.diff{display:flex;flex-direction:column}
.drow{display:flex;align-items:center;gap:22px;padding:16px 34px;font-family:"${monoFamily}",monospace;font-size:48px;white-space:nowrap}
.drow.minus{background:rgba(255,122,110,.14);color:#ff7a6e}
.drow.plus{background:rgba(110,231,183,.14);color:#6ee7b7}
.dlabel{flex:1}
.dbars{display:flex;flex-direction:column;gap:22px}
.dbar{height:30px;width:0;border-radius:8px}
.dbar.minus{background:#ff7a6e}.dbar.plus{background:#6ee7b7}
.statbox{display:flex;flex-direction:column;gap:18px}
.snum{font-size:236px;font-weight:800;letter-spacing:-9px;line-height:1;white-space:nowrap}
.scom{font-family:"${monoFamily}",monospace;font-size:30px;color:#8b91ab}
.shot{display:block;width:100%;height:720px;object-fit:cover;margin-top:-30px}
.ring{width:100%;height:100%;border-radius:50%;border:10px solid var(--accent);box-shadow:0 0 120px ${glow}, inset 0 0 40px ${glow}}
.bub{width:100%;height:100%;border-radius:50%;overflow:hidden;background:#1b1f33}
.avatar{width:100%;height:100%}
.avatar.flip{transform:scaleX(-1)}
.avatar-img{width:100%;height:100%;object-fit:cover;object-position:center 12%;display:block}
#captions{position:absolute;left:70px;width:860px;top:170px;z-index:20;display:none;justify-content:center;white-space:nowrap}
#captions .cap-in{display:inline-flex;align-items:center;background:${PANEL};border:2px solid #2c3249;border-radius:22px;padding:20px 38px}
#captions .cap-in::before{content:">";font-family:"${monoFamily}",monospace;font-size:54px;font-weight:800;color:var(--accent);margin-right:18px}
#captions span{display:inline-block;margin:0 8px;font-family:"${monoFamily}",monospace;font-size:54px;font-weight:800;color:#e6e8f2}
/* Le segment se tape a la vitesse de la voix : un mot pas encore dit n est pas affiche (l etiquette s allonge). */
#captions span:not(.on):not(.past){display:none}
`;
}

/** Haut des sous-titres du modele Editeur (etiquette sombre avec invite ">"). */
export const EDITEUR_CAPTION_TOP = 170;
