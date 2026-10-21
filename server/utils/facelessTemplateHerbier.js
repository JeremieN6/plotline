/**
 * Modele visuel "Herbier" (DA I de Claude Design, docs/faceless-design-brief) : pour un persona produits bio et
 * hair care. Une page d herbier : papier creme, serif doux (DM Serif Display), rameau de feuilles au trait, et une
 * ETIQUETTE DE PRODUIT que l on decrypte ligne par ligne (rouge pour ce qu on evite, vert pour ce qu on cherche).
 * Naturel, rassurant, mais precis : le persona « lit pour toi » les ingredients.
 *
 * Le rouge et le vert ne servent qu a JUGER un ingredient, toujours avec un mot et un signe (croix, coche).
 * Aucun jugement n est invente : il vient du champ `tone` du plan (avoid | good | watch).
 */

import { esc, revealUnits, spokenAt } from './facelessTemplateFenetre.js';
import { pace } from './facelessTemplateEditeur.js';

const X = 96;
const W = 888;
const INNER_W = W - 48;
const C = { forest: '#1f3a2b', sage: '#9db08c', sageSoft: '#dce5d0', terracotta: '#c4623a', green: '#2f7a4b', red: '#b3382c', paper: '#f6f2e8', card: '#fffdf8', line: '#cfc6b0', beige: '#e6dcc8', muted: '#5e7a55', amber: '#f3e3b5' };

const noMarks = (text) => String(text ?? '').replace(/\*\*/g, '');

/** Pur : sens d un ingredient pour la couleur de la ligne : 'avoid' (rouge), 'good' (vert), 'watch' (ambre) ou ''. */
export function toneOf(tone) {
  return ['avoid', 'good', 'watch'].includes(tone) ? tone : '';
}

/** Pur : point d une courbe de Bezier cubique a l instant t (0 a 1). */
function bezier([p0, p1, p2, p3], t) {
  const u = 1 - t;
  return {
    x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
  };
}

/**
 * Pur : geometrie du rameau (cadre w x h) : une tige courbe du bas gauche vers le haut droit, des feuilles
 * alternees de part et d autre, un fruit au bout. Renvoie { stem, leaves: [{ x, y, angle, size }], tip }.
 */
export function branchGeometry({ w = 620, h = 645, leaves = 7 } = {}) {
  const curve = [{ x: w * 0.2, y: h - 8 }, { x: w * 0.26, y: h * 0.62 }, { x: w * 0.52, y: h * 0.36 }, { x: w * 0.9, y: h * 0.1 }];
  const stem = `M${curve[0].x.toFixed(1)},${curve[0].y.toFixed(1)} C${curve[1].x.toFixed(1)},${curve[1].y.toFixed(1)} ${curve[2].x.toFixed(1)},${curve[2].y.toFixed(1)} ${curve[3].x.toFixed(1)},${curve[3].y.toFixed(1)}`;
  const list = [];
  for (let i = 0; i < leaves; i += 1) {
    const t = 0.22 + (0.72 * i) / Math.max(1, leaves - 1);
    const here = bezier(curve, t);
    const ahead = bezier(curve, Math.min(1, t + 0.02));
    const tangent = (Math.atan2(ahead.y - here.y, ahead.x - here.x) * 180) / Math.PI;
    const side = i % 2 === 0 ? -1 : 1;
    list.push({
      x: Number(here.x.toFixed(1)), y: Number(here.y.toFixed(1)),
      angle: Number((tangent + side * 55).toFixed(1)),
      size: Number((1.5 - (i / leaves) * 0.5).toFixed(2)),
    });
  }
  return { stem, leaves: list, tip: { x: Number(curve[3].x.toFixed(1)), y: Number(curve[3].y.toFixed(1)) }, w, h };
}

