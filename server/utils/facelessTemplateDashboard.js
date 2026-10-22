/**
 * Modele visuel "Dashboard" (DA G de Claude Design, docs/faceless-design-brief) : une interface produit claire.
 * Fond gris froid, cartes blanches, pastilles de statut, un graphique qui se construit sous les yeux, des chiffres
 * qui comptent. Pour les SaaS, le business, la finance, les chiffres.
 *
 * Les donnees du graphique viennent UNIQUEMENT du plan (champ "series" ou "compare", donc du script) : rien n est
 * invente. Sans au moins deux valeurs chiffrees, il n y a pas de graphique, seulement le chiffre.
 * Rouge et vert ne servent qu au sens (baisse / hausse) et sont toujours doubles d un mot ou d une fleche.
 */

import { esc, parseCountable, revealTimes, revealUnits, spokenAt } from './facelessTemplateFenetre.js';
import { pace } from './facelessTemplateEditeur.js';

const X = 96;
const W = 888;
const PAD = 48;
const TOP = 420;
const GAP = 28;
const INNER_W = W - PAD * 2; // 792

const C = {
  line: '#e2e5ec', ink: '#0f172a', gray: '#64748b', indigoSoft: '#eef2ff', red: '#d92d20', green: '#067647',
  redSoft: '#fee4e2', redInk: '#b42318', greenSoft: '#d1fadf',
};

/** Teinte douce de l accent (mele a du blanc) : pastilles et fonds d icone suivent la couleur de la DA. */
const softTint = (hex, ratio = 0.9) => {
  const n = Number.parseInt(String(hex).replace('#', ''), 16);
  const mix = (c) => Math.round(c + (255 - c) * ratio);
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => mix(c).toString(16).padStart(2, '0')).join('')}`;
};
const accentRgba = (hex, alpha) => {
  const n = Number.parseInt(String(hex).replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
};

const noMarks = (text) => String(text ?? '').replace(/\*\*/g, '');

const ICONS = {
  trend: '<polyline points="3,7 9,13 13,9 21,17"/><polyline points="15,17 21,17 21,11"/>',
  chat: '<path d="M4 5h16v11H9l-5 4z"/>',
  doc: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><line x1="9" y1="9" x2="15" y2="9"/><line x1="9" y1="13" x2="15" y2="13"/>',
  cross: '<line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>',
};
const ICON_CYCLE = ['trend', 'chat', 'doc'];

function icon(name, size = 52) {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ICONS.doc}</svg>`;
}

/** Pur : sens d une valeur ("en baisse", "+12 %", "stables") : 'down', 'up' ou 'flat'. */
export function trendOf(text) {
  const t = String(text || '').toLowerCase();
  if (/(baisse|chute|perd|perte|recul|diminu|↓|↘|−\s?\d|(^|\s)-\s?\d)/.test(t)) return 'down';
  if (/(hausse|gagn|croiss|augment|gain|↑|↗|\+\s?\d)/.test(t)) return 'up';
  return 'flat';
}

/** Pur : couleur de la pastille d un texte : 'alert' (rouge), 'good' (vert) ou 'neutral'. */
export function pillTone(text) {
  const t = String(text || '').toLowerCase();
  if (/(alerte|danger|urgent|erreur|baisse|chute|perd|perte|recul|critique)/.test(t)) return 'alert';
  if (/(hausse|gagn|croiss|gain|économ|économie|réduit|↓|↑|\+\s?\d|−\s?\d)/.test(t)) return 'good';
  return 'neutral';
}

/**
 * Pur : les valeurs a tracer { label, value } : "series" du plan (jusqu a 8), sinon "compare" ;
 * null s il y a moins de deux valeurs chiffrees.
 */
export function seriesFor(scene) {
  const read = (list) => (Array.isArray(list) ? list : [])
    .map((row) => ({ label: String(row?.label ?? ''), value: parseCountable(row?.value)?.number }))
    .filter((row) => Number.isFinite(row.value));
  const series = read(scene?.series);
  if (series.length >= 2) return series.slice(0, 8);
  const compare = read(scene?.compare);
  return compare.length >= 2 ? compare.slice(0, 8) : null;
}

/**
 * Pur : geometrie d une courbe dans un cadre w x h : points, ligne et aire. La plus grande valeur est en haut ;
 * des valeurs egales donnent une droite au milieu.
 */
