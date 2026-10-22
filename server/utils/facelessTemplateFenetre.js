/**
 * Modele visuel "Fenetre" (DA A de Claude Design, docs/faceless-design-brief) : chaque scene
 * s affiche dans une fenetre d ordinateur posee sur un aplat de couleur saturee, l avatar passe
 * devant. Meme vocabulaire de mises en page que le modele classique (hook, title, list...) :
 * le plan de montage ne change pas, seul le dessin change.
 *
 * Les fonctions de construction (fx, avatarVisual...) viennent de facelessTemplate.js par `ctx`
 * (pas d import croise). Toutes les animations sont des fonctions du temps (voir le runtime).
 */

// Fenetre : x 80, largeur 900, haut y 470 ; hauteur selon la scene, bas max y 1650.
const WIN_X = 80;
const WIN_W = 900;
const WIN_TOP = 470;
// Ecran interieur : bordures 2 x 10, marges 2 x 24, padding 2 x 48.
const SCREEN_INNER_W = WIN_W - 20 - 48 - 96;
// Hauteur utile de l ecran pour une fenetre de hauteur h (barre 88 + trait 8, bordures, marges, padding).
const screenInnerH = (h) => h - 20 - 96 - 48 - 96;

const HEAD_RATIO = 320 / 340;
const BODY_RATIO = 580 / 420;

// Ou se pose l avatar, par mise en page : centre horizontal, tete (largeur, bas), buste (largeur, toujours colle au bas).
const SPOTS = {
  hook: { cx: 255, head: { w: 470, bottom: 1560 }, body: 520 },
  title: { cx: 540, head: { w: 560, bottom: 1780 }, body: 600 },
  list: { cx: 860, head: { w: 380, bottom: 1700 }, body: 420 },
  word: { cx: 540, head: { w: 520, bottom: 1700 }, body: 560 },
  stat: { cx: 190, head: { w: 340, bottom: 1780 }, body: 360 },
  avatar: { cx: 540, head: { w: 640, bottom: 1800 }, body: 680 },
  photo: { cx: 190, head: { w: 340, bottom: 1760 }, body: 360 },
  logo: { cx: 540, head: { w: 520, bottom: 1700 }, body: 560 },
};

const SCREEN = '#0e0e10';
const ROW = '#1a1a1e';
const MUTED = '#8a8a92';