/** Rameau de feuilles au trait : la tige se dessine (1,2 s), chaque feuille s ouvre depuis la tige, leger balancement. */
function branchSvg(accent, k) {
  const g = branchGeometry();
  const leaf = 'M0,0 C22,-26 74,-26 96,0 C74,26 22,26 0,0 Z';
  const leaves = g.leaves.map((l, i) => {
    const at = ((0.9 + i * 0.12) * k).toFixed(2);
    return `<g transform="translate(${l.x},${l.y}) rotate(${l.angle}) scale(${l.size})"><path class="leafp" d="${leaf}" fill="${C.sage}" stroke="${C.forest}" stroke-width="4" stroke-linejoin="round" `
      + `data-pop-at="${at}" data-pop-dur="0.3" data-pop-c="1.3"/></g>`;
  }).join('');
  return `<svg class="branch" viewBox="0 0 ${g.w} ${g.h}" width="${g.w}" height="${g.h}" data-sway="1.2">`
    + `<path d="${g.stem}" fill="none" stroke="${C.forest}" stroke-width="5" stroke-linecap="round" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1" data-dash-at="${(0.3 * k).toFixed(2)}" data-dash-dur="${(1.2 * Math.max(0.5, k)).toFixed(2)}" data-dash-ease="inout"/>`
    + `${leaves}<circle class="leafp" cx="${g.tip.x}" cy="${g.tip.y}" r="22" fill="${accent}" stroke="${C.forest}" stroke-width="4" data-pop-at="${((0.3 + 1.2) * k).toFixed(2)}" data-pop-dur="0.3" data-pop-c="1.6"/></svg>`;
}

/** Titre : mots qui arrivent sur la voix ; le mot en italique prend la couleur d accent quand il est dit. */
function heading(ctx, scene, text, { size = 128, start = 0.2, maxH = 560, top = 520, id, follow, gap = 40 } = {}) {
  if (!String(text || '').trim()) return '';
  const units = glueQuotes(revealUnits(text));
  const step = Math.min(0.18, Math.max(0.08, (Math.max(0.6, Number(scene?.voiceEnd ?? 0) - Number(scene?.voiceStart ?? 0)) * 0.5) / Math.max(1, units.filter((u) => !u.br).length)));
  let k = 0;
  const accent = ctx.style.palette.accent;
  const html = units.map((unit) => {
    if (unit.br) return '<br>';
    const at = Math.max(0, start + k * step);
    k += 1;
    if (!unit.kw) return `<span class="wd" data-enter="serif-in" data-at="${at.toFixed(2)}" data-rot="0" data-boil="0">${esc(unit.text)}</span>`;
    const said = spokenAt(unit.text, scene);
    const inkAt = said != null && said - 0.1 > at ? said - 0.1 : at + 0.3;
    return `<span class="wd kw" data-enter="serif-in" data-at="${at.toFixed(2)}" data-rot="0" data-boil="0" data-ink-a="${C.forest}" data-ink-b="${accent}" data-ink-at="${inkAt.toFixed(3)}">${esc(unit.text)}</span>`;
  }).join(' ');
  return ctx.fx(`<div class="hd" data-fit-w="${W}" data-fit-h="${maxH}" style="font-size:${size}px">${html}</div>`, {
    x: X, y: top, w: W, enter: 'instant', fixedEnter: true, rot: 0, boil: 0, z: 3, id, follow, gap,
  });
}

/**
 * Pur : les guillemets francais restent colles a leur mot par une espace insecable (jamais « en fin de ligne
 * ni » en debut de ligne) : "«" rejoint le mot suivant, "»" le mot precedent.
 */
export function glueQuotes(units) {
  const out = [];
  for (let i = 0; i < units.length; i += 1) {
    const unit = units[i];
    if (!unit.br && unit.text === '«' && units[i + 1] && !units[i + 1].br) {
      units[i + 1] = { ...units[i + 1], text: `«\u00A0${units[i + 1].text}` };
    } else if (!unit.br && unit.text === '»' && out.length && !out[out.length - 1].br) {
      out[out.length - 1] = { ...out[out.length - 1], text: `${out[out.length - 1].text}\u00A0»` };
    } else out.push(unit);
  }
  return out;
}

const kicker = (ctx, text, y = 440) => (text ? ctx.fx(`<div class="kick">${esc(noMarks(text))}</div>`, { x: X, y, w: W, enter: 'fade-in', fixedEnter: true, at: 0.05, rot: 0, boil: 0, z: 3 }) : '');

