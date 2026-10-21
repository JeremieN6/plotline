/**
 * Modele visuel "Brutal" (DA E de Claude Design, docs/faceless-design-brief) : affiche de stade. Noir, blanc
 * casse, UN seul fluo (sur le mot qui compte), Anton en capitales enormes et serrees, cadre epais qui se
 * trace, coupes franches (stop motion). Rien d arrondi, aucune ombre douce.
 *
 * Meme vocabulaire de mises en page que les autres modeles (hook, title, list, word, stat, avatar, photo,
 * logo). Le mot entre ** devient le bloc fluo ; le layout "word" montre le mot 5 fois, sur fond inverse.
 * Aucun texte ne deborde : taille calculee d apres le nombre de caracteres, puis ajustement au chargement.
 */

import { esc, revealUnits, spokenAt } from './facelessTemplateFenetre.js';
import { pace } from './facelessTemplateEditeur.js';

const W = 888; // largeur utile : marges de 96
const X = 96;
const LINE_HEIGHT = 0.88;
// Largeur moyenne d une lettre Anton en capitales (em) ; legerement majoree pour ne pas deborder.
const CHAR_EM = 0.46;
const INK = '#0a0a0a';
const PAPER = '#f2f2ee';

const noMarks = (text) => String(text ?? '').replace(/\*\*/g, '');

/**
 * Pur : decoupe un texte en lignes d affiche. Un mot cle (**) a toujours sa propre ligne ; les autres mots se
 * regroupent tant que la ligne tient dans `maxChars` caracteres. `\n` force une coupure.
 * Sans mot cle, la ligne la plus longue prend le fluo (l ecran n est jamais sans accent).
 */
export function brutalLines(text, { maxChars = 10, fallbackKeyword = true } = {}) {
  const lines = [];
  let current = '';
  const flush = () => {
    if (current) lines.push({ text: current, kw: false });
    current = '';
  };
  for (const unit of revealUnits(text)) {
    if (unit.br) { flush(); continue; }
    if (unit.kw) {
      flush();
      lines.push({ text: unit.text, kw: true });
      continue;
    }
    const next = current ? `${current} ${unit.text}` : unit.text;
    if (current && next.length > maxChars) { flush(); current = unit.text; } else current = next;
  }
  flush();
  if (fallbackKeyword && lines.length && !lines.some((line) => line.kw)) {
    const longest = lines.reduce((best, line, i) => (line.text.length > lines[best].text.length ? i : best), 0);
    lines[longest].kw = true;
  }
  return lines;
}

/**
 * Pur : taille (px) de chaque ligne : la plus grande qui tient dans `width`, bornee par [minSize, maxSize] ;
 * si la pile est trop haute pour `maxH`, toutes les lignes sont reduites ensemble.
 */
export function layoutLines(lines, { minSize = 130, maxSize = 310, width = W, maxH = 1100 } = {}) {
  const sizes = lines.map((line) => {
    const chars = line.text.length + (line.kw ? 1 : 0);
    return Math.max(minSize, Math.min(maxSize, Math.floor(width / (Math.max(1, chars) * CHAR_EM))));
  });
  const total = sizes.reduce((sum, size) => sum + size * LINE_HEIGHT, 0);
  const factor = total > maxH ? maxH / total : 1;
  return lines.map((line, i) => ({ ...line, size: Math.max(60, Math.floor(sizes[i] * factor)) }));
}

/**
 * Pur : instant (local a la scene) de chaque ligne : sur son premier mot dit (-0,05 s), jamais avant la
 * ligne precedente, et jamais si tard que la scene serait finie.
 */
export function lineTimes(lines, scene, { start = 0.12, step = 0.22 } = {}) {
  const duration = Number(scene?.end ?? 3) - Number(scene?.start ?? 0);
  const cap = Math.max(0.15, duration - 0.35);
  const out = [];
  lines.forEach((line, i) => {
    const said = spokenAt(line.text, scene);
    const floor = i === 0 ? start : out[i - 1] + 0.12;
    const natural = i === 0 ? start : out[i - 1] + step;
    // La ligne attend son mot, mais au plus 0,6 s de plus que son tour : un mot dit tard (ou ailleurs dans la phrase)
    // ne doit pas faire apparaitre le titre apres tout le reste.
    let at = said != null ? Math.max(floor, Math.min(said - 0.05, natural + 0.6)) : natural;
    at = Math.min(at, cap);
    out.push(Number(at.toFixed(3)));
  });
  return out;
}

