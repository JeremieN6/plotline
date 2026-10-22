/**
 * Modele visuel "Journal" (DA K de Claude Design, docs/faceless-design-brief) : pour un persona createur de
 * contenu qui raconte ce qu il construit (build in public). Un journal de bord honnete : papier clair, serif
 * italique pour la voix (Instrument Serif), une couleur d accent (violet par defaut), cartes de produit et
 * liste de ce qui est livre ("ship log"). Ton humain, direct, sans effet.
 *
 * Dans le ship log, un element dont `tone` vaut "watch" est une ligne A VENIR (tirets, grise) ; les autres
 * sont livres (disque d accent et coche). Rien n est invente : tout vient du plan.
 */

import { esc, revealUnits, spokenAt } from './facelessTemplateFenetre.js';
import { pace } from './facelessTemplateEditeur.js';
import { glueQuotes } from './facelessTemplateHerbier.js';

const X = 96;
const W = 888;
const C = { paper: '#f7f6f3', white: '#ffffff', line: '#e3e0d8', ink: '#141414', gray: '#6b6880', dash: '#b9b4cc', peach: '#ffe1d6', mint: '#d6f0e3' };

const noMarks = (text) => String(text ?? '').replace(/\*\*/g, '');

/** Pur : une ligne du ship log est "a venir" (pas encore livree) quand son ton est "watch". */
export function isUpcoming(item) {
  return item?.tone === 'watch';
}

/** Pur : trajet du curseur de la capture (quadratique) : point a l instant q (0 a 1), la courbe s ecarte de `bend` px. */
export function glidePoint({ x0, y0, x1, y1, bend = 0 }, q) {
  const mx = (x0 + x1) / 2;
  const my = (y0 + y1) / 2;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const cx = mx + (-dy / len) * bend;
  const cy = my + (dx / len) * bend;
  const u = 1 - q;
  return { x: u * u * x0 + 2 * u * q * cx + q * q * x1, y: u * u * y0 + 2 * u * q * cy + q * q * y1 };
}

/** Pur : l accent eclairci (45 % vers le blanc) pour les scenes sombres, ou un bleu profond serait illisible. */
export function onDarkAccent(hex) {
  const n = parseInt(String(hex).slice(1), 16);
  const mix = (sh) => Math.round(((n >> sh) & 255) * 0.55 + 255 * 0.45).toString(16).padStart(2, '0');
  return `#${mix(16)}${mix(8)}${mix(0)}`;
}

/** Titre en serif : mots qui arrivent sur la voix ; le mot en italique passe de l encre a l accent quand il est dit. */
function heading(ctx, scene, text, { size = 148, start = 0.1, maxH = 560, top = 520, id, follow, gap = 40, center = false } = {}) {
  if (!String(text || '').trim()) return '';
  const units = glueQuotes(revealUnits(text));
  const count = Math.max(1, units.filter((u) => !u.br).length);
  const step = Math.min(0.18, Math.max(0.07, (Math.max(0.6, Number(scene?.voiceEnd ?? 0) - Number(scene?.voiceStart ?? 0)) * 0.5) / count));
  let k = 0;
  // Sur une scene sombre, l encre devient claire et l accent est eclairci.
  const dark = scene?.bg === 'dark';
  const ink = dark ? C.paper : C.ink;
  const accent = dark ? onDarkAccent(ctx.style.palette.accent) : ctx.style.palette.accent;
  const html = units.map((unit) => {
    if (unit.br) return '<br>';
    const at = Math.max(0, start + k * step);
    k += 1;
    if (!unit.kw) return `<span class="wd" data-enter="jr-word" data-at="${at.toFixed(2)}" data-rot="0" data-boil="0">${esc(unit.text)}</span>`;
    const said = spokenAt(unit.text, scene);
    const inkAt = said != null && said - 0.1 > at ? said - 0.1 : at + 0.3;
    return `<span class="wd kw" data-enter="jr-word" data-at="${at.toFixed(2)}" data-rot="0" data-boil="0" data-ink-a="${ink}" data-ink-b="${accent}" data-ink-at="${inkAt.toFixed(3)}">${esc(unit.text)}</span>`;
  }).join(' ');
  return ctx.fx(`<div class="hd${center ? ' c' : ''}" data-fit-w="${W}" data-fit-h="${maxH}" style="font-size:${size}px">${html}</div>`, {
    x: X, y: top, w: W, enter: 'instant', fixedEnter: true, rot: 0, boil: 0, z: 3, id, follow, gap,
  });
}