export function chartGeometry(values, { w = INNER_W, h = 360, padX = 16, padTop = 36, padBottom = 36 } = {}) {
  const n = values.length;
  if (n < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;
  const points = values.map((value, i) => ({
    x: Number((padX + (i * (w - padX * 2)) / (n - 1)).toFixed(1)),
    y: Number((span === 0 ? h / 2 : padTop + ((max - value) / span) * (h - padTop - padBottom)).toFixed(1)),
  }));
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' ');
  return { points, line, area: `${line} L${points[n - 1].x},${h} L${points[0].x},${h} Z`, w, h };
}

/** Courbe de remplissage decorative d une carte (mini graphique), sans donnees : plate, qui baisse ou qui monte. */
function sparkPath(trend) {
  if (trend === 'down') return 'M2,10 L120,22 L240,34 L358,52';
  if (trend === 'up') return 'M2,52 L120,38 L240,26 L358,8';
  return 'M2,32 L90,30 L180,34 L270,31 L358,33';
}

function spark(trend, at) {
  const color = trend === 'down' ? C.red : (trend === 'up' ? C.green : C.gray);
  return `<svg class="spark" viewBox="0 0 360 60" width="100%" height="60"><path d="${sparkPath(trend)}" fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1" data-dash-at="${at}" data-dash-dur="0.8"/></svg>`;
}

function pill(text, at, tone = pillTone(text)) {
  return `<span class="pill ${tone} wd" data-enter="pill" data-at="${at}" data-rot="0" data-boil="0">${esc(text)}</span>`;
}

/** Titre de carte : mots qui apparaissent sur la voix, le mot cle passe du gris a l accent quand il est dit. */
function heading(ctx, scene, text, { size = 122, start = 0.2, maxH = 520 } = {}) {
  if (!String(text || '').trim()) return '';
  const units = revealUnits(text);
  const times = revealTimes(units, scene, { start, waitKeyword: false });
  const gray = C.gray;
  const accent = ctx.style.palette.accent;
  const html = units.map((unit, i) => {
    if (unit.br) return '<br>';
    if (!unit.kw) return `<span class="wd" data-enter="word-rise" data-at="${times[i]}" data-rot="0" data-boil="0">${esc(unit.text)}</span>`;
    const said = spokenAt(unit.text, scene);
    const inkAt = said != null && said - 0.1 > times[i] ? said - 0.1 : times[i] + 0.3;
    return `<span class="wd kw" data-enter="word-rise" data-at="${times[i]}" data-rot="0" data-boil="0" data-ink-a="${gray}" data-ink-b="${accent}" data-ink-at="${inkAt.toFixed(3)}">${esc(unit.text)}</span>`;
  }).join(' ');
  return `<div class="gh" data-fit-w="${INNER_W}" data-fit-h="${maxH}" style="font-size:${size}px">${html}</div>`;
}

const label = (text) => (text ? `<div class="lab">${esc(noMarks(text))}</div>` : '');

/** Une carte blanche animee ; `follow` la pose sous une autre carte. */
function cardFx(ctx, { inner, at = 0, id, follow, y = TOP, gap = GAP, cls = '', attrs = '', enter = 'card', w = W, x = X }) {
  const html = `<div class="gcard ${cls}"${attrs}>${inner}</div>`;
  return ctx.fx(html, { x, y, w, enter, fixedEnter: true, at, rot: 0, boil: 0, z: 3, id, follow, gap });
}

/** Avatar illustre, en bas a droite, DEVANT les cartes : un buste monte du bas de l ecran, une tete a le bas fondu. */
function avatar(ctx, scene) {
  if (ctx.noAvatar) return '';
  const settings = scene.avatar || {};
  if (settings.hidden) return '';
  const beats = scene.beats?.length ? scene.beats : [{ at: 0, expr: settings.expr || 'neutral' }];
  return beats.map((beat, i) => {
    const until = i + 1 < beats.length ? beats[i + 1].at : undefined;
    const visual = ctx.avatarVisual(beat, settings);
    const flip = beat.flip ?? settings.flip ?? false;
    const body = visual.mode === 'body';
    const w = body ? 440 : 480;
    const h = Math.round(w * (body ? 580 / 420 : 320 / 340));
    return ctx.fx(`<div class="avatar m-${visual.mode}${flip ? ' flip' : ''}">${visual.html}</div>`, {
      x: 1080 - 50 - w, y: (body ? 1920 : 1860) - h, w, h,
      enter: i === 0 ? 'rise-soft' : 'instant', fixedEnter: true, at: i === 0 ? 0.15 : beat.at, until, rot: 0, boil: 0, z: 6,
    });
  }).join('');
}