/** Avatar dans un disque de sauge (portrait) : le buste depasse un peu du disque, comme sur la maquette. */
function avatarDisc(ctx, scene, { cx = 540, bottom = 1700, d = 520 } = {}) {
  const settings = scene.avatar || {};
  if (settings.hidden) return '';
  const beats = scene.beats?.length ? scene.beats : [{ at: 0, expr: settings.expr || 'neutral' }];
  const disc = ctx.fx('<div class="disc"></div>', { x: Math.round(cx - d / 2), y: bottom - d, w: d, h: d, enter: 'disc', fixedEnter: true, rot: 0, boil: 0, z: 2 });
  const images = beats.map((beat, i) => {
    const until = i + 1 < beats.length ? beats[i + 1].at : undefined;
    const visual = ctx.avatarVisual(beat, settings);
    const flip = beat.flip ?? settings.flip ?? false;
    const body = visual.mode === 'body';
    const w = body ? 400 : 420;
    const h = Math.round(w * (body ? 580 / 420 : 320 / 340));
    return ctx.fx(`<div class="avatar m-${visual.mode}${flip ? ' flip' : ''}">${visual.html}</div>`, {
      x: Math.round(cx - w / 2), y: bottom + 40 - h, w, h,
      enter: i === 0 ? 'rise-soft' : 'instant', fixedEnter: true, at: i === 0 ? 0.3 : beat.at, until, rot: 0, boil: 0, z: 4,
    });
  }).join('');
  return disc + images;
}

const CHECK = '<svg viewBox="0 0 40 40" width="40" height="40" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"><path d="M9,21 L17,29 L31,12" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1" data-dash-at="__AT__" data-dash-dur="0.25"/></svg>';
const CROSS = '<svg viewBox="0 0 40 40" width="40" height="40" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"><path d="M11,11 L29,29 M29,11 L11,29" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1" data-dash-at="__AT__" data-dash-dur="0.25"/></svg>';

