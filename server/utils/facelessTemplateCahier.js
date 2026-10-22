/**
 * Modele visuel "Cahier" (DA B de Claude Design, docs/faceless-design-brief) : editorial et sobre.
 * Papier quadrille qui derive lentement, une phrase a deux niveaux (mots ordinaires en gris, le mot
 * important en tres grand, qui passe du gris au noir quand la voix le dit), un seul visuel central
 * (cartes, marches en volume, mot souligne). L avatar est un figurant (decision de l utilisateur, 2026-10-20) :
 * petit, en bas a droite, sans socle, et SEULEMENT sur la derniere scene (appel a l action) quand elle n a
 * qu une phrase. Une scene qui n a qu une phrase (accroche, chapitre) la montre en grand, au centre.
 * Aucun texte ne deborde : chaque mot important et chaque bloc ont une taille maximale (data-fit-*).
 */

import { compareWidths, esc, parseCountable, revealTimes, revealUnits, spokenAt } from './facelessTemplateFenetre.js';

// Marges : 96 a gauche, 120 a droite. Texte en haut (y 440), visuel central entre y 930 et 1690.
const X = 96;
const W = 1080 - 96 - 120;
const TOP = 440;
const VISUAL_TOP = 930;
const VISUAL_BOTTOM = 1690;

const HEAD_RATIO = 320 / 340;
const BODY_RATIO = 580 / 420;
const DARK_INK = '#f4f5f1';

const noMarks = (text) => String(text ?? '').replace(/\*\*/g, '');

/**
 * Pur : taille (em) d un mot important, pour que son mot le plus long tienne dans la largeur
 * (environ 0,55 em par caractere en Inter Tight graisse 800) ; l ajustement au chargement fait le reste.
 */
export function keywordEm(text, base, { max = 2.6, width = W } = {}) {
  const longest = Math.max(1, ...String(text || '').split(/\s+/).map((word) => word.length));
  return Number(Math.min(max, width / (longest * 0.56 * base)).toFixed(3));
}

/** Phrase a deux niveaux, mot par mot ; le mot important sur sa propre ligne, en tres grand. */
function statement(ctx, scene, text, { top = TOP, maxH = 440, base = 88, center = false } = {}) {
  if (!String(text || '').trim()) return '';
  const units = revealUnits(text);
  const times = revealTimes(units, scene, { start: 0.1, waitKeyword: false });
  const ink = scene.bg === 'dark' ? DARK_INK : ctx.style.palette.text;
  const gray = ctx.style.palette.accent2;
  const html = units.map((unit, i) => {
    if (unit.br) return '<br>';
    if (!unit.kw) return `<span class="wd" data-enter="blur-soft" data-at="${times[i]}" data-rot="0" data-boil="0">${esc(unit.text)}</span>`;
    const said = spokenAt(unit.text, scene);
    // Le mot apparait dans l ordre de la phrase (gris), puis passe au noir quand la voix le dit.
    const inkAt = said != null && said - 0.1 > times[i] ? said - 0.1 : times[i] + 0.35;
    return `<span class="wd kw" data-enter="blur-big" data-at="${times[i]}" data-rot="0" data-boil="0" data-ink-a="${gray}" data-ink-b="${ink}" data-ink-at="${inkAt.toFixed(3)}" data-fit-w="${W}" style="font-size:${keywordEm(unit.text, base)}em">${esc(unit.text)}</span>`;
  }).join(' ');
  return ctx.fx(`<div class="stmt${center ? ' center' : ''}" data-fit-h="${maxH}" style="font-size:${base}px">${html}</div>`, {
    x: X, y: top, w: W, enter: 'instant', fixedEnter: true, rot: 0, boil: 0, z: 2,
  });
}

/**
 * Petit avatar en bas a droite, sans socle (retire a la demande de l utilisateur) : un buste monte depuis
 * le bas de l ecran, une tete seule a le bas fondu.
 */
