/**
 * Avatar chibi dessine en SVG pur (aucune generation d image, aucun cout).
 * Sert au prototype de video faceless : il valide la mecanique (expressions,
 * miroir, tete seule ou corps entier) avant qu un vrai pack d expressions soit
 * genere a partir de la face ref d une persona.
 *
 * Toutes les fonctions sont pures : meme entree, meme SVG.
 */

const INK = '#3b2433';
const MOUTH = '#7a2638';
const TONGUE = '#ff7f95';

export const DEFAULT_AVATAR_PALETTE = {
  skin: '#ffe2cf',
  hair: '#5b3a2e',
  blush: '#ff9fb8',
  bow: '#ff6f9c',
  top: '#c9b6ff',
  collar: '#ffffff',
};

// Expression -> yeux, bouche, sourcils, petits extras.
export const AVATAR_EXPRESSIONS = {
  neutral: { eyes: 'open', mouth: 'smile' },
  happy: { eyes: 'happy', mouth: 'open', extras: ['sparkles'] },
  laugh: { eyes: 'happy', mouth: 'big', blush: 0.85 },
  wink: { eyes: 'wink', mouth: 'tongue' },
  cat: { eyes: 'cat', mouth: 'cat', blush: 0.8 },
  surprised: { eyes: 'surprised', mouth: 'o', brows: 'raised', extras: ['sweat'] },
  thinking: { eyes: 'up', mouth: 'smirk', brows: 'one' },
  sad: { eyes: 'open', mouth: 'frown', brows: 'sad', extras: ['tear'] },
  love: { eyes: 'heart', mouth: 'open', blush: 0.9, extras: ['sparkles'] },
  smug: { eyes: 'half', mouth: 'smirk' },
  blink: { eyes: 'closed', mouth: 'smile' },
};

export const AVATAR_POSES = ['idle', 'wave', 'point'];

function eye(kind, cx, cy, side) {
  const stroke = `stroke="${INK}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" fill="none"`;
  switch (kind) {
    case 'happy':
      return `<path d="M${cx - 18} ${cy + 6} Q${cx} ${cy - 18} ${cx + 18} ${cy + 6}" ${stroke}/>`;
    case 'closed':
      return `<path d="M${cx - 18} ${cy - 2} Q${cx} ${cy + 14} ${cx + 18} ${cy - 2}" ${stroke}/>`;
    case 'cat': {
      // Gauche ">" et droite "<" : le V couche a 90 degres demande dans le tuto.
      const d = side < 0
        ? `M${cx - 14} ${cy - 14} L${cx + 12} ${cy} L${cx - 14} ${cy + 14}`
        : `M${cx + 14} ${cy - 14} L${cx - 12} ${cy} L${cx + 14} ${cy + 14}`;
      return `<path d="${d}" ${stroke}/>`;
    }
    case 'heart':
      return `<path d="M${cx} ${cy + 18} C${cx - 30} ${cy - 2} ${cx - 18} ${cy - 26} ${cx} ${cy - 10} C${cx + 18} ${cy - 26} ${cx + 30} ${cy - 2} ${cx} ${cy + 18} Z" fill="#ff4f7b"/>`
        + `<circle cx="${cx - 9}" cy="${cy - 9}" r="4" fill="#fff"/>`;
    case 'surprised':
      return `<circle cx="${cx}" cy="${cy}" r="21" fill="#fff" stroke="${INK}" stroke-width="5"/>`
        + `<circle cx="${cx}" cy="${cy + 2}" r="8" fill="${INK}"/>`;
    case 'half':
      return `<path d="M${cx - 17} ${cy} Q${cx - 17} ${cy + 23} ${cx} ${cy + 23} Q${cx + 17} ${cy + 23} ${cx + 17} ${cy} Z" fill="${INK}"/>`
        + `<path d="M${cx - 21} ${cy} L${cx + 21} ${cy}" ${stroke}/>`
        + `<circle cx="${cx + 5}" cy="${cy + 9}" r="4" fill="#fff"/>`;
    case 'up':
      return `<ellipse cx="${cx}" cy="${cy}" rx="17" ry="23" fill="${INK}"/>`
        + `<circle cx="${cx + 4}" cy="${cy - 12}" r="6" fill="#fff"/>`
        + `<circle cx="${cx - 5}" cy="${cy - 2}" r="3" fill="#fff"/>`;
    case 'wink':
      return side < 0
        ? eye('open', cx, cy, side)
        : `<path d="M${cx - 18} ${cy + 4} Q${cx} ${cy - 16} ${cx + 18} ${cy + 4}" ${stroke}/>`;
    case 'open':
    default:
      return `<ellipse cx="${cx}" cy="${cy}" rx="17" ry="23" fill="${INK}"/>`
        + `<circle cx="${cx - 5}" cy="${cy - 8}" r="6" fill="#fff"/>`
        + `<circle cx="${cx + 5}" cy="${cy + 8}" r="3" fill="#fff"/>`
        + `<path d="M${cx + side * 15} ${cy - 15} L${cx + side * 25} ${cy - 23}" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>`;
  }
}