const LAYOUTS = {
  // Accroche : un petit libelle, le titre en serif (mot en italique terracotta), le rameau qui pousse en bas a droite.
  hook(scene, ctx) {
    const k = pace(scene);
    const branch = ctx.fx(branchSvg(ctx.style.palette.accent, k), { x: 1080 - 96 - 620 + 40, y: 1230, w: 620, h: 645, enter: 'instant', fixedEnter: true, rot: 0, boil: 0, z: 2 });
    return kicker(ctx, scene.title) + heading(ctx, scene, scene.text, { size: 140, top: 520, maxH: 700 }) + branch;
  },
  // Chapitre : libelle, titre, avatar dans son disque de sauge.
  title(scene, ctx) {
    return kicker(ctx, scene.title) + heading(ctx, scene, scene.text || scene.title, { size: 124, top: 520, maxH: 360 }) + avatarDisc(ctx, scene);
  },
  // Appel a l action : le titre, l avatar dans son disque.
  avatar(scene, ctx) {
    return heading(ctx, scene, scene.text || '', { size: 124, top: 480, maxH: 400 }) + avatarDisc(ctx, scene);
  },
  // Liste : libelle, titre, puis des cartes a case a cocher ; vert pour ce qu on cherche, rouge pour ce qu on evite.
  list(scene, ctx) {
    const items = (scene.items || []).slice(0, 4);
    const accent = ctx.style.palette.accent;
    const headId = `h${ctx.seed()}`;
    const head = kicker(ctx, scene.title ? scene.tab || '' : '') + heading(ctx, scene, scene.title || '', { size: 112, top: 520, maxH: 260, id: headId });
    let previous = headId;
    const cards = items.map((item, i) => {
      const next = items[i + 1];
      const id = `c${ctx.seed()}`;
      const at = Math.min(item.at, Math.max(0.2, Number(scene.end ?? 3) - Number(scene.start ?? 0) - 0.5));
      const from = at.toFixed(2);
      const until = next ? ` data-hl-until="${Math.min(next.at, at + 4).toFixed(2)}"` : '';
      const tone = toneOf(item.tone) || 'good';
      const disc = tone === 'avoid' ? C.red : (tone === 'watch' ? '#b8892b' : C.green);
      const sign = (tone === 'avoid' ? CROSS : CHECK).replace('__AT__', (at + 0.1).toFixed(2));
      const inner = `<span class="chk" style="background:${disc}" data-pop-at="${from}" data-pop-dur="0.2" data-pop-c="1.7">${sign}</span>`
        + `<span class="itx"><span class="it">${esc(noMarks(item.text))}</span>${item.sub ? `<span class="is">${esc(noMarks(item.sub))}</span>` : ''}</span>`;
      const html = ctx.fx(`<div class="card row" data-hl-prop="borderColor" data-hl-a="${C.line}" data-hl-b="${accent}" data-hl-from="${from}"${until}>${inner}</div>`,
        { x: X, y: 800, w: W, enter: 'rise-card', fixedEnter: true, at, rot: 0, boil: 0, z: 3, id, follow: previous, gap: i === 0 ? 36 : 24 });
      previous = id;
      return html;
    }).join('');
    return head + cards;
  },
  // Mot cle : un ingredient en tres grand, un trait terracotta qui se dessine, son nom latin qui se tape.
  word(scene, ctx) {
    const k = pace(scene);
    const accent = ctx.style.palette.accent;
    const latin = String(scene.text || '').replace(/\*\*/g, '').trim();
    const wave = `<svg class="wave" viewBox="0 0 600 30" width="600" height="30"><path d="M4,16 C80,2 130,28 220,16 C320,3 400,28 596,14" fill="none" stroke="${accent}" stroke-width="5" stroke-linecap="round" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1" data-dash-at="${(0.8 * k).toFixed(2)}" data-dash-dur="0.4"/></svg>`;
    const typed = latin ? `<div class="latin"><span class="typed" data-type-at="${(1.3 * k).toFixed(2)}" data-type-cps="40" data-type-len="${latin.length}" style="width:${latin.length}ch">${esc(latin)}</span></div>` : '';
    const html = `<div class="wrap"><div class="gword wd" data-enter="herb-giant" data-at="${(0.15 * k).toFixed(2)}" data-rot="0" data-boil="0" data-fit-w="${W}">${esc(scene.word)}</div>${wave}${typed}</div>`;
    return kicker(ctx, scene.title || 'Ingrédient', 560) + ctx.fx(html, { x: X, y: 640, w: W, enter: 'instant', fixedEnter: true, rot: 0, boil: 0, z: 3 });
  },
  // Etiquette de produit : un trait terracotta balaie la carte de haut en bas ; chaque ingredient est « lu » a son passage.
  label(scene, ctx) {
    const k = pace(scene);
    const rows = (scene.items || []).slice(0, 8);
    const ROW = 84;
    const start = 0.55 * k;
    const speed = 120 / Math.max(0.5, k); // px par seconde (120 px/s a rythme normal)
    const stamp = (i) => start + ((i + 0.5) * ROW) / speed;
    const lines = rows.map((row, i) => {
      const tone = toneOf(row.tone);
      const t = stamp(i);
      const strike = tone === 'avoid' ? `<i class="strike" data-sx-at="${t.toFixed(2)}" data-sx-dur="0.25"></i>` : '';
      const wash = tone === 'good' ? `<i class="wash" data-fade-at="${t.toFixed(2)}" data-fade-dur="0.2"></i>` : '';
      const mark = tone === 'avoid' ? `<span class="dot red" data-pop-at="${(t + 0.05).toFixed(2)}" data-pop-dur="0.2" data-pop-c="1.7"></span>`
        : (tone === 'good' ? `<span class="dot green" data-pop-at="${(t + 0.05).toFixed(2)}" data-pop-dur="0.2" data-pop-c="1.7"></span>` : '');
      return `<div class="il${tone ? ` ${tone}` : ''}">${wash}<span class="iname">${esc(noMarks(row.text))}${strike}</span>${mark}</div>`;
    }).join('');
    const total = rows.length * ROW;
    const scan = `<i class="scan" data-scan-at="${start.toFixed(2)}" data-scan-dur="${(total / speed).toFixed(2)}" data-scan-h="${total}"></i>`;
    const head = `<div class="lh"><span>${esc(noMarks(scene.title || 'Ingrédients'))}</span><span>${esc(scene.tab || '')}</span></div>`;
    const cardId = `c${ctx.seed()}`;
    const card = ctx.fx(`<div class="card label"><div class="lbody">${head}<div class="ils">${lines}${scan}</div></div></div>`,
      { x: X, y: 440, w: W, enter: 'rise-label', fixedEnter: true, rot: 0, boil: 0, z: 3, id: cardId });
    // Pastilles de verdict (une par ingredient juge qui a un mot court), puis le verdict.
    const pills = rows.filter((r) => toneOf(r.tone) && r.sub).map((row, i) => {
      const tone = toneOf(row.tone);
      const idx = rows.indexOf(row);
      const sign = tone === 'avoid' ? '✕' : (tone === 'good' ? '✓' : '!');
      return `<span class="vp ${tone} wd" data-enter="pill" data-at="${(stamp(idx) + 0.2 + i * 0.05).toFixed(2)}" data-rot="0" data-boil="0">${sign} ${esc(noMarks(row.sub))}</span>`;
    }).join('');
    const pillsId = `p${ctx.seed()}`;
    const pillsFx = pills ? ctx.fx(`<div class="vps">${pills}</div>`, { x: X, y: 800, w: W, enter: 'instant', fixedEnter: true, rot: 0, boil: 0, z: 3, follow: cardId, gap: 36, id: pillsId }) : '';
    // Le verdict se pose sous les pastilles (ou sous la carte), une fois la lecture terminee.
    const verdict = scene.text
      ? heading(ctx, scene, scene.text, { size: 84, start: total / speed + start + 0.2, top: 1000, maxH: 200, follow: pills ? pillsId : cardId, gap: 44 })
      : '';
    return card + pillsFx + verdict;
  },
  // Chiffre cle : un grand chiffre serif et une phrase, puis les valeurs a comparer.
  stat(scene, ctx) {
    const k = pace(scene);
    const rows = (scene.compare || []).slice(0, 3).map((row, i) => `<div class="srow wd" data-enter="rise-card" data-at="${((0.8 + i * 0.2) * k).toFixed(2)}" data-rot="0" data-boil="0"><span class="sl">${esc(row.label)}</span><span class="sv">${esc(row.value)}</span></div>`).join('');
    const html = `<div class="gword wd num" data-enter="herb-giant" data-at="${(0.2 * k).toFixed(2)}" data-rot="0" data-boil="0" data-fit-w="${W}">${esc(scene.word)}</div>${rows ? `<div class="srows">${rows}</div>` : ''}`;
    return kicker(ctx, scene.title, 440) + heading(ctx, scene, scene.text || '', { size: 100, top: 520, maxH: 240 }) + ctx.fx(html, { x: X, y: 800, w: W, enter: 'instant', fixedEnter: true, rot: 0, boil: 0, z: 3 });
  },
  // Une illustration du dossier dans une carte, sous le titre.
  photo(scene, ctx) {
    const entry = ctx.illustrations[scene.image];
    if (!entry) return LAYOUTS.avatar({ ...scene, text: scene.text || scene.title || '' }, ctx);
    return heading(ctx, scene, scene.text || '', { size: 100, top: 460, maxH: 240 })
      + ctx.fx(`<div class="card ph"><img class="pimg" alt="" src="${ctx.illustrationUrl(scene.image)}"></div>`, { x: 190, y: 800, w: 700, enter: 'rise-card', fixedEnter: true, at: 0.2, rot: 0, boil: 0, z: 3 });
  },
  // Nom d un produit ou d une marque : le nom en grand serif.
  logo(scene, ctx) {
    const html = `<div class="gword wd" data-enter="herb-giant" data-at="0.15" data-rot="0" data-boil="0" data-fit-w="${W}" style="font-size:240px">${esc(scene.word)}</div>`;
    return ctx.fx(html, { x: X, y: 760, w: W, enter: 'instant', fixedEnter: true, rot: 0, boil: 0, z: 3 });
  },
};