/** Les 4 cotes se tracent dans le sens horaire (0,3 s) ; fluo sur un ecran sombre, noir sinon. */
function frame(ctx, { dark = false } = {}) {
  const color = dark ? ctx.style.palette.accent : INK;
  const svg = '<svg viewBox="0 0 1080 1920" width="1080" height="1920"><rect x="42" y="42" width="996" height="1836" fill="none" '
    + `stroke="${color}" stroke-width="12" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1" data-dash-at="0" data-dash-dur="0.3"/></svg>`;
  return ctx.fx(svg, { x: 0, y: 0, w: 1080, h: 1920, enter: 'instant', fixedEnter: true, rot: 0, boil: 0, z: 9 });
}

/** Pile de lignes d affiche ; la ligne cle est un bloc fluo qui se deplie 0,06 s avant son mot. */
function stack(ctx, scene, text, { top, maxSize = 310, minSize = 130, maxH = 1100, maxChars = 10, accent = true }) {
  // accent: false : un seul fluo par ecran. Quand le fluo est deja pris ailleurs (rangee active, chiffre), le texte n en porte pas.
  const source = accent ? text : noMarks(text);
  const lines = layoutLines(brutalLines(source, { maxChars, fallbackKeyword: accent }), { minSize, maxSize, maxH });
  if (!lines.length) return '';
  const times = lineTimes(lines, scene);
  const html = lines.map((line, i) => {
    const inner = line.kw
      ? `<i class="flbg" data-sx-at="${Math.max(0, times[i] - 0.06).toFixed(2)}" data-sx-dur="0.18"></i><b>${esc(line.text)}</b>`
      : esc(line.text);
    return `<div class="bl"><span class="lnw wd${line.kw ? ' fl' : ''}" data-enter="wipe" data-at="${times[i]}" data-rot="0" data-boil="0" data-fit-w="${W}" style="font-size:${line.size}px">${inner}</span></div>`;
  }).join('');
  return ctx.fx(`<div class="stack">${html}</div>`, { x: X, y: top, w: W, enter: 'instant', fixedEnter: true, rot: 0, boil: 0, z: 3 });
}

/** Avatar pose directement sur l affiche (sans cadre ni fond), en bas a droite : un buste monte depuis le cadre, une tete seule a le bas fondu. */
function avatarRect(ctx, scene) {
  const settings = scene.avatar || {};
  if (settings.hidden) return '';
  const beats = scene.beats?.length ? scene.beats : [{ at: 0, expr: settings.expr || 'neutral' }];
  return beats.map((beat, i) => {
    const until = i + 1 < beats.length ? beats[i + 1].at : undefined;
    const visual = ctx.avatarVisual(beat, settings);
    const flip = beat.flip ?? settings.flip ?? false;
    const body = visual.mode === 'body';
    const w = body ? 400 : 460;
    const h = Math.round(w * (body ? 580 / 420 : 320 / 340));
    // Le bas touche le cadre (qui est dessine par-dessus) : le personnage est pose sur le bord de l affiche.
    return ctx.fx(`<div class="avatar m-${visual.mode}${flip ? ' flip' : ''}">${visual.html}</div>`, {
      x: 1080 - 96 - w, y: 1872 - h, w, h,
      enter: i === 0 ? 'stamp' : 'instant', fixedEnter: true, at: i === 0 ? 0.1 : beat.at, until, rot: 0, boil: 0, z: 5,
    });
  }).join('');
}