function mouth(kind) {
  const stroke = `stroke="${INK}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" fill="none"`;
  switch (kind) {
    case 'open':
      return `<path d="M180 280 Q200 282 220 280 Q218 308 200 310 Q182 308 180 280 Z" fill="${MOUTH}"/>`
        + `<ellipse cx="200" cy="302" rx="10" ry="5" fill="${TONGUE}"/>`;
    case 'big':
      return `<path d="M172 276 Q200 280 228 276 Q226 318 200 320 Q174 318 172 276 Z" fill="${MOUTH}"/>`
        + `<ellipse cx="200" cy="310" rx="14" ry="7" fill="${TONGUE}"/>`;
    case 'o':
      return `<ellipse cx="200" cy="292" rx="10" ry="13" fill="${MOUTH}"/>`;
    case 'cat':
      return `<path d="M178 282 Q189 296 200 284 Q211 296 222 282" ${stroke}/>`;
    case 'frown':
      return `<path d="M184 298 Q200 282 216 298" ${stroke}/>`;
    case 'smirk':
      return `<path d="M184 291 Q206 298 220 280" ${stroke}/>`;
    case 'tongue':
      return `<path d="M182 281 Q200 297 218 281" ${stroke}/>`
        + `<path d="M196 289 Q197 303 205 302 Q211 300 209 288 Z" fill="${TONGUE}" stroke="${INK}" stroke-width="3"/>`;
    case 'smile':
    default:
      return `<path d="M182 281 Q200 297 218 281" ${stroke}/>`;
  }
}

function brows(kind) {
  const s = `stroke="${INK}" stroke-width="6" stroke-linecap="round" fill="none"`;
  switch (kind) {
    case 'raised':
      return `<path d="M130 178 Q150 166 170 176" ${s}/><path d="M230 176 Q250 166 270 178" ${s}/>`;
    case 'sad':
      return `<path d="M132 190 L168 180" ${s}/><path d="M232 180 L268 190" ${s}/>`;
    case 'one':
      return `<path d="M232 178 Q252 166 272 176" ${s}/>`;
    default:
      return '';
  }
}

function sparkle(x, y, r, fill = '#ffd166') {
  return `<path d="M${x} ${y - r} Q${x + r * 0.18} ${y - r * 0.18} ${x + r} ${y} Q${x + r * 0.18} ${y + r * 0.18} ${x} ${y + r} Q${x - r * 0.18} ${y + r * 0.18} ${x - r} ${y} Q${x - r * 0.18} ${y - r * 0.18} ${x} ${y - r} Z" fill="${fill}"/>`;
}