/** HTML d une scene pour le modele Herbier. */
export function herbierScene(scene, ctx) {
  const layout = LAYOUTS[scene.layout] || LAYOUTS.avatar;
  return layout(scene, ctx);
}

/** Feuille de style du modele Herbier. */
export function herbierCss(style, { fontFamily, monoFamily, emojiFonts }) {
  const p = style.palette;
  const a = p.accent;
  return `
:root{--accent:${a};--ink:${C.forest};--muted:${C.muted}}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1080px;height:1920px;overflow:hidden}
body{background:${p.background};font-family:"${fontFamily}",${emojiFonts},serif;color:var(--ink)}
.scene{position:absolute;inset:0;display:none}
.scene.bg-main{--bgc:${p.background}}
.scene.bg-alt{--bgc:${p.backgroundAlt}}
.scene.bg-dark{--bgc:${p.dark};--ink:${C.paper};--muted:${C.sage}}
.bg{position:absolute;inset:0;background-color:var(--bgc)}
.fx{position:absolute;transform-origin:50% 50%;visibility:hidden}
.wd{display:inline-block;visibility:hidden;transform-origin:50% 60%}
.kick{font-family:"${monoFamily}",monospace;font-size:26px;font-weight:500;letter-spacing:5px;text-transform:uppercase;color:var(--muted)}
.hd{font-family:"${fontFamily}",serif;font-weight:400;line-height:1.02;letter-spacing:-3px;color:var(--ink)}
.hd .kw{font-style:italic;color:var(--ink)}
.disc{width:100%;height:100%;border-radius:50%;background:${p.backgroundAlt}}
.branch{display:block;transform-origin:20% 99%;overflow:visible}
.leafp{transform-box:fill-box;transform-origin:0 50%}
.card{background:${p.card};border:4px solid ${C.line};border-radius:30px}
.card.row{display:flex;align-items:center;gap:30px;padding:26px 36px}
.chk{display:inline-flex;align-items:center;justify-content:center;width:78px;height:78px;border-radius:50%;flex:0 0 auto}
.itx{display:flex;flex-direction:column;gap:4px;min-width:0}
.it{font-family:"DM Sans",sans-serif;font-weight:700;font-size:56px;line-height:1.08;letter-spacing:-.01em}
.is{font-family:"DM Sans",sans-serif;font-weight:500;font-size:32px;color:var(--muted)}
.wrap{display:flex;flex-direction:column;align-items:center;width:100%}
.gword{font-family:"${fontFamily}",serif;font-size:440px;line-height:1;letter-spacing:-14px;color:var(--ink);white-space:nowrap}
.gword.num{font-size:300px;color:var(--accent)}
.wave{display:block;margin-top:8px}
.latin{font-family:"${monoFamily}",monospace;font-style:italic;font-size:38px;color:var(--muted);margin-top:26px;letter-spacing:4px}
.typed{display:inline-block;overflow:hidden;white-space:pre;vertical-align:top}
.card.label{border-color:${C.forest};border-width:4px;overflow:hidden}
.lbody{padding:34px 38px 26px}
.lh{display:flex;justify-content:space-between;gap:24px;white-space:nowrap;font-family:"${monoFamily}",monospace;font-size:26px;letter-spacing:5px;text-transform:uppercase;color:var(--muted);padding-bottom:18px;border-bottom:3px solid ${C.line}}
.ils{position:relative}
.il{position:relative;display:flex;align-items:center;justify-content:space-between;height:84px;border-bottom:3px solid ${C.line};font-family:"DM Sans",sans-serif;font-weight:500;font-size:48px;padding:0 6px}
.iname{position:relative;display:inline-block}
.il.avoid{color:${C.red}}
.il.good{font-weight:700}
.strike{position:absolute;left:0;right:0;top:54%;height:4px;background:${C.red};transform:scaleX(0);transform-origin:0 50%}
.wash{position:absolute;left:-6px;right:-6px;top:0;bottom:0;background:${p.backgroundAlt};opacity:0;z-index:0}
.il > *{position:relative;z-index:1}
.il > .wash{position:absolute}
.dot{width:26px;height:26px;border-radius:50%;flex:0 0 auto}
.dot.red{background:${C.red}}.dot.green{background:${C.green}}
.scan{position:absolute;left:0;right:0;top:0;height:4px;background:var(--accent);opacity:0;z-index:2}
.vps{display:flex;flex-wrap:wrap;gap:16px}
.vp{font-family:"DM Sans",sans-serif;font-weight:700;font-size:34px;padding:8px 24px;border-radius:999px}
.vp.avoid{background:#f4d6d1;color:${C.red}}
.vp.good{background:#d6ead9;color:${C.green}}
.vp.watch{background:${C.amber};color:#7a5a12}
.srows{display:flex;flex-direction:column;margin-top:30px}
.srow{display:flex;justify-content:space-between;align-items:baseline;border-top:3px solid ${C.line};padding:18px 6px}
.sl{font-family:"${monoFamily}",monospace;font-size:30px;letter-spacing:4px;text-transform:uppercase;color:var(--muted)}
.sv{font-size:96px;letter-spacing:-3px;white-space:nowrap}
.card.ph{padding:18px}
.pimg{display:block;width:100%;height:760px;object-fit:cover;border-radius:18px;background:#ddd}
.avatar{width:100%;height:100%}
.avatar.flip{transform:scaleX(-1)}
.avatar-img{width:100%;height:100%;object-fit:contain;object-position:center bottom;display:block}
.m-head .avatar-img{-webkit-mask-image:linear-gradient(to bottom,#000 72%,transparent 98%);mask-image:linear-gradient(to bottom,#000 72%,transparent 98%)}
#captions{position:absolute;left:70px;width:860px;top:200px;z-index:20;display:none;justify-content:center;white-space:nowrap}
#captions .cap-in{display:inline-flex;align-items:center;background:${C.beige};border-radius:999px;padding:14px 40px}
#captions span{display:inline-block;margin:0 8px;font-family:"DM Sans",sans-serif;font-weight:500;font-size:46px;letter-spacing:-.01em;color:${C.forest}}
`;
}

/** Haut des sous-titres du modele Herbier (pastille beige, DM Sans). */
export const HERBIER_CAPTION_TOP = 200;
