// Produit les bruitages synthetises de la video faceless dans resources/faceless/sfx/
// (un WAV par nom du catalogue). A relancer apres toute modification de
// server/utils/facelessSfxSynth.js.
// Usage : node scripts/faceless-sfx/generate.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { FACELESS_SFX } from '../../server/data/facelessCatalog.js';
import { encodeWav, synthesizeSfx } from '../../server/utils/facelessSfxSynth.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const outDir = join(root, 'resources/faceless/sfx');

for (const name of Object.keys(FACELESS_SFX)) {
  const file = join(outDir, `${name}.wav`);
  mkdirSync(dirname(file), { recursive: true });
  const samples = synthesizeSfx(name);
  writeFileSync(file, encodeWav(samples));
  console.log(`${name}.wav  ${(samples.length / 48000).toFixed(2)} s`);
}
