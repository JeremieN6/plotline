/**
 * Modele visuel "Hanko" (DA J de Claude Design, docs/faceless-design-brief) : pour un persona anime, fan de
 * cinema japonais. Une affiche : papier creme, grand serif mincho, un disque rouge, un TAMPON (hanko) pour
 * faire claquer un avis, une tier list pour classer. Un seul clin d oeil au Japon par ecran (disque, katakana
 * vertical, tampon), pas de decor : l energie vient du rythme et des tampons, pas des couleurs.
 *
 * Le caractere japonais (katakana de l accroche, tampon du mot cle) vient du champ `jp` du plan ; sans lui,
 * l element n est pas dessine (rien n est invente).
 */

import { esc, revealUnits, spokenAt } from './facelessTemplateFenetre.js';
import { pace } from './facelessTemplateEditeur.js';
import { glueQuotes } from './facelessTemplateHerbier.js';

const X = 96;
const W = 888;
const C = { ink: '#141414', paper: '#f3efe6', cream: '#fffdf7', beige: '#e4ded0', gray: '#6b665b' };

const noMarks = (text) => String(text ?? '').replace(/\*\*/g, '');

/** Pur : lettre de la rangee d une tier list (la sous-ligne si c est S/A/B/C/D, sinon S, A, B, C dans l ordre). */
export function tierLetter(item, index) {
  const given = String(item?.sub ?? '').trim().toUpperCase();
  if (/^[SABCD]$/.test(given)) return given;
  return ['S', 'A', 'B', 'C'][Math.min(index, 3)];
}

/** Pur : couleur de fond de la case de lettre ('accent' pour S, noir pour A, gris au-dela). */
export function tierTone(letter) {
  return letter === 'S' ? 'accent' : (letter === 'A' ? 'ink' : 'gray');
}

/** Pur : hauteur d une rangee de tier list selon leur nombre (300 px au plus, tient au-dessus de la zone du bas). */
export function tierRowHeight(count, top = 640, bottom = 1500, gap = 18) {
  const n = Math.max(1, count);
  return Math.max(150, Math.min(300, Math.floor((bottom - top) / n) - gap));
}

/** Titre : mots qui arrivent sur la voix ; le mot important devient rouge et se souligne quand il est dit. */
function heading(ctx, scene, text, { size = 150, start = 0.1, maxH = 560, top = 480, id, follow, gap = 40, w = W, redKw = true } = {}) {
  if (!String(text || '').trim()) return '';
  const units = glueQuotes(revealUnits(text));
  const count = Math.max(1, units.filter((u) => !u.br).length);
  const step = Math.min(0.2, Math.max(0.08, (Math.max(0.6, Number(scene?.voiceEnd ?? 0) - Number(scene?.voiceStart ?? 0)) * 0.5) / count));
  let k = 0;
  const accent = ctx.style.palette.accent;
  const html = units.map((unit) => {
    if (unit.br) return '<br>';
    const at = Math.max(0, start + k * step);
    k += 1;
    // Sur le disque rouge de l accroche, le mot important reste noir (rouge sur rouge serait invisible).
    if (!unit.kw || !redKw) return `<span class="wd" data-enter="jp-line" data-at="${at.toFixed(2)}" data-rot="0" data-boil="0">${esc(unit.text)}</span>`;
    const said = spokenAt(unit.text, scene);
    const inkAt = said != null && said - 0.1 > at ? said - 0.1 : at + 0.3;
    return `<span class="wd kw" data-enter="jp-line" data-at="${at.toFixed(2)}" data-rot="0" data-boil="0" data-ink-a="${C.ink}" data-ink-b="${accent}" data-ink-at="${inkAt.toFixed(3)}">${esc(unit.text)}<i class="ul" data-sx-at="${inkAt.toFixed(3)}" data-sx-dur="0.25"></i></span>`;
  }).join(' ');
  return ctx.fx(`<div class="hd" data-fit-w="${w}" data-fit-h="${maxH}" style="font-size:${size}px">${html}</div>`, {
    x: X, y: top, w, enter: 'instant', fixedEnter: true, rot: 0, boil: 0, z: 3, id, follow, gap,
  });
}

/** Petite legende au-dessus d un bloc (Zen Kaku, gris). */
const kicker = (ctx, text, { y = 440, center = false } = {}) => (text
  ? ctx.fx(`<div class="kick${center ? ' c' : ''}">${esc(noMarks(text))}</div>`, { x: X, y, w: W, enter: 'fade-in', fixedEnter: true, at: 0.05, rot: 0, boil: 0, z: 3 })
  : '');