/** Courbe animee : aire (clip de gauche a droite), trait (se dessine), points (apparaissent), halo sur le dernier. */
function chart(values, accent, { at = 0.5, dur = 1.2, h = 360 } = {}) {
  const g = chartGeometry(values, { h });
  if (!g) return '';
  const grid = [0.2, 0.4, 0.6, 0.8].map((f) => `<line x1="0" y1="${(g.h * f).toFixed(0)}" x2="${g.w}" y2="${(g.h * f).toFixed(0)}" stroke="${C.line}" stroke-width="2"/>`).join('');
  const dots = g.points.map((p, i) => {
    const t = at + dur * (i / (g.points.length - 1));
    return `<circle class="dot" cx="${p.x}" cy="${p.y}" r="9" fill="#fff" stroke="${accent}" stroke-width="5" data-pop-at="${t.toFixed(2)}"/>`;
  }).join('');
  const last = g.points[g.points.length - 1];
  return `<svg class="chart" viewBox="0 0 ${g.w} ${g.h}" width="100%">${grid}`
    + `<path d="${g.area}" fill="${accent}" fill-opacity=".10" data-clip-at="${at}" data-clip-dur="${dur}"/>`
    + `<path d="${g.line}" fill="none" stroke="${accent}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1" data-dash-at="${at}" data-dash-dur="${dur}" data-dash-ease="inout"/>`
    + `${dots}<circle cx="${last.x}" cy="${last.y}" r="0" fill="${accent}" fill-opacity=".22" data-halo-at="${(at + dur).toFixed(2)}"/></svg>`;
}