const LAYOUTS = {
  // Accroche : 4 lignes enormes, une en bloc fluo ; la legende en bas vient de l onglet.
  hook(scene, ctx) {
    const legend = scene.tab ? ctx.fx(`<div class="legend">— ${esc(scene.tab)}</div>`, { x: X, y: 1780, w: W, enter: 'instant', fixedEnter: true, rot: 0, boil: 0, z: 3 }) : '';
    return stack(ctx, scene, scene.text, { top: 500, maxSize: 310, minSize: 190, maxH: 1180 }) + legend;
  },
  // Chapitre : la phrase (130 a 210 px), le petit avatar pose directement sur l affiche.
  title(scene, ctx) {
    return stack(ctx, scene, scene.text || scene.title, { top: 460, maxSize: 210, minSize: 130, maxH: 800 }) + avatarRect(ctx, scene);
  },
  // Appel a l action : meme composition que le chapitre.
  avatar(scene, ctx) {
    return stack(ctx, scene, scene.text || '', { top: 460, maxSize: 210, minSize: 130, maxH: 800 }) + avatarRect(ctx, scene);
  },
  // Liste : un titre, puis une rangee par element (numero en frappe, texte), la rangee dite est en fluo.
  list(scene, ctx) {
    const items = (scene.items || []).slice(0, 4);
    const fluo = ctx.style.palette.accent;
    const rows = items.map((item, i) => {
      const next = items[i + 1];
      const at = Math.min(item.at, Math.max(0.15, Number(scene.end ?? 3) - Number(scene.start ?? 0) - 0.4));
      return `<div class="row" data-hl-prop="backgroundColor" data-hl-a="${PAPER}" data-hl-b="${fluo}" data-hl-from="${at.toFixed(2)}"${next ? ` data-hl-until="${Math.min(next.at, at + 3).toFixed(2)}"` : ''}>`
        + `<span class="rn wd" data-enter="stamp" data-at="${at.toFixed(2)}" data-rot="0" data-boil="0">${i + 1}</span>`
        + `<span class="rt wd" data-enter="wipe" data-at="${(at + 0.08).toFixed(2)}" data-rot="0" data-boil="0" data-fit-w="${W - 230}">${esc(noMarks(item.text))}</span></div>`;
    }).join('');
    return stack(ctx, scene, scene.title || '', { top: 440, maxSize: 190, minSize: 110, maxH: 300, maxChars: 14, accent: false })
      + ctx.fx(`<div class="rows" data-fit-h="1020">${rows}</div>`, { x: X, y: 760, w: W, enter: 'instant', fixedEnter: true, rot: 0, boil: 0, z: 3 });
  },
  // Mot cle : 5 fois le mot sur fond inverse (3 contours, 1 plein sur bloc fluo), qui tombent en cascade.
  word(scene, ctx) {
    const word = String(scene.word || '');
    const size = Math.max(90, Math.min(262, Math.floor(W / (Math.max(1, word.length) * CHAR_EM))));
    const k = pace(scene);
    const order = [0.1, 0.18, 0.45, 0.26, 0.34]; // la ligne pleine (3e) tombe en dernier, avec un choc
    const lines = order.map((delay, i) => {
      const solid = i === 2;
      return `<div class="gl${solid ? ' solid' : ' outline'}"><span class="g wd" data-enter="${solid ? 'shock' : 'fall'}" data-at="${(delay * k).toFixed(2)}" data-rot="0" data-boil="0" data-fit-w="${W}" style="font-size:${size}px">${esc(word)}</span></div>`;
    }).join('');
    return ctx.fx(`<div class="gstack">${lines}</div>`, { x: X, y: 560, w: W, enter: 'instant', fixedEnter: true, rot: 0, boil: 0, z: 3 });
  },
  // Chiffre cle : le chiffre sur un bloc fluo, puis une rangee par comparaison.
  stat(scene, ctx) {
    const compare = (scene.compare || []).slice(0, 3);
    const size = Math.max(120, Math.min(360, Math.floor(W / (Math.max(1, String(scene.word || '').length) * CHAR_EM))));
    const rows = compare.map((row, i) => `<div class="srow wd" data-enter="wipe" data-at="${(0.5 + i * 0.25).toFixed(2)}" data-rot="0" data-boil="0">`
      + `<span class="slabel">${esc(row.label)}</span><span class="sval">${esc(row.value)}</span></div>`).join('');
    const num = `<div class="snum"><span class="lnw wd fl" data-enter="wipe" data-at="0.12" data-rot="0" data-boil="0" data-fit-w="${W}" style="font-size:${size}px">`
      + `<i class="flbg" data-sx-at="0.06" data-sx-dur="0.18"></i><b>${esc(scene.word)}</b></span></div>`;
    return stack(ctx, scene, scene.text || scene.title || '', { top: 440, maxSize: 150, minSize: 100, maxH: 330, maxChars: 14, accent: false })
      + ctx.fx(`<div class="statbox">${num}<div class="srows" data-fit-h="620">${rows}</div></div>`, { x: X, y: 820, w: W, enter: 'instant', fixedEnter: true, rot: 0, boil: 0, z: 3 });
  },
  // Une illustration du dossier dans un cadre noir epais.
  photo(scene, ctx) {
    const entry = ctx.illustrations[scene.image];
    if (!entry) return LAYOUTS.avatar({ ...scene, text: scene.text || scene.title || '' }, ctx);
    return stack(ctx, scene, scene.text || '', { top: 440, maxSize: 190, minSize: 110, maxH: 300, maxChars: 14 })
      + ctx.fx(`<img class="pimg" alt="" src="${ctx.illustrationUrl(scene.image)}">`, { x: 190, y: 800, w: 700, enter: 'stamp', fixedEnter: true, at: 0.15, rot: 0, boil: 0, z: 3 });
  },
  // Nom d une marque ou d un outil : le nom en bloc fluo.
  logo(scene, ctx) {
    const size = Math.max(100, Math.min(262, Math.floor(W / (Math.max(1, String(scene.word || '').length) * CHAR_EM))));
    const html = `<div class="snum"><span class="lnw wd fl" data-enter="wipe" data-at="0.12" data-rot="0" data-boil="0" data-fit-w="${W}" style="font-size:${size}px">`
      + `<i class="flbg" data-sx-at="0.06" data-sx-dur="0.18"></i><b>${esc(scene.word)}</b></span></div>`;
    return ctx.fx(html, { x: X, y: 800, w: W, enter: 'instant', fixedEnter: true, rot: 0, boil: 0, z: 3 });
  },
};