/** Tampon (hanko) : carre plein a double filet creme, rotation 8 degres ; frappe a l instant `at` avec un flash du papier. */
function stamp(ctx, text, { x, y, w = 150, h = 150, size = 88, at = 0.4, rot = 8, vertical = false } = {}) {
  if (!String(text || '').trim()) return '';
  const flash = `<div class="flash" data-flash-at="${at.toFixed(2)}"></div>`;
  return flash + ctx.fx(`<div class="stamp${vertical ? ' v' : ''}" style="font-size:${size}px">${esc(text)}</div>`, { x, y, w, h, enter: 'hanko', fixedEnter: true, at, rot, boil: 0, z: 6 });
}

/** Avatar dans le disque rouge de l affiche : le buste depasse un peu du disque. */
function avatarDisc(ctx, scene, { cx = 540, bottom = 1620, d = 540 } = {}) {
  if (ctx.noAvatar) return '';
  const settings = scene.avatar || {};
  if (settings.hidden) return '';
  const beats = scene.beats?.length ? scene.beats : [{ at: 0, expr: settings.expr || 'neutral' }];
  const disc = ctx.fx('<div class="disc"></div>', { x: Math.round(cx - d / 2), y: bottom - d, w: d, h: d, enter: 'hk-disc', fixedEnter: true, data: { pulse: 0.015 }, rot: 0, boil: 0, z: 2 });
  const images = beats.map((beat, i) => {
    const until = i + 1 < beats.length ? beats[i + 1].at : undefined;
    const visual = ctx.avatarVisual(beat, settings);
    const flip = beat.flip ?? settings.flip ?? false;
    const body = visual.mode === 'body';
    const w = body ? 420 : 440;
    const h = Math.round(w * (body ? 580 / 420 : 320 / 340));
    return ctx.fx(`<div class="avatar m-${visual.mode}${flip ? ' flip' : ''}">${visual.html}</div>`, {
      x: Math.round(cx - w / 2), y: bottom + 40 - h, w, h,
      enter: i === 0 ? 'rise-soft' : 'instant', fixedEnter: true, at: i === 0 ? 0.3 : beat.at, until, rot: 0, boil: 0, z: 4,
    });
  }).join('');
  return disc + images;
}

/** Bulle de dialogue : le texte s ecrit a 30 caracteres par seconde, le mot important passe au rouge. */
function bubble(ctx, scene, text) {
  const units = glueQuotes(revealUnits(text));
  const accent = ctx.style.palette.accent;
  let chars = 0;
  const html = units.map((unit) => {
    if (unit.br) return '<br>';
    const at = 0.3 + chars / 30;
    chars += unit.text.length + 1;
    if (!unit.kw) return `<span class="wd" data-enter="instant" data-at="${at.toFixed(2)}" data-rot="0" data-boil="0">${esc(unit.text)}</span>`;
    return `<span class="wd kw" data-enter="instant" data-at="${at.toFixed(2)}" data-rot="0" data-boil="0" style="color:${accent}">${esc(unit.text)}</span>`;
  }).join(' ');
  return ctx.fx(`<div class="bub"><div class="btxt" data-fit-w="${W - 100}" data-fit-h="420">${html}</div></div>`, {
    x: X, y: 440, w: W, enter: 'hk-bubble', fixedEnter: true, cls: 'org-bottom', rot: 0, boil: 0, z: 3,
  });
}