function smallAvatar(ctx, scene) {
  if (ctx.noAvatar) return '';
  const settings = scene.avatar || {};
  if (settings.hidden) return '';
  const beats = scene.beats?.length ? scene.beats : [{ at: 0, expr: settings.expr || 'neutral' }];
  const first = ctx.avatarVisual(beats[0], settings);
  // Plus petit que dans les autres modeles : un buste de 500 px de haut, une tete de 320 px de large.
  const width = (mode) => (mode === 'body' ? Math.round(500 / BODY_RATIO) : 320);
  // Ecarte du bord droit (boutons de la plateforme).
  const cx = 1080 - 170 - Math.round(Math.max(width(first.mode), 280) / 2);

  return beats.map((beat, i) => {
    const until = i + 1 < beats.length ? beats[i + 1].at : undefined;
    const visual = i === 0 ? first : ctx.avatarVisual(beat, settings);
    const flip = beat.flip ?? settings.flip ?? false;
    const w = width(visual.mode);
    const h = Math.round(w * (visual.mode === 'body' ? BODY_RATIO : HEAD_RATIO));
    return ctx.fx(`<div class="avatar m-${visual.mode}${flip ? ' flip' : ''}">${visual.html}</div>`, {
      x: Math.round(cx - w / 2), y: (visual.mode === 'body' ? 1940 : VISUAL_BOTTOM) - h, w, h,
      enter: i === 0 ? 'rise-soft' : 'instant', fixedEnter: true, at: i === 0 ? 0.1 : beat.at, until, rot: 0, boil: 0, z: 4,
    });
  }).join('');
}

/** Pur : hauteur (px) des marches, proportionnelle aux valeurs (110 a 620) ; sinon en escalier regulier. */
export function stepHeights(compare, { min = 110, max = 620 } = {}) {
  const widths = compareWidths(compare);
  const n = (compare || []).length;
  if (!widths) return (compare || []).map((_, i) => Math.round(max - ((max - min) * i) / Math.max(1, n - 1)));
  return widths.map((pct) => Math.round(min + ((max - min) * pct) / 100));
}

// Une scene qui n a qu une phrase la montre plus bas et plus grand : c est elle l animation du milieu.
const CENTER_TOP = 640;

/** Le petit avatar n apparait que sur la derniere scene de la video. */
function endAvatar(ctx, scene) {
  return ctx.isLast(scene) ? smallAvatar(ctx, scene) : '';
}