/** Petit libelle en capitales a chasse fixe au-dessus d un bloc ("JOURNAL DE BORD", "SHIP LOG"). */
const kicker = (ctx, text, { y = 440, center = false } = {}) => (text
  ? ctx.fx(`<div class="kick${center ? ' c' : ''}">${esc(noMarks(text))}</div>`, { x: X, y, w: W, enter: 'fade-in', fixedEnter: true, at: 0.05, rot: 0, boil: 0, z: 3 })
  : '');

const CHECK = (at) => `<svg viewBox="0 0 40 40" width="40" height="40" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"><path d="M9,21 L17,29 L31,12" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1" data-dash-at="${at.toFixed(2)}" data-dash-dur="0.25"/></svg>`;

/** Avatar du persona en bas a droite (le buste), la ou la maquette pose le personnage devant son ordinateur. */
function avatarCorner(ctx, scene, { right = 40, bottom = 1700, w = 470 } = {}) {
  if (ctx.noAvatar) return '';
  const settings = scene.avatar || {};
  if (settings.hidden) return '';
  const beats = scene.beats?.length ? scene.beats : [{ at: 0, expr: settings.expr || 'neutral' }];
  return beats.map((beat, i) => {
    const until = i + 1 < beats.length ? beats[i + 1].at : undefined;
    const visual = ctx.avatarVisual(beat, settings);
    const flip = beat.flip ?? settings.flip ?? false;
    const body = visual.mode === 'body';
    const bw = body ? w : Math.round(w * 0.9);
    const h = Math.round(bw * (body ? 580 / 420 : 320 / 340));
    return ctx.fx(`<div class="avatar m-${visual.mode}${flip ? ' flip' : ''}">${visual.html}</div>`, {
      x: 1080 - right - bw, y: bottom + 40 - h, w: bw, h,
      enter: i === 0 ? 'rise-soft' : 'instant', fixedEnter: true, at: i === 0 ? 0.3 : beat.at, until, rot: 0, boil: 0, z: 4,
    });
  }).join('');
}

/** Notification : une coche d accent et un texte ("Persona cree"), elle monte, reste un instant puis disparait. */
function toast(ctx, text, { y = 1380, at = 0.7 } = {}) {
  if (!String(text || '').trim()) return '';
  const disc = `<span class="tick" data-pop-at="${at.toFixed(2)}" data-pop-dur="0.2" data-pop-c="1.7">${CHECK(at + 0.15)}</span>`;
  return ctx.fx(`<div class="toast">${disc}<span class="tt">${esc(noMarks(text))}</span></div>`, { x: X, y, enter: 'jr-toast', fixedEnter: true, at, until: at + 2.4, rot: 0, boil: 0, z: 5 });
}