const LAYOUTS = {
  // Accroche : le disque rouge (seul decor), le titre en grand mincho qui passe devant, katakana vertical, legende.
  hook(scene, ctx) {
    const disc = ctx.fx('<div class="disc"></div>', { x: 190, y: 800, w: 700, h: 700, enter: 'hk-disc', fixedEnter: true, data: { pulse: 0.015 }, rot: 0, boil: 0, z: 1 });
    const kana = scene.jp ? ctx.fx(`<div class="kana">${esc(scene.jp)}</div>`, { x: 1080 - 76 - 84, y: 1090, w: 84, enter: 'fade-in', fixedEnter: true, at: 0.4, rot: 0, boil: 0, z: 3 }) : '';
    const foot = scene.tab ? ctx.fx(`<div class="foot"><i></i>${esc(scene.tab)}</div>`, { x: X, y: 1560, w: 600, enter: 'fade-in', fixedEnter: true, at: 0.6, rot: 0, boil: 0, z: 3 }) : '';
    return disc + heading(ctx, scene, scene.text, { size: 150, top: 480, maxH: 640, redKw: false }) + kana + foot;
  },
  // Chapitre et appel a l action : une bulle, puis l avatar dans le disque rouge, un tampon "!" sur le disque.
  title(scene, ctx) {
    return bubble(ctx, scene, scene.text || scene.title || '') + avatarDisc(ctx, scene)
      // Le tampon se pose sur le disque de l avatar : sans avatar, il n aurait rien a tamponner.
      + (ctx.noAvatar ? '' : stamp(ctx, '!', { x: 540 + 140, y: 1620 - 540 - 20, w: 150, h: 150, size: 100, at: 0.6 }));
  },
  avatar(scene, ctx) {
    return LAYOUTS.title({ ...scene, text: scene.text || scene.title || '' }, ctx);
  },
  // Tier list : une rangee par element (lettre S, A, B, C a gauche) ; la rangee entre de gauche a droite sur sa voix.
  list(scene, ctx) {
    const items = (scene.items || []).slice(0, 4);
    const accent = ctx.style.palette.accent;
    const headId = `h${ctx.seed()}`;
    const head = heading(ctx, scene, scene.title || '', { size: 112, top: 470, maxH: 150, id: headId });
    const rowH = tierRowHeight(items.length);
    let previous = headId;
    const rows = items.map((item, i) => {
      const next = items[i + 1];
      const id = `r${ctx.seed()}`;
      const at = Math.min(item.at, Math.max(0.2, Number(scene.end ?? 3) - Number(scene.start ?? 0) - 0.5));
      const from = at.toFixed(2);
      const until = next ? ` data-hl-until="${Math.min(next.at, at + 4).toFixed(2)}"` : '';
      const letter = tierLetter(item, i);
      const tone = tierTone(letter);
      const sub = /^[SABCD]$/i.test(String(item.sub ?? '').trim()) ? '' : item.sub;
      const letterSize = Math.min(170, Math.round(rowH * 0.62));
      const inner = `<span class="tl ${tone}" data-fade-at="${from}" data-fade-from="0.35" data-fade-dur="0.2" style="font-size:${letterSize}px">${letter}</span>`
        + `<span class="tc"><span class="tx wd" data-enter="tier-fall" data-at="${(at + 0.12).toFixed(2)}" data-rot="0" data-boil="0" data-fit-w="${W - 190 - 84 - 40}" data-fit-h="${rowH - 40}">${esc(noMarks(item.text))}</span>`
        + `${sub ? `<span class="ts wd" data-enter="tier-fall" data-at="${(at + 0.2).toFixed(2)}" data-rot="0" data-boil="0">${esc(noMarks(sub))}</span>` : ''}</span>`;
      const html = ctx.fx(`<div class="tr" style="height:${rowH}px" data-hl-prop="borderColor" data-hl-a="${C.ink}" data-hl-b="${accent}" data-hl-from="${from}"${until}>${inner}</div>`,
        { x: X, y: 640, w: W, enter: 'clip-row', fixedEnter: true, at, rot: 0, boil: 0, z: 3, id, follow: previous, gap: i === 0 ? 36 : 18 });
      previous = id;
      return html;
    }).join('');
    return head + rows;
  },
  // Mot cle : le mot en tres grand mincho, soulignement rouge, et un tampon japonais s il y en a un.
  word(scene, ctx) {
    const k = pace(scene);
    const html = `<div class="wrap"><div class="gword wd" data-enter="hk-giant" data-at="${(0.15 * k).toFixed(2)}" data-rot="0" data-boil="0" data-fit-w="${W}">${esc(scene.word)}</div>`
      + `<i class="ul2" data-line-at="${(0.5 * k).toFixed(2)}"></i></div>`;
    return kicker(ctx, scene.title, { y: 640, center: true })
      + ctx.fx(html, { x: X, y: 720, w: W, enter: 'instant', fixedEnter: true, rot: 0, boil: 0, z: 3 })
      + stamp(ctx, scene.jp, { x: 1080 - 96 - 170, y: 520, w: 150, h: 220, size: 78, at: 0.55 * k, vertical: true });
  },
  // Chiffre cle : un grand chiffre mincho rouge, une phrase, puis les valeurs a comparer.
  stat(scene, ctx) {
    const k = pace(scene);
    const rows = (scene.compare || []).slice(0, 3).map((row, i) => `<div class="srow wd" data-enter="jp-line" data-at="${((0.8 + i * 0.2) * k).toFixed(2)}" data-rot="0" data-boil="0"><span class="sl">${esc(row.label)}</span><span class="sv">${esc(row.value)}</span></div>`).join('');
    const html = `<div class="gword wd num" data-enter="hk-giant" data-at="${(0.2 * k).toFixed(2)}" data-rot="0" data-boil="0" data-fit-w="${W}">${esc(scene.word)}</div>${rows ? `<div class="srows">${rows}</div>` : ''}`;
    return kicker(ctx, scene.title, { y: 440 }) + heading(ctx, scene, scene.text || '', { size: 100, top: 500, maxH: 240 }) + ctx.fx(html, { x: X, y: 800, w: W, enter: 'instant', fixedEnter: true, rot: 0, boil: 0, z: 3 });
  },
  // Une illustration du dossier sur une carte d affiche (trait noir, ombre dure), une note en tampon, des pastilles.
  photo(scene, ctx) {
    const entry = ctx.illustrations[scene.image];
    if (!entry) return LAYOUTS.avatar({ ...scene, text: scene.text || scene.title || '' }, ctx);
    const cardId = `p${ctx.seed()}`;
    const card = ctx.fx(`<div class="poster"><img class="pimg" alt="" src="${ctx.illustrationUrl(scene.image)}"></div>`,
      { x: 190, y: 560, w: 700, enter: 'hk-card', fixedEnter: true, at: 0.2, rot: 0, boil: 0, z: 3, id: cardId });
    const pills = (scene.items || []).slice(0, 4).map((item, i, all) => `<span class="pill${i === all.length - 1 ? ' on' : ''} wd" data-enter="pill" data-at="${(0.7 + i * 0.12).toFixed(2)}" data-rot="0" data-boil="0">${esc(noMarks(item.text))}</span>`).join('');
    const pillsFx = pills ? ctx.fx(`<div class="pills">${pills}</div>`, { x: X, y: 1400, w: W, enter: 'instant', fixedEnter: true, rot: 0, boil: 0, z: 3, follow: cardId, gap: 56 }) : '';
    return heading(ctx, scene, scene.text || '', { size: 96, top: 420, maxH: 120 }) + card
      + stamp(ctx, scene.tab, { x: 190 + 700 - 190, y: 1260, w: 220, h: 120, size: 60, at: 0.8, rot: 7 }) + pillsFx;
  },
  // Nom d un produit ou d une marque : le nom en grand mincho, soulignement rouge.
  logo(scene, ctx) {
    const html = `<div class="wrap"><div class="gword wd" data-enter="hk-giant" data-at="0.15" data-rot="0" data-boil="0" data-fit-w="${W}" style="font-size:240px">${esc(scene.word)}</div><i class="ul2" data-line-at="0.5"></i></div>`;
    return ctx.fx(html, { x: X, y: 760, w: W, enter: 'instant', fixedEnter: true, rot: 0, boil: 0, z: 3 });
  },
};

