// Verification GRATUITE de la mise en page "photo" : une fausse image (degrade + formes)
// est cadree dans plusieurs DA. Aucun appel payant.
// Usage : node scripts/faceless-prototype/photo-check.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import sharp from 'sharp';

import { renderFacelessStills } from '../../server/utils/facelessRenderer.js';
import { buildFacelessHtml } from '../../server/utils/facelessTemplate.js';
import { layoutFacelessTimelineFromTrack } from '../../server/utils/facelessTimeline.js';
import { defaultFacelessStyle } from '../../server/utils/facelessStyle.js';

const out = resolve('tmp/faceless/out/photo-check');
mkdirSync(out, { recursive: true });

const ID = 'ill-test123456';
const photo = await sharp(Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1250"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffd7b5"/><stop offset="1" stop-color="#7aa7d9"/></linearGradient></defs>'
  + '<rect width="1000" height="1250" fill="url(#g)"/><rect x="120" y="640" width="760" height="420" rx="30" fill="#3a3a48"/><rect x="170" y="690" width="660" height="300" rx="14" fill="#cfe3ff"/>'
  + '<circle cx="780" cy="330" r="110" fill="#fff6c9"/><rect x="300" y="1050" width="400" height="40" rx="20" fill="#2b2b36"/></svg>',
)).jpeg({ quality: 88 }).toBuffer();
const assets = new Map([[`/illustration/${ID}.jpg`, photo]]);

const plan = { scenes: [
  { say: 'Mon bureau ce matin.', layout: 'photo', image: ID, text: 'Mon bureau le matin', bg: 'main', avatar: { mode: 'head', beats: [{ at: 0, expr: 'happy' }] } },
  { say: 'Suite.', layout: 'avatar', text: 'Suite', bg: 'main', avatar: { mode: 'body', pose: 'wave', beats: [{ at: 0, expr: 'happy' }] } },
] };
const words = [{ text: 'Mon', start: 0, end: 0.3 }, { text: 'bureau', start: 0.3, end: 0.7 }, { text: 'ce', start: 0.7, end: 0.9 }, { text: 'matin.', start: 0.9, end: 1.3 }, { text: 'Suite.', start: 1.6, end: 2.0 }];

const tiles = [];
for (const key of ['papercraft-pastel', 'brutalisme', 'cahier-ecolier', 'luxe-minimal']) {
  const style = defaultFacelessStyle(key, 'FEMALE');
  const timeline = layoutFacelessTimelineFromTrack(plan, { path: 'v', duration: 2, words }, { leadIn: 0, gap: 0, tail: 0.5, visualLead: 0 });
  const html = buildFacelessHtml(timeline, { style, illustrations: { [ID]: { kind: 'photo', label: 'Bureau', url: 'x' } } });
  const { stills } = await renderFacelessStills({ html, times: [1.0], assets });
  tiles.push(await sharp(stills[0].png).resize(360, 640).png().toBuffer());
  console.log(key);
}
await sharp({ create: { width: tiles.length * 374, height: 640, channels: 3, background: '#ffffff' } })
  .composite(tiles.map((input, i) => ({ input, left: i * 374, top: 0 })))
  .jpeg({ quality: 86 }).toFile(join(out, 'planche.jpg'));
console.log(join(out, 'planche.jpg'));