const LAYOUTS = {
  // Accroche : libelle "journal de bord", grand titre serif (mot cle en italique), trois disques de personas qui entrent un par un.
  hook(scene, ctx) {
    const tints = [ctx.style.palette.backgroundAlt, C.peach, C.mint];
    const discs = tints.map((tint, i) => ctx.fx(`<div class="pdisc" style="background:${tint}"></div>`,
      { x: X + i * 270, y: 1260, w: 330, h: 330, enter: 'persona-in', fixedEnter: true, at: 0.3 + i * 0.15, rot: 0, boil: 0, z: 2 + i })).join('');
    return kicker(ctx, scene.title) + heading(ctx, scene, scene.text, { size: 148, top: 520, maxH: 680 }) + discs;
  },
  // Chapitre : libelle, phrase serif, l avatar en bas a droite, une notification facultative (`tab`).
  title(scene, ctx) {
    return kicker(ctx, scene.title) + heading(ctx, scene, scene.text || scene.title || '', { size: 124, top: 520, maxH: 640 })
      + avatarCorner(ctx, scene) + toast(ctx, scene.tab);
  },
  // Appel a l action : la phrase, l avatar.
  avatar(scene, ctx) {
    return heading(ctx, scene, scene.text || '', { size: 124, top: 480, maxH: 640 }) + avatarCorner(ctx, scene);
  },
  // Ship log : libelle, titre, cartes blanches a disque d accent et coche ; une ligne "a venir" est en tirets et grisee.
  list(scene, ctx) {
    const items = (scene.items || []).slice(0, 4);
    const accent = ctx.style.palette.accent;
    const headId = `h${ctx.seed()}`;
    const head = kicker(ctx, scene.tab) + heading(ctx, scene, scene.title || '', { size: 104, top: 520, maxH: 240, id: headId });
    let previous = headId;
    const cards = items.map((item, i) => {
      const next = items[i + 1];
      const id = `c${ctx.seed()}`;
      const at = Math.min(item.at, Math.max(0.2, Number(scene.end ?? 3) - Number(scene.start ?? 0) - 0.5));
      const from = at.toFixed(2);
      const up = isUpcoming(item);
      const mark = up
        ? `<span class="todo"><svg viewBox="0 0 80 80" width="80" height="80"><circle cx="40" cy="40" r="36" fill="none" stroke="${C.dash}" stroke-width="4" stroke-dasharray="10 8" data-dashrun="24"/></svg></span>`
        : `<span class="tick" data-pop-at="${from}" data-pop-dur="0.2" data-pop-c="1.7">${CHECK(at + 0.2)}</span>`;
      const until = !up && next ? ` data-hl-until="${Math.min(next.at, at + 4).toFixed(2)}"` : '';
      const hl = up ? '' : ` data-hl-prop="borderColor" data-hl-a="${C.line}" data-hl-b="${accent}" data-hl-from="${from}"${until}`;
      const html = ctx.fx(`<div class="card row${up ? ' up' : ''}"${hl}>${mark}<span class="itx"><span class="it" data-fit-w="${W - 220}" data-fit-h="150">${esc(noMarks(item.text))}</span>${item.sub ? `<span class="is">${esc(noMarks(item.sub))}</span>` : ''}</span></div>`,
        { x: X, y: 800, w: W, enter: 'jr-log', fixedEnter: true, at, rot: 0, boil: 0, z: 3, id, follow: previous, gap: i === 0 ? 44 : 24 });
      previous = id;
      return html;
    }).join('');
    return head + cards;
  },
  // Mot cle : libelle, mot geant en serif italique, trait d accent qui se dessine, phrase de soutien.
  word(scene, ctx) {
    const k = pace(scene);
    const sub = String(scene.text || '').replace(/\*\*/g, '').trim();
    const units = sub ? revealUnits(sub).filter((u) => !u.br) : [];
    const subHtml = units.length
      ? `<div class="sub">${units.map((u, i) => `<span class="wd" data-enter="jr-word" data-at="${((0.9 + i * 0.06) * k).toFixed(2)}" data-rot="0" data-boil="0">${esc(u.text)}</span>`).join(' ')}</div>`
      : '';
    const html = `<div class="wrap"><div class="gword wd" data-enter="jr-giant" data-at="${(0.15 * k).toFixed(2)}" data-rot="0" data-boil="0" data-fit-w="${W}">${esc(scene.word)}</div><i class="bar" data-line-at="${(0.6 * k).toFixed(2)}"></i>${subHtml}</div>`;
    return kicker(ctx, scene.title, { y: 600, center: true }) + ctx.fx(html, { x: X, y: 680, w: W, enter: 'instant', fixedEnter: true, rot: 0, boil: 0, z: 3 });
  },
  // Chiffre cle : un grand chiffre serif italique, une phrase, puis les valeurs a comparer.
  stat(scene, ctx) {
    const k = pace(scene);
    const rows = (scene.compare || []).slice(0, 3).map((row, i) => `<div class="srow wd" data-enter="jr-log" data-at="${((0.8 + i * 0.2) * k).toFixed(2)}" data-rot="0" data-boil="0"><span class="sl">${esc(row.label)}</span><span class="sv">${esc(row.value)}</span></div>`).join('');
    const html = `<div class="gword wd num" data-enter="jr-giant" data-at="${(0.2 * k).toFixed(2)}" data-rot="0" data-boil="0" data-fit-w="${W}">${esc(scene.word)}</div>${rows ? `<div class="srows">${rows}</div>` : ''}`;
    return kicker(ctx, scene.title) + heading(ctx, scene, scene.text || '', { size: 100, top: 520, maxH: 240 }) + ctx.fx(html, { x: X, y: 800, w: W, enter: 'instant', fixedEnter: true, rot: 0, boil: 0, z: 3 });
  },
  // Capture produit : une illustration du dossier dans une fenetre (3 pastilles, adresse = `tab`), un curseur qui glisse et clique.
  photo(scene, ctx) {
    const entry = ctx.illustrations[scene.image];
    if (!entry) return LAYOUTS.avatar({ ...scene, text: scene.text || scene.title || '' }, ctx);
    const cardId = `p${ctx.seed()}`;
    const accent = ctx.style.palette.accent;
    const path = { x0: 140, y0: 780, x1: 560, y1: 380, bend: -90 };
    const cursor = `<div class="cursor" data-glide-at="0.5" data-glide-dur="0.6" data-glide-x0="${path.x0}" data-glide-y0="${path.y0}" data-glide-x1="${path.x1}" data-glide-y1="${path.y1}" data-glide-bend="${path.bend}">`
      + '<svg viewBox="0 0 28 36" width="56" height="72"><path d="M3,2 L3,28 L10,22 L15,33 L20,31 L15,20 L24,20 Z" fill="#141414" stroke="#fff" stroke-width="2.5" stroke-linejoin="round"/></svg></div>'
      + `<i class="ring" style="left:${path.x1 - 40}px;top:${path.y1 - 40}px;border-color:${accent}" data-pop-at="1.0" data-pop-dur="0.25" data-pop-c="1.5"></i>`;
    const win = `<div class="win"><div class="bar2"><i></i><i></i><i></i><span class="url">${esc(scene.tab || '')}</span></div>`
      + `<div class="shot"><img class="pimg" alt="" src="${ctx.illustrationUrl(scene.image)}">${cursor}</div></div>`;
    return ctx.fx(win, { x: X, y: 440, w: W, enter: 'jr-card', fixedEnter: true, at: 0.15, rot: 0, boil: 0, z: 3, id: cardId })
      + heading(ctx, scene, scene.text || '', { size: 88, top: 1400, maxH: 260, follow: cardId, gap: 56 });
  },
  // Nom d un produit ou d une marque : le nom en grand serif italique, trait d accent.
  logo(scene, ctx) {
    const html = `<div class="wrap"><div class="gword wd" data-enter="jr-giant" data-at="0.15" data-rot="0" data-boil="0" data-fit-w="${W}" style="font-size:230px">${esc(scene.word)}</div><i class="bar" data-line-at="0.6"></i></div>`;
    return ctx.fx(html, { x: X, y: 760, w: W, enter: 'instant', fixedEnter: true, rot: 0, boil: 0, z: 3 });
  },
};