function extras(list = []) {
  return list.map((kind) => {
    if (kind === 'sparkles') return sparkle(68, 120, 22) + sparkle(338, 168, 16, '#ffffff') + sparkle(350, 92, 12);
    if (kind === 'sweat') return '<path d="M318 150 Q332 176 318 186 Q304 176 318 150 Z" fill="#8fd3ff" stroke="#3b2433" stroke-width="3"/>';
    if (kind === 'tear') return '<path d="M262 252 Q272 274 262 282 Q252 274 262 252 Z" fill="#8fd3ff"/>';
    return '';
  }).join('');
}

// Cheveux a l arriere du visage selon la coiffure.
function hairBack(style, color) {
  if (style === 'short') return `<path d="M76 214 Q70 92 200 80 Q330 92 324 214 Q306 150 200 142 Q94 150 76 214 Z" fill="${color}"/>`;
  if (style === 'bun') {
    return `<circle cx="200" cy="72" r="40" fill="${color}"/><path d="M168 98 Q200 112 232 98 L230 84 Q200 96 170 84 Z" fill="#ffffff" opacity="0.5"/>`
      + `<path d="M76 214 Q70 92 200 80 Q330 92 324 214 Q306 150 200 142 Q94 150 76 214 Z" fill="${color}"/>`;
  }
  return `<path d="M68 232 Q58 88 200 74 Q342 88 332 232 L338 332 Q304 352 272 322 L128 322 Q96 352 62 332 Z" fill="${color}"/>`;
}

function accessory(kind, palette) {
  if (kind === 'bow') {
    return `<path d="M282 96 L322 70 L326 116 Z" fill="${palette.bow}"/><path d="M282 96 L248 74 L252 118 Z" fill="${palette.bow}"/><circle cx="284" cy="96" r="11" fill="${palette.bow}" stroke="#ffffff" stroke-width="3"/>`;
  }
  if (kind === 'glasses') {
    const ring = (cx) => `<circle cx="${cx}" cy="228" r="34" fill="#ffffff" fill-opacity="0.18" stroke="${INK}" stroke-width="6"/>`;
    return `${ring(150)}${ring(250)}<path d="M184 226 Q200 216 216 226" stroke="${INK}" stroke-width="6" fill="none"/>`;
  }
  return '';
}

function head(expression, palette) {
  const spec = AVATAR_EXPRESSIONS[expression] || AVATAR_EXPRESSIONS.neutral;
  const blush = spec.blush ?? 0.55;
  return [
    // Cheveux (arriere), visage, frange, accessoire.
    hairBack(palette.hairStyle, palette.hair),
    `<ellipse cx="200" cy="216" rx="120" ry="110" fill="${palette.skin}"/>`,
    `<path d="M80 204 Q84 102 200 96 Q316 102 320 204 Q292 160 252 150 Q236 176 205 160 Q180 182 150 156 Q114 166 80 204 Z" fill="${palette.hair}"/>`,
    `<ellipse cx="128" cy="262" rx="24" ry="13" fill="${palette.blush}" opacity="${blush}"/>`,
    `<ellipse cx="272" cy="262" rx="24" ry="13" fill="${palette.blush}" opacity="${blush}"/>`,
    palette.accessory === 'bow' ? accessory('bow', palette) : '',
    brows(spec.brows),
    eye(spec.eyes, 150, 228, -1),
    eye(spec.eyes, 250, 228, 1),
    palette.accessory === 'glasses' ? accessory('glasses', palette) : '',
    mouth(spec.mouth),
    extras(spec.extras),
  ].join('');
}