const LAYOUTS = {
  // Accroche : la phrase seule, en grand, au centre de l ecran. Jamais d avatar.
  hook(scene, ctx) {
    return statement(ctx, scene, scene.text, { top: CENTER_TOP, base: 112, maxH: 980 });
  },
  // Chapitre : petit libelle "01 · titre", la phrase, l avatar au centre.
  title(scene, ctx) {
    const label = scene.text && scene.title ? `${scene.number ? `${esc(scene.number)} · ` : ''}${esc(noMarks(scene.title))}` : '';
    const kicker = label ? ctx.fx(`<div class="kicker">${label}</div>`, { x: X, y: CENTER_TOP - 70, w: W, enter: 'fade-in', fixedEnter: true, rot: 0, boil: 0 }) : '';
    return kicker + statement(ctx, scene, scene.text || scene.title, { top: CENTER_TOP, base: 104, maxH: 980 }) + endAvatar(ctx, scene);
  },
  // Liste : la phrase, puis une carte par element ; la carte de l element dit est bordee de l accent.
  list(scene, ctx) {
    const items = scene.items || [];
    const accent = ctx.style.palette.accent;
    const cards = items.map((item, i) => {
      const next = items[i + 1];
      return `<div class="lcard wd" data-enter="rise-soft" data-at="${item.at}" data-rot="0" data-boil="0" data-hl-prop="borderColor" data-hl-a="#ffffff" data-hl-b="${accent}" data-hl-from="${item.at}"${next ? ` data-hl-until="${next.at}"` : ''}>`
        + `<span class="lidx">${String(i + 1).padStart(2, '0')}</span><span class="ltext">${esc(noMarks(item.text))}</span></div>`;
    }).join('');
    return statement(ctx, scene, scene.title || '', { maxH: 440 })
      + ctx.fx(`<div class="lcards" data-fit-h="${VISUAL_BOTTOM - VISUAL_TOP}">${cards}</div>`, { x: X, y: VISUAL_TOP, w: W, enter: 'instant', fixedEnter: true, rot: 0, boil: 0, z: 2 });
  },
  // Un mot en tres grand, souligne de l accent ; la phrase d introduction en gris au-dessus.
  word(scene, ctx) {
    const intro = scene.text ? ctx.fx(`<div class="intro">${esc(noMarks(scene.text))}</div>`, { x: X, y: 620, w: W, enter: 'fade-in', fixedEnter: true, rot: 0, boil: 0 }) : '';
    const html = `<div class="giant-wrap"><span class="giant wd" data-enter="giant-soft" data-at="0.15" data-rot="0" data-boil="0" data-fit-w="${W}">${esc(scene.word)}</span>`
      + '<div class="uline" data-line-at="0.75"></div></div>';
    return intro + ctx.fx(html, { x: X, y: 760, w: W, enter: 'instant', fixedEnter: true, rot: 0, boil: 0, z: 2 });
  },
  // Chiffre cle : avec 2 ou 3 valeurs, des marches qui montent ; sinon le chiffre en tres grand avec un compteur.
  stat(scene, ctx) {
    const compare = scene.compare || [];
    if (compare.length < 2) {
      const c = parseCountable(scene.word);
      const count = c ? ` data-count-at="0.3" data-count-to="${c.number}" data-count-dec="${c.decimals}" data-count-pre="${esc(c.prefix)}" data-count-suf="${esc(c.suffix)}"` : '';
      const html = `<div class="giant-wrap"><span class="giant wd" data-enter="giant-soft" data-at="0.15" data-rot="0" data-boil="0" data-fit-w="${W}"${count}>${esc(scene.word)}</span>`
        + '<div class="uline" data-line-at="0.9"></div></div>';
      return statement(ctx, scene, scene.text || scene.title || '', { maxH: 300 })
        + ctx.fx(html, { x: X, y: 860, w: W, enter: 'instant', fixedEnter: true, rot: 0, boil: 0, z: 2 });
    }
    const heights = stepHeights(compare);
    const last = compare.length - 1;
    const cols = compare.map((row, i) => {
      const flag = i === last
        ? `<div class="flag wd" data-enter="flag" data-at="${(0.5 + last * 0.25 + 0.6).toFixed(2)}" data-rot="0" data-boil="0"><svg viewBox="0 0 80 150" width="80" height="150"><line x1="8" y1="6" x2="8" y2="150" stroke="#111" stroke-width="6" stroke-linecap="round"/><path d="M11 8 L76 26 L11 46 Z" fill="${ctx.style.palette.accent}"/></svg></div>`
        : '';
      return `<div class="scol">${flag}<div class="step" data-grow-h="${heights[i]}" data-grow-at="${(0.5 + i * 0.25).toFixed(2)}">`
        + `<div class="step-label"><span>${esc(row.label)}</span><b>${esc(row.value)}</b></div></div></div>`;
    }).join('');
    return statement(ctx, scene, scene.text || scene.title || scene.word, { maxH: 440 })
      + ctx.fx(`<div class="steps">${cols}</div>`, { x: X, y: VISUAL_TOP, w: W, h: VISUAL_BOTTOM - VISUAL_TOP, enter: 'instant', fixedEnter: true, rot: 0, boil: 0, z: 2 });
  },
  // Phrase seule (souvent l appel a l action) : au centre, en grand ; le petit avatar seulement en fin de video.
  avatar(scene, ctx) {
    return statement(ctx, scene, scene.text || '', { top: CENTER_TOP, base: 104, maxH: 980 }) + endAvatar(ctx, scene);
  },
  // Une illustration du dossier sur une carte blanche, sous la phrase.
  photo(scene, ctx) {
    const entry = ctx.illustrations[scene.image];
    if (!entry) return LAYOUTS.avatar({ ...scene, text: scene.text || scene.title || '' }, ctx);
    const html = `<div class="pcard"><img class="pimg" alt="" src="${ctx.illustrationUrl(scene.image)}"></div>`;
    return statement(ctx, scene, scene.text || '', { maxH: 440 })
      + ctx.fx(html, { x: 190, y: VISUAL_TOP, w: 700, enter: 'rise-soft', fixedEnter: true, at: 0.2, rot: 0, boil: 0, z: 2 });
  },
  // Nom d une marque ou d un outil : icone et nom en tres grand.
  logo(scene, ctx) {
    const html = `<div class="logo-box"><span class="logo-emoji wd" data-enter="giant-soft" data-at="0.1" data-rot="0" data-boil="0">${esc(scene.emoji || '✨')}</span>`
      + `<span class="giant wd" data-enter="blur-big" data-at="0.3" data-rot="0" data-boil="0" data-fit-w="${W}" style="font-size:200px">${esc(scene.word)}</span></div>`;
    return ctx.fx(html, { x: X, y: 640, w: W, enter: 'instant', fixedEnter: true, rot: 0, boil: 0, z: 2 });
  },
};

/** HTML d une scene pour le modele Cahier. */
export function cahierScene(scene, ctx) {
  const layout = LAYOUTS[scene.layout] || LAYOUTS.avatar;
  return layout(scene, ctx);
}

