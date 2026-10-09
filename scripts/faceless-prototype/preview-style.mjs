// Apercu gratuit de DA (aucun appel payant) : rend la bande de 3 images d un
// ou plusieurs presets, avec un avatar feminin ou masculin.
// Usage : node scripts/faceless-prototype/preview-style.mjs [preset] [FEMALE|MALE]
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { defaultFacelessStyle } from '../../server/utils/facelessStyle.js';
import { renderStylePreview } from '../../server/utils/facelessPreview.js';

const out = resolve('tmp/faceless/out/styles');
mkdirSync(out, { recursive: true });

const presets = process.argv[2] ? [process.argv[2]] : ['papercraft-pastel', 'brutalisme'];
const gender = process.argv[3] || 'FEMALE';

for (const preset of presets) {
  const started = Date.now();
  const style = defaultFacelessStyle(preset, gender);
  const jpeg = await renderStylePreview({ style });
  const file = join(out, `${preset}-${gender.toLowerCase()}.jpg`);
  writeFileSync(file, jpeg);
  console.log(`${file} (${((Date.now() - started) / 1000).toFixed(1)} s)`);
}
