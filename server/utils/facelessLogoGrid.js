/**
 * Grille de logos qui s'ajoutent au fil de la voix (defile d'images en mode « stack »). Tout est pur et independant du
 * modele visuel : chaque modele qui veut l'afficher appelle `logoGridHtml` avec sa propre zone et habille `.logo-tile`
 * (voir `logoTileCss` pour un habillage par defaut). Les cases sont toutes placees des le depart : un logo qui arrive
 * ne deplace jamais les autres, la case reste simplement vide jusqu'au mot qui le declenche.
 */

/** Pur : nombre de logos par rangee, du haut vers le bas (2 -> deux cote a cote, 4 -> 2 x 2, 5 -> 3 + 2, 6 -> 3 + 3). */
export function logoRows(count) {
  const n = Math.max(0, Math.min(6, Math.floor(Number(count) || 0)));
  const table = { 0: [], 1: [1], 2: [2], 3: [3], 4: [2, 2], 5: [3, 2], 6: [3, 3] };
  return table[n];
}

/**
 * Pur : position de chaque logo (carre `size`) dans la zone `box` { x, y, w, h } : rangees centrees, meme taille
 * partout, jamais plus grand que `maxSide`. Les logos sont dans l'ordre de lecture (gauche a droite, haut en bas).
 */
export function logoGridLayout(count, box, { gap = 36, maxSide = 330 } = {}) {
  const rows = logoRows(count);
  if (!rows.length) return [];
  const widest = Math.max(...rows);
  const size = Math.max(40, Math.floor(Math.min(
    maxSide,
    (box.w - gap * (widest - 1)) / widest,
    (box.h - gap * (rows.length - 1)) / rows.length,
  )));
  const totalH = rows.length * size + (rows.length - 1) * gap;
  const top = box.y + Math.round((box.h - totalH) / 2);
  const out = [];
  rows.forEach((perRow, rowIndex) => {
    const rowW = perRow * size + (perRow - 1) * gap;
    const left = box.x + Math.round((box.w - rowW) / 2);
    for (let col = 0; col < perRow; col += 1) {
      out.push({ x: left + col * (size + gap), y: top + rowIndex * (size + gap), size });
    }
  });
  return out;
}

/**
 * HTML de la grille : une case par logo (`fx` = l'element anime du moteur, `url` = adresse de l'illustration). Chaque
 * logo entre a son instant `at` (la premiere des le debut). Retourne une chaine vide s'il y a moins de 2 logos.
 */
export function logoGridHtml(images, box, { fx, url, enter = 'card', gap = 36, maxSide = 330, z = 3 }) {
  const list = (Array.isArray(images) ? images : []).slice(0, 6);
  if (list.length < 2) return '';
  const cells = logoGridLayout(list.length, box, { gap, maxSide });
  return list.map((image, index) => {
    const cell = cells[index];
    const at = index === 0 ? 0.15 : Math.max(0, Number(image.at) || 0);
    return fx(`<div class="logo-tile"><img alt="" src="${url(image.id)}"></div>`, {
      x: cell.x, y: cell.y, w: cell.size, h: cell.size, enter, fixedEnter: true, at, rot: 0, boil: 0, z,
    });
  }).join('');
}

/** Habillage par defaut d'une case de logo (un modele peut le remplacer) : tuile blanche, logo entier et centre. */
export function logoTileCss({ background = '#fff', radius = 44, shadow = '0 12px 34px rgba(15,23,42,.18)' } = {}) {
  return `.logo-tile{width:100%;height:100%;background:${background};border-radius:${radius}px;box-shadow:${shadow};display:flex;align-items:center;justify-content:center;padding:15%}`
    + '.logo-tile img{display:block;width:100%;height:100%;object-fit:contain}';
}
