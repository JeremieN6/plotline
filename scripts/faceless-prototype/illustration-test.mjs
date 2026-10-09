// ESSAI PAYANT des illustrations de scene (2 images : ~0,27 $). Utilise exactement le code du
// produit (prompts, nettoyage JPEG) sans base de donnees ni Blob : les fichiers vont dans
// tmp/faceless/out/illustration-test/. S arrete a la premiere erreur.
// Usage : node scripts/faceless-prototype/illustration-test.mjs
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}

const { generateIllustration } = await import('../../server/utils/facelessIllustration.js');
const { generateImageFromGeminiWithSafetyFallback } = await import('../../server/utils/geminiImageGeneration.js');
const { defaultFacelessStyle } = await import('../../server/utils/facelessStyle.js');

const out = resolve('tmp/faceless/out/illustration-test');
mkdirSync(out, { recursive: true });

const style = defaultFacelessStyle('papercraft-pastel', 'FEMALE');
const persona = { gender: 'FEMALE', niche: 'organisation et routine du matin' };
let counter = 0;
const deps = {
  generate: async (prompt) => {
    counter += 1;
    console.log(`appel payant ${counter}/2...`);
    return generateImageFromGeminiWithSafetyFallback(prompt);
  },
  save: async (buffer) => {
    const file = join(out, `illustration-${counter}.jpg`);
    writeFileSync(file, buffer);
    return file;
  },
};

const jobs = [
  { kind: 'photo', prompt: 'a coffee cup and an open notebook with a pen on a wooden desk, soft morning light from a window' },
  { kind: 'mockup', prompt: 'a to-do list app with three checked tasks and a progress bar' },
];

for (const job of jobs) {
  const started = Date.now();
  const entry = await generateIllustration({ ...job, style, persona, deps });
  console.log(`${job.kind} : ${entry.url} (${((Date.now() - started) / 1000).toFixed(0)} s)`);
}