/** HTML d une scene pour le modele Hanko. */
export function hankoScene(scene, ctx) {
  const layout = LAYOUTS[scene.layout] || LAYOUTS.avatar;
  return layout(scene, ctx);
}

/** Feuille de style du modele Hanko. */
export function hankoCss(style, { fontFamily, monoFamily, emojiFonts }) {
  const p = style.palette;
  const a = p.accent;
  return `
:root{--accent:${a};--ink:${C.ink};--muted:${C.gray}}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1080px;height:1920px;overflow:hidden}
body{background:${p.background};font-family:"${fontFamily}",${emojiFonts},serif;color:var(--ink)}
.scene{position:absolute;inset:0;display:none}
.scene.bg-main{--bgc:${p.background}}
.scene.bg-alt{--bgc:${p.backgroundAlt}}
.scene.bg-dark{--bgc:${p.dark};--ink:${C.paper};--muted:#a8a294}
.bg{position:absolute;inset:0;background-color:var(--bgc)}
.fx{position:absolute;transform-origin:50% 50%;visibility:hidden}
.fx.org-bottom{transform-origin:50% 100%}
.wd{display:inline-block;visibility:hidden;transform-origin:50% 60%}
.flash{position:absolute;inset:0;background:${C.cream};opacity:0;z-index:30;pointer-events:none}
.kick{font-family:"${monoFamily}",sans-serif;font-weight:700;font-size:44px;color:var(--muted)}
.kick.c{text-align:center}
.hd{font-family:"${fontFamily}",serif;font-weight:700;line-height:1.1;letter-spacing:-3px;color:var(--ink)}
.hd .kw{position:relative}
.ul{position:absolute;left:0;right:0;bottom:-2px;height:12px;background:var(--accent);transform:scaleX(0);transform-origin:0 50%}
.disc{width:100%;height:100%;border-radius:50%;background:var(--accent)}
.kana{font-family:"${fontFamily}",serif;font-weight:700;font-size:84px;letter-spacing:12px;writing-mode:vertical-rl;text-orientation:upright;color:var(--ink);line-height:1}
.foot{display:flex;align-items:center;gap:16px;font-family:"${monoFamily}",sans-serif;font-weight:700;font-size:34px;color:var(--muted)}
.foot i{display:block;width:30px;height:4px;background:var(--muted)}
.stamp{position:relative;display:flex;align-items:center;justify-content:center;width:100%;height:100%;background:var(--accent);color:${C.cream};font-family:"${fontFamily}",serif;font-weight:700;line-height:1;white-space:nowrap}
.stamp::before{content:"";position:absolute;inset:10px;border:6px solid ${C.cream}}
.stamp::after{content:"";position:absolute;inset:26px;border:3px solid ${C.cream};opacity:.85}
.stamp.v{writing-mode:vertical-rl;text-orientation:upright;letter-spacing:6px}
.bub{position:relative;border:6px solid ${C.ink};border-radius:48px;background:${p.card};padding:44px 52px 48px}
.bub::after{content:"";position:absolute;left:50%;bottom:-34px;width:48px;height:48px;background:${p.card};border-right:6px solid ${C.ink};border-bottom:6px solid ${C.ink};transform:translateX(-50%) rotate(45deg)}
.btxt{font-family:"${fontFamily}",serif;font-weight:700;font-size:96px;line-height:1.12;letter-spacing:-2px;color:${C.ink}}
.tr{display:flex;border:6px solid ${C.ink};background:${p.card};overflow:hidden}
.tl{display:flex;align-items:center;justify-content:center;flex:0 0 190px;font-family:"${fontFamily}",serif;font-weight:700;line-height:1;color:${C.cream};opacity:.35}
.tl.accent{background:var(--accent)}.tl.ink{background:${C.ink}}.tl.gray{background:${C.gray}}
.tc{flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;gap:6px;padding:0 42px}
.tx{font-family:"${monoFamily}",sans-serif;font-weight:900;font-size:56px;line-height:1.1;letter-spacing:-.01em;color:${C.ink}}
.ts{font-family:"${monoFamily}",sans-serif;font-weight:700;font-size:32px;color:var(--muted)}
.wrap{display:flex;flex-direction:column;align-items:center;width:100%}
.gword{font-family:"${fontFamily}",serif;font-weight:700;font-size:310px;line-height:1.05;letter-spacing:-8px;color:var(--ink);white-space:nowrap}
.gword.num{color:var(--accent)}
.ul2{display:block;width:62%;height:16px;background:var(--accent);margin-top:2px;margin-right:30%;transform:scaleX(0);transform-origin:0 50%}
.srows{display:flex;flex-direction:column;margin-top:30px}
.srow{display:flex;justify-content:space-between;align-items:baseline;border-top:6px solid ${C.ink};padding:18px 6px}
.sl{font-family:"${monoFamily}",sans-serif;font-weight:700;font-size:38px;color:var(--muted)}
.sv{font-family:"${fontFamily}",serif;font-weight:700;font-size:96px;letter-spacing:-3px;white-space:nowrap}
.poster{background:${p.backgroundAlt};border:8px solid ${C.ink};box-shadow:22px 22px 0 var(--accent);padding:0}
.pimg{display:block;width:100%;height:780px;object-fit:cover;background:#ddd}
.pills{display:flex;flex-wrap:wrap;gap:14px;justify-content:center}
.pill{font-family:"${monoFamily}",sans-serif;font-weight:700;font-size:36px;padding:10px 30px;border-radius:999px;border:4px solid ${C.ink};background:${p.card};color:${C.ink}}
.pill.on{background:${C.ink};color:${C.cream}}
.avatar{width:100%;height:100%}
.avatar.flip{transform:scaleX(-1)}
.avatar-img{width:100%;height:100%;object-fit:contain;object-position:center bottom;display:block}
.m-head .avatar-img{-webkit-mask-image:linear-gradient(to bottom,#000 72%,transparent 98%);mask-image:linear-gradient(to bottom,#000 72%,transparent 98%)}
#captions{position:absolute;left:70px;width:940px;top:200px;z-index:20;display:none;justify-content:center;white-space:nowrap}
#captions .cap-in{display:inline-flex;align-items:center}
#captions span{display:inline-block;margin:0 10px;font-family:"${fontFamily}",serif;font-weight:700;font-size:76px;letter-spacing:-2px;color:${C.ink}}
#captions span.on{text-decoration:underline;text-decoration-color:var(--accent);text-decoration-thickness:8px;text-underline-offset:10px}
#captions.tone-dark span{color:${C.paper}}
`;
}

/** Haut des sous-titres du modele Hanko (mincho, sans boite). */
export const HANKO_CAPTION_TOP = 200;