function body(pose, palette) {
  const sleeve = `fill="${palette.top}" stroke="${INK}" stroke-width="4"`;
  const hand = (x, y) => `<circle cx="${x}" cy="${y}" r="20" fill="${palette.skin}" stroke="${INK}" stroke-width="4"/>`;
  let arms;
  let front = '';
  if (pose === 'wave') {
    arms = `<path d="M128 380 Q92 450 104 540 L138 540 Q132 460 150 410 Z" ${sleeve}/>${hand(120, 548)}`;
    // Le bras leve passe DEVANT la tete (dessine apres elle), sinon il disparait derriere les cheveux.
    front = `<path d="M262 384 Q336 362 352 268 L380 276 Q362 384 280 414 Z" ${sleeve}/>${hand(368, 254)}`;
  } else if (pose === 'point') {
    arms = `<path d="M128 380 Q92 450 104 540 L138 540 Q132 460 150 410 Z" ${sleeve}/>${hand(120, 548)}`
      + `<path d="M266 384 Q330 396 384 386 L382 418 Q326 430 262 420 Z" ${sleeve}/>${hand(392, 402)}`;
  } else {
    arms = `<path d="M128 380 Q92 450 104 540 L138 540 Q132 460 150 410 Z" ${sleeve}/>${hand(120, 548)}`
      + `<path d="M272 380 Q308 450 296 540 L262 540 Q268 460 250 410 Z" ${sleeve}/>${hand(280, 548)}`;
  }
  const behind = [
    `<rect x="182" y="300" width="36" height="46" fill="${palette.skin}"/>`,
    `<path d="M112 600 Q108 392 200 346 Q292 392 288 600 Z" fill="${palette.top}" stroke="${INK}" stroke-width="4"/>`,
    `<path d="M168 350 Q200 380 232 350 Q218 372 200 374 Q182 372 168 350 Z" fill="${palette.collar}"/>`,
    sparkle(158, 470, 14, '#ffffff'),
    arms,
  ].join('');
  return { behind, front };
}

/**
 * Pur : SVG de l avatar. `mode` = 'head' (tete seule) ou 'body' (buste).
 * Le contour blanc facon autocollant et l ombre portee sont dans le filtre.
 */
/**
 * `look` (reglages de la DA) : { hair, hairColor, skin, accessory, top }.
 * `accent` colore le noeud. Sans `look`, l avatar d origine (cheveux longs, noeud).
 */
export function buildChibiSvg({ expression = 'neutral', mode = 'head', pose = 'idle', palette = {}, look = null, accent = '', id = 'av' } = {}) {
  const colors = { hairStyle: 'long', accessory: 'bow', ...DEFAULT_AVATAR_PALETTE, ...palette };
  if (look) {
    colors.hairStyle = look.hair || 'long';
    colors.hair = look.hairColor || colors.hair;
    colors.skin = look.skin || colors.skin;
    colors.top = look.top || colors.top;
    colors.accessory = look.accessory || 'none';
  }
  if (accent) colors.bow = accent;
  const isBody = mode === 'body';
  const viewBox = isBody ? '0 40 420 580' : '30 50 340 320';
  const filterId = `fl-sticker-${id}`;
  const parts = isBody ? body(pose, colors) : { behind: '', front: '' };

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="100%" height="100%" overflow="visible">`
    + `<defs><filter id="${filterId}" x="-25%" y="-25%" width="150%" height="150%">`
    + '<feMorphology in="SourceAlpha" operator="dilate" radius="9" result="d"/>'
    + '<feFlood flood-color="#ffffff"/><feComposite in2="d" operator="in" result="outline"/>'
    + '<feGaussianBlur in="d" stdDeviation="5" result="b"/><feOffset in="b" dx="6" dy="10" result="o"/>'
    + '<feFlood flood-color="#7a3b52" flood-opacity="0.28"/><feComposite in2="o" operator="in" result="shadow"/>'
    + '<feMerge><feMergeNode in="shadow"/><feMergeNode in="outline"/><feMergeNode in="SourceGraphic"/></feMerge>'
    + '</filter></defs>'
    + `<g filter="url(#${filterId})">${parts.behind}${head(expression, colors)}${parts.front}</g>`
    + '</svg>';
}