/** Feuille de style du modele Cahier. */
export function cahierCss(style, { fontFamily, monoFamily, emojiFonts }) {
  const p = style.palette;
  return `
:root{--ink:${p.text};--muted:${p.accent2};--accent:${p.accent};--grid:#e2e4dc}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1080px;height:1920px;overflow:hidden}
body{background:${p.background};font-family:"${fontFamily}",${emojiFonts},sans-serif;color:var(--ink)}
.scene{position:absolute;inset:0;display:none}
.scene.bg-main{--bgc:${p.background}}
.scene.bg-alt{--bgc:${p.backgroundAlt}}
.scene.bg-dark{--bgc:${p.dark};--ink:${DARK_INK};--grid:rgba(255,255,255,.07)}
.bg{position:absolute;inset:0;background-color:var(--bgc)}
/* Quadrillage de 48 px qui derive vers le haut (12 px par seconde). */
.bg::before{content:"";position:absolute;inset:0;background-image:linear-gradient(var(--grid) 1.5px,transparent 1.5px),linear-gradient(90deg,var(--grid) 1.5px,transparent 1.5px);background-size:48px 48px;background-position:0 calc(var(--t, 0) * -12px)}
.fx{position:absolute;transform-origin:0 50%;visibility:hidden}
.wd{display:inline-block;visibility:hidden;transform-origin:0 60%}
.stmt{font-weight:700;line-height:1.02;letter-spacing:-.035em;color:var(--muted)}
.stmt.center{text-align:center}
.stmt .kw{display:block;font-weight:800;letter-spacing:-.045em;line-height:.98;margin:.04em 0;white-space:nowrap}
.kicker{font-family:"${monoFamily}",monospace;font-size:30px;color:#6e706a;letter-spacing:.02em}
.intro{font-size:84px;font-weight:700;letter-spacing:-.035em;color:var(--muted);line-height:1.02}
.giant-wrap{position:relative;display:inline-block;max-width:100%}
.giant{font-size:372px;font-weight:800;letter-spacing:-16px;line-height:.92;color:var(--ink);white-space:nowrap}
.uline{height:18px;width:62%;margin-top:22px;background:var(--accent);border-radius:9px;transform-origin:0 50%;transform:scaleX(0)}
.lcards{display:flex;flex-direction:column;gap:26px;font-size:70px}
.lcard{display:flex;align-items:center;gap:30px;background:#fff;border:5px solid #fff;border-radius:28px;padding:28px 36px;box-shadow:0 20px 40px rgba(0,0,0,.07);font-weight:700;letter-spacing:-.03em;line-height:1.05;color:${p.text};visibility:hidden}
.lidx{font-family:"${monoFamily}",monospace;font-size:.43em;color:#6e706a;flex:0 0 auto}
.steps{display:flex;align-items:flex-end;gap:24px;height:100%}
.scol{flex:1;display:flex;flex-direction:column;align-items:flex-start;justify-content:flex-end;height:100%}
.step{width:100%;height:0;background:linear-gradient(180deg,#ffffff,#ececE8);border-radius:10px;box-shadow:20px 20px 0 #dadcd4,0 40px 60px rgba(0,0,0,.08);overflow:hidden}
.step-label{display:flex;flex-direction:column;gap:4px;padding:22px 24px;font-family:"${monoFamily}",monospace;font-size:28px;color:#6e706a}
.step-label b{font-size:40px;color:${p.text};font-weight:500}
.flag{transform-origin:8px 150px;margin-left:30px}
.pcard{background:#fff;border-radius:28px;padding:18px;box-shadow:0 20px 40px rgba(0,0,0,.07)}
.pimg{display:block;width:100%;height:690px;object-fit:cover;border-radius:18px;background:#ddd}
.logo-box{display:flex;flex-direction:column;align-items:flex-start;gap:24px}
.logo-emoji{font-family:${emojiFonts},sans-serif;font-size:200px;line-height:1}
.avatar{width:100%;height:100%}
.avatar.flip{transform:scaleX(-1)}
.avatar-img{width:100%;height:100%;object-fit:contain;object-position:center bottom;display:block}
.m-head .avatar-img{-webkit-mask-image:linear-gradient(to bottom,#000 72%,transparent 98%);mask-image:linear-gradient(to bottom,#000 72%,transparent 98%)}
#captions{position:absolute;left:70px;width:860px;top:190px;z-index:20;display:none;justify-content:center;white-space:nowrap}
#captions span{display:inline-block;margin:0 9px;font-size:64px;font-weight:700;letter-spacing:-.03em;color:#c9cbc4}
#captions span.past{color:var(--muted)}
#captions span.on{color:${p.text}}
#captions.tone-dark span{color:#55574f}
#captions.tone-dark span.past{color:var(--muted)}
#captions.tone-dark span.on{color:${DARK_INK}}
`;
}

/** Haut des sous-titres du modele Cahier (sans boite, au-dessus de la phrase). */
export const CAHIER_CAPTION_TOP = 190;
