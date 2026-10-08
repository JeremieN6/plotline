// Essai de bout en bout du pipeline faceless SANS base de donnees ni Blob :
// idee -> plan Claude -> voix ElevenLabs -> rendu. Couts : un appel Claude
// (quelques centimes) + des caracteres ElevenLabs.
// Usage : node scripts/faceless-prototype/e2e.mjs "idee" [duree] [voiceId]
//    ou : node scripts/faceless-prototype/e2e.mjs plan.json   (reprend un plan, sans Claude)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}

const { produceFacelessVideo } = await import('../../server/utils/facelessVideoJob.js');
const arg = process.argv[2] || '3 business simples a lancer avec 0 euro : affiliation, produit digital, communaute.';
const givenPlan = arg.endsWith('.json') ? JSON.parse(readFileSync(arg, 'utf8')) : null;
const started = Date.now();
const { video, plan, duration } = await produceFacelessVideo({
  idea: givenPlan ? '' : arg,
  plan: givenPlan,
  targetSeconds: Number(process.argv[3] || 30),
  voiceId: process.argv[4] || 'cgSgspJ2msm6clMCkdW9',
  captions: true,
  onStep: (step) => console.log(`${((Date.now() - started) / 1000).toFixed(0)} s : ${step}`),
});
const out = join('tmp/faceless/out');
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'e2e.mp4'), video);
writeFileSync(join(out, 'e2e-plan.json'), JSON.stringify(plan, null, 2));
console.log(`OK : ${duration.toFixed(1)} s de video, ${plan.scenes.length} scenes, ${plan.scenes.map((s) => s.say).join(' ').length} caracteres dits, ${((Date.now() - started) / 1000).toFixed(0)} s au total`);
