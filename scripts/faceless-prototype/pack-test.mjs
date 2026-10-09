// ESSAI PAYANT du pack d avatars (3 images au plus : ~0,40 $) avec une vraie fiche de reference.
// Fait ce que fera l interface : image de base -> 2 images du pack (une tete, un buste) ->
// detourage -> apercu de DA. S arrete a la premiere erreur (aucun appel de plus).
// Usage : node scripts/faceless-prototype/pack-test.mjs <fiche-de-reference.jpg> [id1] [id2]
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}

const { generateImageFromGeminiWithSafetyFallback } = await import('../../server/utils/geminiImageGeneration.js');
const { generateBaseAvatar, generatePackEntry } = await import('../../server/utils/facelessAvatarPack.js');
const { findCatalogEntry } = await import('../../server/data/facelessAvatarCatalog.js');
const { renderStylePreview } = await import('../../server/utils/facelessPreview.js');
const { defaultFacelessStyle } = await import('../../server/utils/facelessStyle.js');

const referencePath = resolve(process.argv[2] || '');
const ids = [process.argv[3] || 'happy', process.argv[4] || 'body-wave'];
const out = resolve('tmp/faceless/out/pack-test');
mkdirSync(out, { recursive: true });

const style = defaultFacelessStyle('papercraft-pastel', 'FEMALE');
let counter = 0;
const deps = {
  generate: async (prompt, parts) => {
    counter += 1;
    console.log(`appel payant ${counter}/3...`);
    return generateImageFromGeminiWithSafetyFallback(prompt, parts);
  },
  save: async (buffer, { extension }) => {
    const file = join(out, `image-${counter}.${extension}`);
    writeFileSync(file, buffer);
    return file;
  },
};

const started = Date.now();
const baseUrl = await generateBaseAvatar({
  referenceBuffer: readFileSync(referencePath),
  referenceMime: 'image/jpeg',
  avatarPrompt: style.avatarPrompt,
  deps,
});
console.log(`base : ${baseUrl} (${((Date.now() - started) / 1000).toFixed(0)} s)`);
const baseBuffer = readFileSync(baseUrl);

const packEntries = {};
for (const id of ids) {
  const entry = findCatalogEntry(id);
  const url = await generatePackEntry({ baseBuffer, entry, avatarPrompt: style.avatarPrompt, deps });
  console.log(`${id} : ${url}`);
  packEntries[id] = { mode: entry.mode, url };
}

const jpeg = await renderStylePreview({ style, packEntries, readMedia: async (url) => readFileSync(url) });
writeFileSync(join(out, 'apercu.jpg'), jpeg);
console.log(`OK en ${((Date.now() - started) / 1000).toFixed(0)} s : ${join(out, 'apercu.jpg')}`);