const LAYOUTS = {
  // Accroche : une carte-titre avec sa pastille, puis (si l on a deux comparaisons) deux petites cartes de metriques.
  hook(scene, ctx) {
    const k = pace(scene);
    const id = `c${ctx.seed()}`;
    const minis = (scene.compare || []).slice(0, 2).map((row, i) => {
      const trend = trendOf(row.value);
      const arrow = trend === 'down' && !/[↓↘]/.test(row.value) ? '↓ ' : (trend === 'up' && !/[↑↗]/.test(row.value) ? '↑ ' : '');
      return `<div class="gcard mini wd" data-enter="card" data-at="${((0.35 + i * 0.12) * k).toFixed(2)}" data-rot="0" data-boil="0">`
        + `${label(row.label)}<div class="mval ${trend}">${arrow}${esc(row.value)}</div>${spark(trend, ((0.6 + i * 0.12) * k).toFixed(2))}</div>`;
    }).join('');
    const inner = `${scene.tab ? `<div class="prow">${pill(scene.tab, (0.15 * k).toFixed(2))}</div>` : ''}${heading(ctx, scene, scene.text, { size: 122, maxH: 560 })}`;
    return cardFx(ctx, { inner, id })
      + (minis ? ctx.fx(`<div class="minis">${minis}</div>`, { x: X, y: TOP, w: W, enter: 'instant', fixedEnter: true, rot: 0, boil: 0, z: 3, follow: id, gap: GAP }) : '');
  },
  // Chapitre : une carte (libelle + phrase), une notification, l avatar devant.
  title(scene, ctx) {
    const id = `c${ctx.seed()}`;
    const inner = `${label(scene.title)}${heading(ctx, scene, scene.text || scene.title, { size: 110, maxH: 440 })}`;
    const toast = scene.tab
      ? cardFx(ctx, { inner: `<div class="toast"><span class="ic danger">${icon('cross', 40)}</span><span class="toast-t">${esc(scene.tab)}</span></div>`, follow: id, gap: 56, w: 640, at: 0.7 * pace(scene), cls: 'small' })
      : '';
    return cardFx(ctx, { inner, id }) + toast + avatar(ctx, scene);
  },
  // Liste : un libelle, puis une carte par element (icone, titre, sous-ligne) ; la carte dite prend le trait de l accent.
  list(scene, ctx) {
    const items = (scene.items || []).slice(0, 4);
    const accent = ctx.style.palette.accent;
    const head = ctx.fx(label(scene.title || ''), { x: X, y: TOP, w: W, enter: 'fade-in', fixedEnter: true, rot: 0, boil: 0, z: 3, id: `l${ctx.seed()}` });
    const headId = /id="(l\d+)"/.exec(head)?.[1];
    let previous = headId;
    const cards = items.map((item, i) => {
      const next = items[i + 1];
      const id = `c${ctx.seed()}`;
      const at = Math.min(item.at, Math.max(0.2, Number(scene.end ?? 3) - Number(scene.start ?? 0) - 0.45));
      const from = at.toFixed(2);
      const until = next ? ` data-hl-until="${Math.min(next.at, at + 4).toFixed(2)}"` : '';
      const hl = (prop, a, b) => ` data-hl-prop="${prop}" data-hl-a="${a}" data-hl-b="${b}" data-hl-from="${from}"${until}`;
      const inner = `<span class="ic" ${hl('backgroundColor', softTint(accent), accent)}><span class="ico" ${hl('color', accent, '#ffffff')}>${icon(ICON_CYCLE[i % ICON_CYCLE.length])}</span></span>`
        + `<span class="itxt"><span class="it">${esc(noMarks(item.text))}</span>${item.sub ? `<span class="is">${esc(noMarks(item.sub))}</span>` : ''}</span>`;
      const html = cardFx(ctx, { inner, at, id, follow: previous, gap: i === 0 ? 30 : 24, cls: 'row', enter: 'alert-in', attrs: hl('borderColor', C.line, accent) });
      previous = id;
      return html;
    }).join('');
    return head + cards;
  },
  // Mot cle : une carte avec son libelle, le mot en tres grand et une courbe decorative.
  word(scene, ctx) {
    const k = pace(scene);
    const line = '<svg class="deco" viewBox="0 0 792 60" width="100%" height="60"><path d="M4,18 C120,18 200,40 330,36 C460,32 560,46 788,42" fill="none" stroke="' + ctx.style.palette.accent + '" stroke-width="6" stroke-linecap="round" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1" data-dash-at="'
      + `${(0.5 * k).toFixed(2)}" data-dash-dur="0.9" data-dash-ease="inout"/></svg>`;
    const inner = `${label(scene.title || 'À retenir')}<div class="giant wd" data-enter="giant-soft" data-at="${(0.15 * k).toFixed(2)}" data-rot="0" data-boil="0" data-fit-w="${INNER_W}">${esc(scene.word)}</div>${line}`;
    return cardFx(ctx, { inner, y: 600 });
  },
  // Chiffre cle : une carte-graphique (libelle, chiffre qui compte, pastille, courbe), puis avant / apres.
  stat(scene, ctx) {
    const k = pace(scene);
    const accent = ctx.style.palette.accent;
    const id = `c${ctx.seed()}`;
    const compare = (scene.compare || []).slice(0, 3);
    const target = parseCountable(scene.word);
    const first = parseCountable(compare[0]?.value);
    const from = target && first && first.prefix === target.prefix && first.suffix === target.suffix ? first.number : 0;
    const count = target
      ? ` data-count-at="${(0.4 * k).toFixed(2)}" data-count-dur="${(1.2 * Math.max(0.5, k)).toFixed(2)}" data-count-from="${from}" data-count-to="${target.number}" data-count-dec="${target.decimals}" data-count-pre="${esc(target.prefix)}" data-count-suf="${esc(target.suffix)}"`
      : '';
    const series = seriesFor(scene);
    // Le chiffre cede la place a la pastille : largeur estimee de la pastille (texte + point + marges).
    const keyWidth = INNER_W - (scene.text ? Math.min(400, String(scene.text).length * 18 + 110) + 24 : 0);
    const labels = series ? `<div class="xl">${series.map((p) => `<span>${esc(p.label)}</span>`).join('')}</div>` : '';
    const inner = `${label(scene.title)}<div class="krow"><span class="key wd" data-enter="word-rise" data-at="${(0.2 * k).toFixed(2)}" data-rot="0" data-boil="0" data-fit-w="${keyWidth}"${count}>${esc(scene.word)}</span>`
      + `${scene.text ? pill(noMarks(scene.text), (1.0 * k).toFixed(2)) : ''}</div>${series ? chart(series.map((p) => p.value), accent, { at: 0.5 * k, dur: 1.2 * Math.max(0.5, k) }) + labels : ''}`;
    const cards = compare.length >= 2 ? [compare[0], compare[compare.length - 1]] : [];
    const minis = cards.map((row, i) => {
      const last = i === cards.length - 1;
      return `<div class="gcard mini ba wd${last ? ' now' : ''}" data-enter="card" data-at="${((1.2 + i * 0.12) * k).toFixed(2)}" data-rot="0" data-boil="0">${label(row.label)}<div class="bval${last ? ' now' : ''}" data-fit-w="356">${esc(row.value)}</div></div>`;
    }).join('');
    return cardFx(ctx, { inner, id, cls: 'chartcard' })
      + (minis ? ctx.fx(`<div class="minis">${minis}</div>`, { x: X, y: TOP, w: W, enter: 'instant', fixedEnter: true, rot: 0, boil: 0, z: 3, follow: id, gap: 36 }) : '');
  },
  // Appel a l action : une carte-titre, l avatar devant.
  avatar(scene, ctx) {
    return cardFx(ctx, { inner: heading(ctx, scene, scene.text || '', { size: 110, maxH: 460 }), y: 520 }) + avatar(ctx, scene);
  },
  // Une illustration du dossier dans une carte.
  photo(scene, ctx) {
    const entry = ctx.illustrations[scene.image];
    if (!entry) return LAYOUTS.avatar({ ...scene, text: scene.text || scene.title || '' }, ctx);
    const inner = `${label(scene.title)}<img class="pimg" alt="" src="${ctx.illustrationUrl(scene.image)}">${scene.text ? `<div class="pcap">${esc(noMarks(scene.text))}</div>` : ''}`;
    return cardFx(ctx, { inner, y: 480, w: W });
  },
  // Nom d un outil ou d une marque : une carte avec son icone et son nom.
  logo(scene, ctx) {
    const inner = `<div class="logo-row"><span class="logo-emoji">${esc(scene.emoji || '✨')}</span><span class="giant wd" data-enter="giant-soft" data-at="0.2" data-rot="0" data-boil="0" data-fit-w="${INNER_W - 160}" style="font-size:150px">${esc(scene.word)}</span></div>`;
    return cardFx(ctx, { inner, y: 700 });
  },
};

