// L ECRAN (ordinateur ou telephone) est un choix de la video, disponible dans toutes les DA : la DA dessine la scene comme
// d habitude, le moteur la place dans l appareil, sur un fond doux. Le Dashboard garde son propre cadre d ordinateur.
// Ce module est pur ; `computerGeometry` et `phoneGeometry` sont aussi injectees telles quelles dans la page de rendu.

/** Pur : ecran effectif d une DA. Les DA d avant n ont que `screenFrame`, qui n a jamais concerne que le Dashboard. */
export function resolveScreen(style) {
  if (style?.screen === 'computer' || style?.screen === 'phone') return style.screen;
  return style?.screenFrame && style?.template === 'dashboard' ? 'computer' : 'none';
}

/**
 * Pur : fenetre d ordinateur ajustee a la hauteur du contenu { top, bottom } de la scene (unites 1080 x 1920).
 * La fenetre reste entre les sous-titres du haut et la zone couverte par l interface des reseaux ; un contenu trop haut
 * est reduit en entier, jamais rogne.
 */
export function computerGeometry({ top, bottom }, capBottom) {
  const width = 940, bar = 84, minTop = 330, maxBottom = capBottom ? 1500 : 1700;
  const boxH = Math.max(bottom - top + 140, 640);
  // La zone montree reste dans la scene : au-dela de ses bords il n y a pas de fond (bande vide dans la fenetre).
  const boxTop = Math.max(0, Math.min(1920 - boxH, (top + bottom) / 2 - boxH / 2));
  const scale = Math.min(width / 1080, (maxBottom - minTop - bar) / boxH);
  const screenH = Math.round(boxH * scale);
  const height = bar + screenH;
  return {
    width,
    bar,
    scale,
    screenH,
    height,
    left: (1080 - width) / 2,
    y: Math.max(minTop, Math.min(maxBottom - height, Math.round(1000 - height / 2))),
    canvasLeft: Math.round((width - 1080 * scale) / 2),
    canvasTop: -Math.round(boxTop * scale),
  };
}

/** Pur : telephone qui montre la scene entiere (9:16) ; un peu plus petit quand les sous-titres sont en bas. */
export function phoneGeometry(capBottom) {
  const bez = 22, height = capBottom ? 1160 : 1280;
  const screenH = height - 2 * bez;
  const screenW = Math.round((screenH * 1080) / 1920);
  const width = screenW + 2 * bez;
  return { bez, width, height, screenW, screenH, scale: screenW / 1080, left: Math.round((1080 - width) / 2), y: capBottom ? 340 : 360 };
}

const attr = (value) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Pur : le contenu d une scene (son fond compris) place dans l appareil. */
export function wrapInDevice(inner, { device, dark = false, address = '' }) {
  const bar = device === 'computer'
    ? `<div class="dv-bar"><i></i><i></i><i></i><span class="dv-address">${attr(address)}</span></div>`
    : '';
  return `<div class="dv-back${dark ? ' dk' : ''}"></div><div class="dv-box dv-${device}${dark ? ' dk' : ''}">${bar}`
    + `<div class="dv-screen"><div class="dv-canvas">${inner}</div></div></div>`;
}

/** Pur : feuille de style de l appareil et du fond doux, teinte tres legerement par la couleur de la DA. */
export function deviceCss(accent) {
  const rgb = /^#([0-9a-f]{6})$/i.exec(String(accent || ''));
  const [r, g, b] = rgb ? [0, 2, 4].map((i) => parseInt(rgb[1].slice(i, i + 2), 16)) : [99, 102, 241];
  const tint = (alpha) => `rgba(${r},${g},${b},${alpha})`;
  return `
.dv-back{position:absolute;inset:0;background:linear-gradient(135deg,${tint(0.14)},${tint(0.04)}),#e8eaf0}
.dv-back.dk{background:radial-gradient(circle at 50% 38%,${tint(0.2)},transparent 62%),#141722}
.dv-box{position:absolute;overflow:hidden}
.dv-canvas{position:absolute;left:0;top:0;width:1080px;height:1920px;transform-origin:0 0}
.dv-screen{position:relative;overflow:hidden;background:var(--bgc)}
.dv-computer{border-radius:34px;background:#fff;box-shadow:0 30px 70px rgba(15,23,42,.24)}
.dv-computer.dk{background:#1b2030;box-shadow:0 0 0 2px #333b52,0 30px 70px rgba(0,0,0,.5)}
.dv-bar{height:84px;display:flex;align-items:center;gap:16px;padding:0 38px;background:#f4f5f8;border-bottom:2px solid #e2e5ec}
.dv-computer.dk .dv-bar{background:#1b2030;border-color:#2c3348}
.dv-bar i{width:22px;height:22px;border-radius:50%;flex:0 0 auto;background:#ff5f57}
.dv-bar i:nth-child(2){background:#febc2e}
.dv-bar i:nth-child(3){background:#28c840}
.dv-address{margin-left:26px;flex:1;height:48px;border-radius:24px;background:#fff;border:2px solid #e2e5ec;display:flex;align-items:center;padding:0 30px;font:500 28px sans-serif;color:#6b7280;text-transform:none;overflow:hidden;white-space:nowrap}
.dv-computer.dk .dv-address{background:#121624;border-color:#2c3348;color:#94a3b8}
.dv-computer .full-deco{display:none}
.dv-phone{border-radius:104px;background:#0a0a0f;padding:22px;box-shadow:0 0 0 3px #2a2a35,0 30px 70px rgba(15,23,42,.34)}
.dv-phone.dk{box-shadow:0 0 0 3px #3b4258,0 30px 70px rgba(0,0,0,.55)}
.dv-phone .dv-screen{border-radius:82px}
.dv-phone .dv-screen::after{content:"";position:absolute;top:24px;left:50%;transform:translateX(-50%);width:190px;height:54px;border-radius:27px;background:#000;z-index:30}
`;
}