/** HTML d une scene pour le modele Journal. */
export function journalScene(scene, ctx) {
  const layout = LAYOUTS[scene.layout] || LAYOUTS.avatar;
  return layout(scene, ctx);
}

/** Feuille de style du modele Journal. `fontFamily` = Instrument Serif, `monoFamily` = IBM Plex Mono. */
export function journalCss(style, { fontFamily, monoFamily, emojiFonts }) {
  const p = style.palette;
  const a = p.accent;
  const SANS = '"Instrument Sans",sans-serif';
  return `
:root{--accent:${a};--ink:${C.ink};--muted:${C.gray}}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1080px;height:1920px;overflow:hidden}
body{background:${p.background};font-family:"${fontFamily}",${emojiFonts},serif;color:var(--ink)}
.scene{position:absolute;inset:0;display:none}
.scene.bg-main{--bgc:${p.background}}
.scene.bg-alt{--bgc:${p.backgroundAlt}}
.scene.bg-dark{--bgc:${p.dark};--ink:${C.paper};--muted:${C.dash};--accent:${onDarkAccent(a)}}
.bg{position:absolute;inset:0;background-color:var(--bgc)}
.fx{position:absolute;transform-origin:50% 50%;visibility:hidden}
.wd{display:inline-block;visibility:hidden;transform-origin:50% 60%}
.kick{font-family:"${monoFamily}",monospace;font-weight:500;font-size:26px;letter-spacing:4px;text-transform:uppercase;color:var(--muted)}
.kick.c{text-align:center}
.hd{font-family:"${fontFamily}",serif;font-weight:400;line-height:1.02;letter-spacing:-3px;color:var(--ink)}
.hd .kw{font-style:italic}
.pdisc{width:100%;height:100%;border-radius:50%}
.card{background:${p.card};border:3px solid ${C.line};border-radius:32px;box-shadow:0 20px 44px rgba(20,20,20,.07)}
.card.row{display:flex;align-items:center;gap:32px;padding:26px 36px}
.card.row.up{background:transparent;border-style:dashed;border-color:${C.dash};box-shadow:none}
.tick{display:inline-flex;align-items:center;justify-content:center;width:80px;height:80px;border-radius:50%;background:var(--accent);flex:0 0 auto}
.todo{display:inline-flex;width:80px;height:80px;flex:0 0 auto}
.itx{display:flex;flex-direction:column;gap:4px;min-width:0}
.it{font-family:${SANS};font-weight:700;font-size:58px;line-height:1.08;letter-spacing:-.03em;color:${C.ink}}
.up .it{color:var(--muted)}
.is{font-family:"${monoFamily}",monospace;font-weight:500;font-size:26px;letter-spacing:3px;text-transform:uppercase;color:var(--muted)}
.toast{display:flex;align-items:center;gap:22px;background:${p.card};border:3px solid ${C.line};border-radius:28px;box-shadow:0 20px 44px rgba(20,20,20,.1);padding:20px 34px 20px 22px}
.toast .tick{width:60px;height:60px}
.toast .tick svg{width:32px;height:32px}
.tt{font-family:${SANS};font-weight:700;font-size:38px;letter-spacing:-.02em;color:${C.ink};white-space:nowrap}
.wrap{display:flex;flex-direction:column;align-items:center;width:100%}
.gword{font-family:"${fontFamily}",serif;font-style:italic;font-size:236px;line-height:1.05;letter-spacing:-6px;color:var(--accent);white-space:nowrap}
.gword.num{font-size:280px}
.bar{display:block;width:150px;height:8px;border-radius:4px;background:var(--accent);margin-top:10px;transform:scaleX(0);transform-origin:0 50%}
.sub{max-width:760px;margin-top:40px;text-align:center;font-family:${SANS};font-weight:700;font-size:44px;line-height:1.2;letter-spacing:-.02em;color:var(--ink)}
.srows{display:flex;flex-direction:column;margin-top:26px}
.srow{display:flex;justify-content:space-between;align-items:baseline;border-top:3px solid ${C.line};padding:18px 6px}
.sl{font-family:"${monoFamily}",monospace;font-size:28px;letter-spacing:4px;text-transform:uppercase;color:var(--muted)}
.sv{font-size:92px;letter-spacing:-3px;white-space:nowrap}
.win{background:${p.card};border:3px solid ${C.line};border-radius:32px;box-shadow:0 20px 44px rgba(20,20,20,.07);overflow:hidden}
.bar2{display:flex;align-items:center;gap:14px;height:78px;padding:0 30px;border-bottom:3px solid ${C.line}}
.bar2 i{display:block;width:22px;height:22px;border-radius:50%;background:${C.line}}
.url{margin-left:18px;flex:1;min-width:0;font-family:"${monoFamily}",monospace;font-weight:500;font-size:22px;color:var(--muted);background:${p.background};border-radius:999px;padding:10px 24px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.shot{position:relative;height:780px;overflow:hidden}
.pimg{display:block;width:100%;height:100%;object-fit:cover;background:#ddd}
.cursor{position:absolute;left:0;top:0;width:56px;height:72px;z-index:5}
.ring{position:absolute;width:80px;height:80px;border:6px solid;border-radius:50%;z-index:4;transform:scale(0)}
.avatar{width:100%;height:100%}
.avatar.flip{transform:scaleX(-1)}
.avatar-img{width:100%;height:100%;object-fit:contain;object-position:center bottom;display:block}
.m-head .avatar-img{-webkit-mask-image:linear-gradient(to bottom,#000 72%,transparent 98%);mask-image:linear-gradient(to bottom,#000 72%,transparent 98%)}
#captions{position:absolute;left:70px;width:940px;top:200px;z-index:20;display:none;justify-content:center;white-space:nowrap}
#captions span{display:inline-block;margin:0 9px;font-family:${SANS};font-weight:700;font-size:62px;letter-spacing:-.03em;color:${C.dash}}
#captions span.past{color:${C.ink}}
#captions span.on{color:var(--accent)}
#captions.tone-dark span{color:#55536a}
#captions.tone-dark span.past{color:${C.paper}}
#captions.tone-dark span.on{color:${onDarkAccent(a)}}
`;
}

/** Haut des sous-titres du modele Journal (karaoke sans boite : mots a venir en gris, mot dit en accent). */
export const JOURNAL_CAPTION_TOP = 200;