/** Fond de la scene : papier gris froid, bleu nuit pour l appel a l action si le plan le demande. */
export function dashboardBg(scene) {
  return scene.bg === 'dark' ? 'dark' : 'main';
}

/** HTML d une scene pour le modele Dashboard. */
export function dashboardScene(scene, ctx) {
  const layout = LAYOUTS[scene.layout] || LAYOUTS.avatar;
  return layout(scene, ctx);
}

/** Feuille de style du modele Dashboard. */
export function dashboardCss(style, { fontFamily, monoFamily, emojiFonts }) {
  const p = style.palette;
  const a = p.accent;
  return `
:root{--accent:${a};--ink:${C.ink};--gray:${C.gray};--line:${C.line}}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1080px;height:1920px;overflow:hidden}
body{background:${p.background};font-family:"${fontFamily}",${emojiFonts},sans-serif;color:var(--ink)}
.scene{position:absolute;inset:0;display:none}
.scene.bg-main{--bgc:${p.background}}
.scene.bg-alt{--bgc:${p.backgroundAlt}}
.scene.bg-dark{--bgc:${p.dark}}
.bg{position:absolute;inset:0;background-color:var(--bgc)}
.fx{position:absolute;transform-origin:50% 50%;visibility:hidden}
.wd{display:inline-block;visibility:hidden;transform-origin:50% 60%}
.gcard{background:#fff;border:3px solid var(--line);border-radius:36px;padding:44px ${PAD}px 48px;box-shadow:0 24px 50px rgba(15,23,42,.08)}
.gcard.wd{display:block}
.gcard.small{padding:26px 36px;border-radius:28px}
.gcard.row{display:flex;align-items:center;gap:30px;padding:30px 36px}
.gcard.mini{flex:1;padding:36px 36px 30px;border-radius:30px}
.minis{display:flex;gap:32px;width:100%}
.minis .gcard{width:428px;flex:0 0 428px}
.lab{font-family:"${monoFamily}",monospace;font-size:26px;font-weight:500;letter-spacing:.06em;text-transform:uppercase;color:var(--gray);margin-bottom:22px}
.gh{font-weight:700;letter-spacing:-.035em;line-height:1.04;color:var(--ink)}
.gh .kw{color:var(--gray)}
.prow{margin-bottom:26px}
.pill{white-space:nowrap;flex:0 0 auto;display:inline-flex;align-items:center;gap:12px;border-radius:999px;padding:10px 26px;font-size:30px;font-weight:600;line-height:1.1}
.pill::before{content:"";width:12px;height:12px;border-radius:50%;background:currentColor}
.pill.alert{background:${C.redSoft};color:${C.redInk}}
.pill.good{background:${C.greenSoft};color:${C.green}}
.pill.neutral{background:${softTint(a)};color:var(--accent)}
.mval{font-size:52px;font-weight:700;letter-spacing:-.03em;line-height:1.05;margin-bottom:14px}
.mval.down{color:${C.red}}.mval.up{color:${C.green}}
.spark{display:block}
.ic{display:inline-flex;align-items:center;justify-content:center;width:104px;height:104px;border-radius:26px;background:${softTint(a)};flex:0 0 auto}
.ico{display:inline-flex;color:var(--accent)}
.ic.danger{width:76px;height:76px;border-radius:20px;background:${C.redSoft};color:${C.red}}
.toast{display:flex;align-items:center;gap:26px}
.toast-t{font-size:44px;font-weight:600;letter-spacing:-.02em}
.itxt{display:flex;flex-direction:column;gap:6px;min-width:0}
.it{font-size:62px;font-weight:700;letter-spacing:-.035em;line-height:1.05}
.is{font-size:34px;font-weight:500;color:var(--gray);line-height:1.1}
.giant{font-size:290px;font-weight:700;letter-spacing:-12px;line-height:1;color:var(--accent);white-space:nowrap}
.deco{display:block;margin-top:10px}
.krow{display:flex;align-items:center;justify-content:space-between;gap:24px;margin-bottom:18px}
.key{font-size:150px;font-weight:700;letter-spacing:-.04em;line-height:1;white-space:nowrap}
.chart{display:block;margin-top:6px;overflow:visible}
.dot{transform-box:fill-box;transform-origin:center}
.xl{display:flex;justify-content:space-between;font-family:"${monoFamily}",monospace;font-size:24px;color:var(--gray);margin-top:10px}
.gcard.ba .lab{margin-bottom:12px}
.bval{display:inline-block;white-space:nowrap;font-size:92px;font-weight:700;letter-spacing:-.04em;line-height:1;color:var(--gray)}
.bval.now{color:var(--accent)}
.gcard.ba.now{border-color:var(--accent);box-shadow:0 24px 60px ${accentRgba(a, 0.25)}}
.pimg{display:block;width:100%;height:760px;object-fit:cover;border-radius:22px;background:#ddd}
.pcap{font-size:44px;font-weight:600;letter-spacing:-.02em;margin-top:22px}
.logo-row{display:flex;align-items:center;gap:36px}
.logo-emoji{font-family:${emojiFonts},sans-serif;font-size:130px;line-height:1}
.avatar{width:100%;height:100%}
.avatar.flip{transform:scaleX(-1)}
.avatar-img{width:100%;height:100%;object-fit:contain;object-position:center bottom;display:block}
.m-head .avatar-img{-webkit-mask-image:linear-gradient(to bottom,#000 72%,transparent 98%);mask-image:linear-gradient(to bottom,#000 72%,transparent 98%)}
#captions{position:absolute;left:70px;width:860px;top:190px;z-index:20;display:none;justify-content:center;white-space:nowrap}
#captions .cap-in{display:inline-flex;align-items:center;gap:16px;background:#fff;border-radius:999px;padding:18px 44px;box-shadow:0 10px 30px rgba(15,23,42,.14)}
#captions .cap-in::before{content:"";width:18px;height:18px;border-radius:50%;background:var(--accent);flex:0 0 auto}
#captions span{display:inline-block;margin:0;font-size:54px;font-weight:600;letter-spacing:-.02em;color:var(--ink)}
`;
}

/** Haut des sous-titres du modele Dashboard (pastille blanche a point d accent). */
export const DASHBOARD_CAPTION_TOP = 190;
