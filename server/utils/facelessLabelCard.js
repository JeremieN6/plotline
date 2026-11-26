// Etiquette de produit hors Herbier (qui a son propre dessin) : UNE carte commune a toutes les DA, pour que rien ne
// disparaisse quand on change de DA : jusqu a 8 ingredients, leur verdict et la phrase de conclusion. La DA apporte sa
// police (heritee de la page) et sa couleur d accent. Pur.

const VERDICTS = {
  avoid: { mark: '✕', word: 'à éviter', tone: 'avoid' },
  watch: { mark: '!', word: 'à surveiller', tone: 'watch' },
  good: { mark: '✓', word: 'bon', tone: 'good' },
};
const NEUTRAL = { mark: '•', word: '', tone: 'none' };

const ROW = 94;
const HEAD = 128;
const X = 80;
const WIDTH = 920;

const esc = (value) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const plain = (value) => esc(String(value ?? '').replace(/\*\*/g, ''));

/** Pur : le verdict d un ingredient (symbole, mot court de la scene ou mot par defaut, ton). */
export function labelVerdict(item) {
  const verdict = VERDICTS[item?.tone] || NEUTRAL;
  return { ...verdict, word: String(item?.sub || '').trim() || verdict.word };
}

/** Pur (via `fx`) : HTML de la carte ; chaque ligne entre sur le mot dit qui la nomme (`item.at`). */
export function labelCardHtml(scene, { fx }) {
  const items = (scene.items || []).slice(0, 8);
  const foot = String(scene.text || '').trim() ? 150 : 30;
  const height = HEAD + items.length * ROW + foot;
  const top = Math.max(400, Math.round(960 - height / 2));
  const still = { fixedEnter: true, rot: 0, boil: 0 };
  const card = fx(`<div class="lc-card" style="height:${height}px"><div class="lc-title" data-fit-w="${WIDTH - 100}">${plain(scene.title || 'Étiquette')}</div></div>`,
    { x: X, y: top, w: WIDTH, h: height, enter: 'card', z: 2, ...still });
  const rows = items.map((item, i) => {
    const verdict = labelVerdict(item);
    return fx(`<div class="lc-row ${verdict.tone}"><span class="lc-mark">${verdict.mark}</span><span class="lc-name"><span data-fit-w="${verdict.word ? 470 : 700}">${plain(item.text)}</span></span>`
      + `${verdict.word ? `<span class="lc-word">${plain(verdict.word)}</span>` : ''}</div>`,
    { x: X + 36, y: top + HEAD + i * ROW, w: WIDTH - 72, h: ROW - 14, enter: 'card', at: Number(item.at) || 0, z: 3, ...still });
  }).join('');
  const verdictLine = String(scene.text || '').trim()
    ? fx(`<div class="lc-foot" data-fit-w="${WIDTH - 70}" data-fit-h="130">${plain(scene.text)}</div>`,
      { x: X + 40, y: top + HEAD + items.length * ROW + 8, w: WIDTH - 80, enter: 'card', at: Number(items[items.length - 1]?.at) || 0, z: 3, ...still })
    : '';
  return card + rows + verdictLine;
}

/** Pur : feuille de style de la carte (fond clair constant : lisible sur toutes les DA, claires ou sombres). */
export function labelCardCss(accent) {
  const color = /^#[0-9a-f]{6}$/i.test(String(accent || '')) ? accent : '#4f46e5';
  return `
.lc-card{background:#fffdf9;border:4px solid ${color};border-radius:36px;box-shadow:0 24px 56px rgba(15,23,42,.22)}
.lc-title{display:inline-block;margin:36px 0 0 50px;font-size:50px;line-height:1.1;font-weight:700;color:#14161c;white-space:nowrap}
.lc-row{height:100%;display:flex;align-items:center;gap:24px;padding:0 24px;border-radius:20px;background:#f2f1ec;color:#14161c}
.lc-row.avoid{background:#fbe3e0}.lc-row.watch{background:#fbefd2}.lc-row.good{background:#ddf0e3}
.lc-mark{flex:0 0 52px;height:52px;border-radius:50%;display:flex;align-items:center;justify-content:center;font:700 32px sans-serif;color:#fff;background:#6b7280}
.avoid .lc-mark{background:#b3261e}.watch .lc-mark{background:#a86a00}.good .lc-mark{background:#1f7a44}
.lc-name{flex:1;min-width:0;font-size:42px;font-weight:700;white-space:nowrap;overflow:hidden}
.lc-name span{display:inline-block}
.lc-word{flex:0 0 auto;max-width:250px;overflow:hidden;white-space:nowrap;font-size:30px;font-weight:700;color:#3f4350}
.lc-foot{display:inline-block;width:100%;font-size:40px;line-height:1.2;font-weight:700;text-align:center;color:#14161c}
`;
}