/** Pur : echappe un texte pour du HTML. */
export function esc(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Pur : mot normalise (minuscules, sans accents ni ponctuation), pour caler un mot cle sur la voix. */
function norm(word) {
  return String(word || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/^(?:qu|[cdjlmnst])['’]/, '').replace(/[^a-z0-9]+/g, '');
}

/**
 * Pur : decoupe un texte en unites d apparition : mots ordinaires et groupes **mot cle**.
 * Les sauts de ligne sont gardes ({ br: true }).
 */
export function revealUnits(text) {
  const units = [];
  const parts = String(text ?? '').split(/(\*\*.+?\*\*)/g);
  for (const part of parts) {
    if (!part) continue;
    const kw = /^\*\*(.+)\*\*$/.exec(part);
    if (kw) {
      units.push({ text: kw[1].trim(), kw: true });
      continue;
    }
    part.split(/(\n)/).forEach((chunk) => {
      if (chunk === '\n') units.push({ br: true });
      else chunk.split(/\s+/).filter(Boolean).forEach((word) => units.push({ text: word, kw: false }));
    });
  }
  return units;
}

/**
 * Pur : instant (local a la scene) ou chaque unite apparait. Les mots se suivent a un pas regulier
 * (la moitie de la duree de voix de la scene, borne) ; un mot cle apparait au plus tot quand la voix
 * le dit (-0,05 s), s il est dit dans la scene.
 */
/** Pur : instant (local a la scene) ou la voix dit le premier mot d un texte, ou null. */
export function spokenAt(text, scene) {
  const first = norm(String(text || '').split(/\s+/)[0]);
  if (!first) return null;
  const hit = (scene?.words || []).find((w) => norm(w.text) === first);
  return hit ? Number(hit.start) - Number(scene.start || 0) : null;
}

export function revealTimes(units, scene, { start = 0.2, waitKeyword = true } = {}) {
  const words = units.filter((u) => !u.br);
  const voice = Math.max(0.6, Number(scene?.voiceEnd ?? 0) - Number(scene?.voiceStart ?? 0));
  const step = Math.min(0.18, Math.max(0.07, (voice * 0.5) / Math.max(1, words.length)));
  const spoken = (scene?.words || []).map((w) => ({ key: norm(w.text), at: Number(w.start) - Number(scene.start || 0) }));

  let k = 0;
  return units.map((unit) => {
    if (unit.br) return null;
    let at = start + k * step;
    k += 1;
    if (unit.kw && waitKeyword) {
      const first = norm(unit.text.split(/\s+/)[0]);
      const hit = first ? spoken.find((w) => w.key === first) : null;
      if (hit) at = Math.max(at, hit.at - 0.05);
    }
    return Number(at.toFixed(3));
  });
}

/** HTML d un texte qui apparait mot par mot ; `kwClass` : "kw-label" (etiquette) ou "kw-color" (couleur). */
function revealHtml(text, scene, { start = 0.2, kwClass = 'kw-label' } = {}) {
  const units = revealUnits(text);
  const times = revealTimes(units, scene, { start });
  return units.map((unit, i) => {
    if (unit.br) return '<br>';
    const enter = unit.kw && kwClass === 'kw-label' ? 'label' : 'blur-up';
    return `<span class="wd${unit.kw ? ` ${kwClass}` : ''}" data-enter="${enter}" data-at="${times[i]}" data-rot="0" data-boil="0">${esc(unit.text)}</span>`;
  }).join(' ');
}

/** Pur : decompose un chiffre cle ("×15", "27,9 ms", "-30 %") pour le compteur, ou null. */
export function parseCountable(value) {
  const m = /^(\D*?)(\d+(?:[.,]\d+)?)(.*)$/.exec(String(value ?? '').trim());
  if (!m) return null;
  const number = Number(m[2].replace(',', '.'));
  if (!Number.isFinite(number)) return null;
  const decimals = (m[2].split(/[.,]/)[1] || '').length;
  return { prefix: m[1], number, decimals, suffix: m[3] };
}

/**
 * Pur : largeur (%) des barres de comparaison, proportionnelle aux nombres des valeurs
 * (la plus grande = 100 %, 4 % au minimum). null si moins de deux valeurs chiffrees.
 */
export function compareWidths(compare) {
  const numbers = (compare || []).map((row) => parseCountable(row?.value)?.number);
  if (numbers.length < 2 || numbers.some((n) => n == null)) return null;
  const max = Math.max(...numbers);
  if (!(max > 0)) return null;
  return numbers.map((n) => Math.max(4, Math.round((n / max) * 100)));
}

/** Attributs du compteur d un chiffre cle (vide si la valeur n est pas un nombre). */
function countAttrs(value, at) {
  const c = parseCountable(value);
  if (!c) return '';
  return ` data-count-at="${at}" data-count-to="${c.number}" data-count-dec="${c.decimals}" data-count-pre="${esc(c.prefix)}" data-count-suf="${esc(c.suffix)}"`;
}

function windowBox(ctx, { h, y = WIN_TOP, tab = '', inner, screenClass = '' }) {
  const html = `<div class="win" style="height:${h}px">`
    + '<div class="win-bar"><span class="dot r"></span><span class="dot y"></span><span class="dot g"></span>'
    + `<span class="win-tab">${esc(tab)}</span></div>`
    + `<div class="win-screen ${screenClass}">${inner}</div></div>`;
  return ctx.fx(html, { x: WIN_X, y, w: WIN_W, h, enter: 'window', fixedEnter: true, z: 2, boil: 0, data: { exit: 'shrink' } });
}

function avatar(ctx, scene, spotKey) {
  if (ctx.noAvatar) return '';
  const spot = SPOTS[spotKey];
  const settings = scene.avatar || {};
  if (settings.hidden) return '';
  const beats = scene.beats?.length ? scene.beats : [{ at: 0, expr: settings.expr || 'neutral' }];

  return beats.map((beat, i) => {
    const until = i + 1 < beats.length ? beats[i + 1].at : undefined;
    const flip = beat.flip ?? settings.flip ?? false;
    const visual = ctx.avatarVisual(beat, settings);
    const body = visual.mode === 'body';
    const w = body ? spot.body : spot.head.w;
    const h = Math.round(w * (body ? BODY_RATIO : HEAD_RATIO));
    const bottom = body ? 1940 : spot.head.bottom;
    // Premiere image : l avatar monte (ressort) ; changement de pose : instantane, sur le mot repere.
    return ctx.fx(`<div class="avatar m-${visual.mode}${flip ? ' flip' : ''}">${visual.html}</div>`, {
      x: Math.round(spot.cx - w / 2), y: bottom - h, w, h,
      enter: i === 0 ? 'peek' : 'instant', fixedEnter: true, at: beat.at, until, rot: 0, boil: 0, z: 5, data: { breathe: 6 },
    });
  }).join('');
}

// Trois traits jaunes de reaction, pres de la tete de l avatar de l accroche.
function strokes(ctx, x, y) {
  const svg = '<svg viewBox="0 0 120 120" width="100%"><g stroke="#ffc531" stroke-width="13" stroke-linecap="round">'
    + '<line x1="22" y1="28" x2="64" y2="14"/><line x1="26" y1="62" x2="76" y2="58"/><line x1="22" y1="96" x2="62" y2="104"/></g></svg>';
  return ctx.fx(svg, { x, y, w: 130, enter: 'label', fixedEnter: true, at: 0.45, rot: 0, boil: 0, z: 6 });
}

const tabOf = (scene, fallback = '') => scene.tab || fallback;

const LAYOUTS = {
  // Accroche : texte en grand dans l ecran, mot cle dans une etiquette, avatar qui chevauche le bas gauche.
  hook(scene, ctx) {
    const h = 780;
    const kicker = scene.title ? `<div class="kicker">${esc(scene.title)}</div>` : '';
    const inner = `${kicker}<div class="say big" data-fit-h="${screenInnerH(h) - (kicker ? 60 : 0)}" style="font-size:${scene.size || 100}px">${revealHtml(scene.text, scene)}</div>`;
    const spot = SPOTS.hook;
    return windowBox(ctx, { h, tab: tabOf(scene), inner })
      + avatar(ctx, scene, 'hook')
      + strokes(ctx, spot.cx + spot.head.w / 2 - 30, spot.head.bottom - Math.round(spot.head.w * HEAD_RATIO) + 40);
  },
  // Chapitre : commentaire "// titre" puis la phrase, mot cle en jaune ; grand avatar qui monte du bas.
  title(scene, ctx) {
    const h = 780;
    const main = scene.text || scene.title;
    const kicker = scene.text && scene.title ? `${scene.number ? `${esc(scene.number)} ` : ''}// ${esc(scene.title)}` : (scene.number ? `// ${esc(scene.number)}` : '');
    const inner = `${kicker ? `<div class="kicker accent">${kicker}</div>` : ''}`
      + `<div class="say" data-fit-h="${screenInnerH(h) - 300}" style="font-size:92px">${revealHtml(main, scene, { kwClass: 'kw-color' })}</div>`;
    return windowBox(ctx, { h, tab: tabOf(scene), inner }) + avatar(ctx, scene, 'title');
  },
  // Liste : une ligne par element, qui entre sur son mot ; la derniere entree est surlignee.
  list(scene, ctx) {
    const h = 1000;
    const items = scene.items || [];
    const rows = items.map((item, i) => {
      const next = items[i + 1];
      return `<div class="row wd" data-enter="row-in" data-at="${item.at}" data-rot="0" data-boil="0" data-hl-a="${ROW}" data-hl-b="${ctx.style.palette.accent}" data-hl-from="${item.at}"${next ? ` data-hl-until="${next.at}"` : ''}>`
        + `<span class="row-idx">${String(i + 1).padStart(2, '0')}</span><span class="row-text">${esc(String(item.text).replace(/\*\*/g, ''))}</span></div>`;
    }).join('');
    const kicker = scene.title ? `<div class="kicker">// ${esc(String(scene.title).replace(/\*\*/g, ''))}</div>` : '';
    const inner = `${kicker}<div class="rows" data-fit-h="${screenInnerH(h) - (kicker ? 70 : 0)}">${rows}</div>`;
    return windowBox(ctx, { h, tab: tabOf(scene), inner }) + avatar(ctx, scene, 'list');
  },
  // Un mot en tres grand, couleur dominante sur l ecran noir, puis un zoom lent.
  word(scene, ctx) {
    const h = 600;
    const inner = `<div class="giant-box"><span class="giant wd" data-enter="giant" data-at="0.15" data-rot="0" data-boil="0" data-fit-w="${SCREEN_INNER_W}">${esc(scene.word)}</span></div>`;
    return windowBox(ctx, { h, y: 600, tab: tabOf(scene), inner, screenClass: 'center' }) + avatar(ctx, scene, 'word');
  },
  // Chiffre cle : compteur, phrase courte, comparaison en barres.
  stat(scene, ctx) {
    const h = 1100;
    const count = countAttrs(scene.word, 0.3);
    const widths = compareWidths((scene.compare || []).slice(0, 2));
    // Deux comparaisons au plus dans la fenetre (la place manque pour une troisieme).
    const rows = (scene.compare || []).slice(0, 2).map((row, i) => {
      const bar = widths
        ? `<div class="bar-track"><div class="bar ${i === 0 ? 'b1' : 'b2'}" data-bar-w="${widths[i]}" data-bar-at="${(0.7 + i * 0.3).toFixed(2)}"></div></div>`
        : '';
      return `<div class="cmp wd" data-enter="row-in" data-at="${(0.6 + i * 0.3).toFixed(2)}" data-rot="0" data-boil="0">`
        + `<div class="cmp-head"><span class="cmp-label">${esc(row.label)}</span><span class="cmp-value${i ? ' dim' : ''}">${esc(row.value)}</span></div>${bar}</div>`;
    }).join('');
    const kicker = scene.title ? `<div class="kicker">// ${esc(String(scene.title).replace(/\*\*/g, ''))}</div>` : '';
    const inner = `${kicker}<div class="stat-num wd" data-enter="giant" data-at="0.2" data-rot="0" data-boil="0" data-fit-w="${SCREEN_INNER_W}"${count}>${esc(scene.word)}</div>`
      + (scene.text ? `<div class="stat-text">${revealHtml(scene.text, scene, { start: 0.45, kwClass: 'kw-color' })}</div>` : '')
      + `<div class="cmps">${rows}</div>`;
    return windowBox(ctx, { h, tab: tabOf(scene), inner }) + avatar(ctx, scene, 'stat');
  },
  // Appel a l action : phrase courte dans une petite fenetre, grand avatar devant.
  avatar(scene, ctx) {
    const h = 600;
    const text = scene.text || '';
    const inner = text ? `<div class="say" data-fit-h="${screenInnerH(h)}" style="font-size:88px">${revealHtml(text, scene)}</div>` : '';
    return windowBox(ctx, { h, tab: tabOf(scene), inner }) + avatar(ctx, scene, 'avatar');
  },
  // Une illustration du dossier dans l ecran, legende en commentaire.
  photo(scene, ctx) {
    const entry = ctx.illustrations[scene.image];
    if (!entry) return LAYOUTS.avatar({ ...scene, text: scene.text || scene.title || '' }, ctx);
    const h = 1000;
    const inner = `<img class="shot" alt="" src="${ctx.illustrationUrl(scene.image)}">`
      + (scene.text ? `<div class="kicker shot-cap">// ${esc(String(scene.text).replace(/\*\*/g, ''))}</div>` : '');
    return windowBox(ctx, { h, tab: tabOf(scene), inner, screenClass: 'tight' }) + avatar(ctx, scene, 'photo');
  },
  // Nom d une marque ou d un outil : son icone et son nom.
  logo(scene, ctx) {
    const h = 640;
    const inner = `<div class="logo-box"><span class="logo-emoji wd" data-enter="label" data-at="0.15" data-rot="0" data-boil="0">${esc(scene.emoji || '✨')}</span>`
      + `<span class="logo-name wd" data-enter="blur-up" data-at="0.35" data-rot="0" data-boil="0" data-fit-w="${SCREEN_INNER_W}">${esc(scene.word)}</span></div>`;
    return windowBox(ctx, { h, y: 560, tab: tabOf(scene), inner, screenClass: 'center' }) + avatar(ctx, scene, 'logo');
  },
};

/** HTML d une scene (fond compris) pour le modele Fenetre. */
export function fenetreScene(scene, ctx) {
  const layout = LAYOUTS[scene.layout] || LAYOUTS.avatar;
  return layout(scene, ctx);
}

/** Feuille de style du modele Fenetre. */
export function fenetreCss(style, { fontFamily, monoFamily, emojiFonts }) {
  const p = style.palette;
  return `
:root{--dom:${p.accent};--accent2:${p.accent2};--frame:${p.card};--ink:${p.cardText};--text:${p.text}}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1080px;height:1920px;overflow:hidden}
body{background:${p.background};font-family:"${fontFamily}",${emojiFonts},sans-serif;color:${p.text}}
.scene{position:absolute;inset:0;display:none}
.scene.bg-main{--bgc:${p.background}}
.scene.bg-alt{--bgc:${p.backgroundAlt}}
.scene.bg-dark{--bgc:${p.dark}}
.bg{position:absolute;inset:0;background-color:var(--bgc)}
.fx{position:absolute;transform-origin:50% 50%;visibility:hidden}
.wd{display:inline-block;visibility:hidden;transform-origin:50% 60%}
.win{position:relative;width:100%;background:var(--frame);border:10px solid #111;border-radius:56px;overflow:hidden;display:flex;flex-direction:column}
.win-bar{flex:0 0 88px;border-bottom:8px solid #111;display:flex;align-items:center;gap:16px;padding:0 36px}
.dot{width:30px;height:30px;border-radius:50%;border:3px solid #111;flex:0 0 auto}
.dot.r{background:#ff5f57}.dot.y{background:#febc2e}.dot.g{background:#28c840}
.win-tab{margin-left:auto;font-family:"${monoFamily}",monospace;font-size:26px;font-weight:700;color:var(--ink);white-space:nowrap;overflow:hidden}
.win-screen{flex:1;margin:24px;background:${SCREEN};border-radius:32px;padding:48px;color:var(--text);overflow:hidden;display:flex;flex-direction:column;gap:28px;position:relative}
.win-screen.center{align-items:center;justify-content:center}
.win-screen.tight{padding:24px;gap:18px}
.kicker{font-family:"${monoFamily}",monospace;font-size:28px;font-weight:500;color:${MUTED};white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.kicker.accent{color:var(--accent2)}
.say{font-weight:800;line-height:1.04;letter-spacing:-.03em;font-stretch:90%}
.kw-label{background:var(--dom);color:#fff;border-radius:18px;padding:0 .2em;margin:.04em 0}
.kw-color{color:var(--accent2)}
.rows{display:flex;flex-direction:column;gap:22px;font-size:64px}
.row{display:flex;align-items:center;gap:28px;background:${ROW};border-radius:22px;padding:26px 32px;font-weight:800;letter-spacing:-.02em;line-height:1.05;visibility:hidden}
.row-idx{font-family:"${monoFamily}",monospace;font-size:.53em;font-weight:500;color:${MUTED};flex:0 0 auto}
.row-text{font-size:1em}
.giant-box{width:100%;text-align:center;white-space:nowrap}
.giant{font-size:250px;font-weight:800;letter-spacing:-.036em;color:var(--dom);line-height:1;white-space:nowrap;font-stretch:90%}
.stat-num{font-size:220px;font-weight:800;letter-spacing:-.04em;color:var(--dom);line-height:1;white-space:nowrap;font-stretch:90%}
.stat-text{font-size:60px;font-weight:800;line-height:1.08;letter-spacing:-.02em}
.cmps{display:flex;flex-direction:column;gap:26px;margin-top:auto}
.cmp{display:flex;flex-direction:column;gap:14px;background:${ROW};border-radius:22px;padding:26px 30px;visibility:hidden}
.cmp-head{display:flex;justify-content:space-between;align-items:baseline;gap:20px}
.cmp-label{font-family:"${monoFamily}",monospace;font-size:28px;color:${MUTED}}
.cmp-value{font-size:64px;font-weight:800;letter-spacing:-.03em;white-space:nowrap}
.cmp-value.dim{color:${MUTED}}
.bar-track{height:22px;border-radius:11px;background:#26262c;overflow:hidden}
.bar{height:100%;width:0;border-radius:11px}
.bar.b1{background:var(--dom)}.bar.b2{background:var(--accent2)}
.shot{display:block;width:100%;flex:1;min-height:0;object-fit:cover;border-radius:22px;background:#222}
.shot-cap{padding:0 10px}
.logo-box{display:flex;flex-direction:column;align-items:center;gap:30px;width:100%}
.logo-emoji{font-family:${emojiFonts},sans-serif;font-size:200px;line-height:1}
.logo-name{font-size:110px;font-weight:800;letter-spacing:-.03em;white-space:nowrap;max-width:100%}
.avatar{width:100%;height:100%}
.avatar.flip{transform:scaleX(-1)}
/* Une image "tete" est coupee sous les epaules : le bas se fond au lieu de flotter avec un bord net. */
.m-head .avatar-img{-webkit-mask-image:linear-gradient(to bottom,#000 72%,transparent 98%);mask-image:linear-gradient(to bottom,#000 72%,transparent 98%)}
.avatar-img{width:100%;height:100%;object-fit:contain;object-position:center bottom;display:block;filter:drop-shadow(0 16px 0 rgba(0,0,0,.22))}
#captions{position:absolute;left:70px;width:860px;top:200px;z-index:20;display:none;justify-content:center;white-space:nowrap}
#captions .cap-in{display:inline-flex;background:#111;border-radius:22px;padding:12px 28px;box-shadow:0 8px 0 rgba(0,0,0,.2)}
#captions span{display:inline-block;margin:0 9px;font-size:68px;font-weight:800;letter-spacing:-.02em;color:#fff;font-stretch:90%}
#captions span.on{color:var(--accent2)}
/* Fond sombre : l etiquette passe en clair pour rester visible. */
#captions.tone-dark .cap-in{background:var(--frame)}
#captions.tone-dark span{color:var(--ink)}
#captions.tone-dark span.on{color:var(--dom)}
`;
}

/** Haut des sous-titres du modele Fenetre : l etiquette noire, toujours au-dessus de la fenetre. */
export const FENETRE_CAPTION_TOP = 200;