/** Fond de la scene : le mot geant est inverse (fond noir), tout le reste est sur papier. */
export function brutalBg(scene) {
  return scene.layout === 'word' ? 'dark' : 'main';
}

/** HTML d une scene pour le modele Brutal (cadre compris). */
export function brutalScene(scene, ctx) {
  const layout = LAYOUTS[scene.layout] || LAYOUTS.avatar;
  return frame(ctx, { dark: brutalBg(scene) === 'dark' }) + layout(scene, ctx);
}

/** Feuille de style du modele Brutal. */
export function brutalCss(style, { fontFamily, monoFamily, emojiFonts }) {
  const p = style.palette;
  const fluo = p.accent;
  return `
:root{--fluo:${fluo};--ink:${INK};--paper:${PAPER}}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1080px;height:1920px;overflow:hidden}
body{background:${p.background};font-family:"${fontFamily}",${emojiFonts},sans-serif;color:var(--ink);text-transform:uppercase}
.scene{position:absolute;inset:0;display:none}
.scene.bg-main{--bgc:${p.background};--fg:${INK}}
.scene.bg-alt{--bgc:${p.backgroundAlt};--fg:${INK}}
.scene.bg-dark{--bgc:${p.dark};--fg:${fluo}}
.bg{position:absolute;inset:0;background-color:var(--bgc)}
.fx{position:absolute;transform-origin:50% 50%;visibility:hidden}
.wd{display:inline-block;visibility:hidden;transform-origin:0 50%}
.stack{width:100%}
.bl{line-height:${LINE_HEIGHT};white-space:nowrap}
.lnw{position:relative;white-space:nowrap;line-height:${LINE_HEIGHT};letter-spacing:-2px;font-weight:400}
.lnw.fl{padding:0 .1em 0 .06em;margin-left:-.06em}
.lnw b{position:relative;font-weight:400}
.flbg{position:absolute;left:0;right:0;top:.04em;bottom:-.02em;background:var(--fluo);transform:scaleX(0);transform-origin:0 50%}
.legend{font-family:"${monoFamily}",monospace;font-size:26px;letter-spacing:1px}
.rows{border-bottom:10px solid var(--ink)}
.row{display:flex;align-items:center;gap:34px;border-top:10px solid var(--ink);padding:14px 10px 14px 6px;background:${PAPER}}
.rn{font-size:230px;line-height:.9;letter-spacing:-2px;flex:0 0 auto;min-width:150px}
.rt{font-size:112px;line-height:.95;letter-spacing:-2px;white-space:nowrap}
.gstack{display:flex;flex-direction:column;align-items:center}
.gl{line-height:${LINE_HEIGHT};text-align:center;white-space:nowrap}
.g{letter-spacing:-2px;line-height:${LINE_HEIGHT};white-space:nowrap;transform-origin:50% 50%}
.gl.outline .g{color:transparent;-webkit-text-stroke:3px var(--fluo)}
.gl.solid .g{color:var(--ink);background:var(--fluo);padding:0 .08em}
.statbox{display:flex;flex-direction:column;gap:34px}
.srows{display:flex;flex-direction:column;border-bottom:10px solid var(--ink)}
.srow{display:flex;align-items:baseline;justify-content:space-between;gap:20px;border-top:10px solid var(--ink);padding:14px 10px;width:100%}
.slabel{font-family:"${monoFamily}",monospace;font-size:34px}
.sval{font-size:130px;line-height:.9;letter-spacing:-2px;white-space:nowrap}
.pimg{display:block;width:100%;height:900px;object-fit:cover;border:12px solid var(--ink);box-shadow:16px 16px 0 var(--fluo);background:#ddd}
.avatar{width:100%;height:100%}
.avatar.flip{transform:scaleX(-1)}
.avatar-img{width:100%;height:100%;object-fit:contain;object-position:center bottom;display:block}
.m-head .avatar-img{-webkit-mask-image:linear-gradient(to bottom,#000 72%,transparent 98%);mask-image:linear-gradient(to bottom,#000 72%,transparent 98%)}
#captions{position:absolute;left:70px;width:860px;top:190px;z-index:20;display:none;justify-content:center;white-space:nowrap}
#captions .cap-in{display:inline-flex;align-items:center;background:var(--ink);padding:6px 28px 2px;box-shadow:10px 10px 0 var(--fluo)}
#captions span{display:inline-block;margin:0 10px;font-size:84px;line-height:1.05;letter-spacing:-1px;color:var(--fluo)}
#captions.tone-dark .cap-in{background:var(--fluo);box-shadow:10px 10px 0 #fff}
#captions.tone-dark span{color:var(--ink)}
`;
}

/** Haut des sous-titres du modele Brutal (etiquette noire a ombre dure fluo). */
export const BRUTAL_CAPTION_TOP = 190;
