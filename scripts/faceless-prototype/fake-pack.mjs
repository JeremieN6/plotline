// Verification GRATUITE du pack d avatars : l avatar dessine est pose sur un fond
// vert uni (comme le fera le modele d image), detoure par le meme code que les
// vraies images, puis rendu dans l apercu de DA. Aucun appel payant.
// Usage : node scripts/faceless-prototype/fake-pack.mjs [preset] [FEMALE|MALE]
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import sharp from 'sharp';

import { buildChibiSvg } from '../../server/utils/facelessAvatar.js';
import { keyAndTrimPng } from '../../server/utils/facelessAvatarPack.js';
import { renderStylePreview } from '../../server/utils/facelessPreview.js';
import { defaultFacelessStyle } from '../../server/utils/facelessStyle.js';

const out = resolve('tmp/faceless/out/fakepack');
mkdirSync(out, { recursive: true });

const preset = process.argv[2] || 'brutalisme';
const gender = process.argv[3] || 'MALE';
const style = defaultFacelessStyle(preset, gender);

const specs = [
  { id: 'happy', mode: 'head', expression: 'happy' },
  { id: 'thinking', mode: 'head', expression: 'thinking' },
  { id: 'body-wave', mode: 'body', expression: 'happy', pose: 'wave' },
];

const packEntries = {};
for (const spec of specs) {
  const svg = buildChibiSvg({ expression: spec.expression, mode: spec.mode, pose: spec.pose || 'idle', look: style.avatar.svg, accent: style.palette.accent, id: spec.id });
  const drawing = await sharp(Buffer.from(svg), { density: 110 }).resize({ width: 640, height: 640, fit: 'inside' }).png().toBuffer();
  // Fond vert 1024 x 1024 : ce que renverrait le modele d image.
  const onGreen = await sharp({ create: { width: 1024, height: 1024, channels: 3, background: { r: 0, g: 255, b: 0 } } })
    .composite([{ input: drawing, gravity: 'center' }]).png().toBuffer();
  const keyed = await keyAndTrimPng(onGreen);
  const file = join(out, `${spec.id}.png`);
  writeFileSync(file, keyed);
  const meta = await sharp(keyed).metadata();
  console.log(`${spec.id}: ${meta.width}x${meta.height}, alpha=${meta.hasAlpha}`);
  packEntries[spec.id] = { mode: spec.mode, url: file };
}

const jpeg = await renderStylePreview({ style, packEntries, readMedia: async (url) => readFileSync(url) });
const file = join(out, `apercu-${preset}-${gender.toLowerCase()}.jpg`);
writeFileSync(file, jpeg);
console.log(file);
