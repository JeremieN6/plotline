// Essai de bout en bout du pipeline faceless SANS base de donnees ni Blob.
// Couts : un appel Claude (quelques centimes) + des caracteres ElevenLabs
// (aucun pour une retouche qui ne change pas le texte dit).
//
// Usage :
//   node scripts/faceless-prototype/e2e.mjs "idee" [duree] [voiceId]
//   node scripts/faceless-prototype/e2e.mjs plan.json                  (reprend un plan, sans Claude)
//   node scripts/faceless-prototype/e2e.mjs --retouch "consigne"       (retouche le dernier essai)
//   node scripts/faceless-prototype/e2e.mjs --render                   (re-monte le dernier essai : AUCUN appel payant)
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}

const { produceFacelessVideo, renderFacelessFromPlan, retouchFacelessVideo, RENDER_SPEC_KIND } = await import('../../server/utils/facelessVideoJob.js');
const out = resolve('tmp/faceless/out');
mkdirSync(out, { recursive: true });
const started = Date.now();
const onStep = (step) => console.log(`${((Date.now() - started) / 1000).toFixed(0)} s : ${step}`);
const specPath = join(out, 'e2e-spec.json');

if (process.argv[2] === '--render') {
  const spec = JSON.parse(readFileSync(specPath, 'utf8'));
  const { video, duration } = await renderFacelessFromPlan(spec.plan, { audio: readFileSync(spec.voiceUrl), words: spec.words });
  writeFileSync(join(out, 'e2e-render.mp4'), video);
  console.log(`OK : ${duration.toFixed(1)} s re-montees sans appel payant, ${((Date.now() - started) / 1000).toFixed(0)} s`);
} else if (process.argv[2] === '--retouch') {
  const spec = JSON.parse(readFileSync(specPath, 'utf8'));
  const n = (spec.retouches?.length || 0) + 1;
  const { video, plan, voice, newVoice, duration } = await retouchFacelessVideo({ spec, instruction: process.argv[3], onStep });
  const voicePath = newVoice ? join(out, `e2e-voice-v${n + 1}.mp3`) : spec.voiceUrl;
  if (newVoice) writeFileSync(voicePath, voice.audio);
  writeFileSync(join(out, `e2e-v${n + 1}.mp4`), video);
  writeFileSync(specPath, JSON.stringify({ ...spec, plan, voiceUrl: voicePath, words: voice.words, retouches: [...(spec.retouches || []), process.argv[3]] }, null, 2));
  console.log(`OK : v${n + 1}, ${duration.toFixed(1)} s, voix ${newVoice ? 'REGENEREE' : 'reutilisee'}, ${((Date.now() - started) / 1000).toFixed(0)} s au total`);
} else {
  const arg = process.argv[2] || '3 business simples a lancer avec 0 euro : affiliation, produit digital, communaute.';
  const givenPlan = arg.endsWith('.json') ? JSON.parse(readFileSync(arg, 'utf8')) : null;
  const voiceId = process.argv[4] || 'cgSgspJ2msm6clMCkdW9';
  const targetSeconds = Number(process.argv[3] || 30);
  const { video, plan, voice, duration } = await produceFacelessVideo({
    idea: givenPlan ? '' : arg, plan: givenPlan, targetSeconds, voiceId, captions: true, onStep,
  });
  const voicePath = join(out, 'e2e-voice.mp3');
  writeFileSync(voicePath, voice.audio);
  writeFileSync(join(out, 'e2e.mp4'), video);
  writeFileSync(join(out, 'e2e-plan.json'), JSON.stringify(plan, null, 2));
  writeFileSync(specPath, JSON.stringify({ kind: RENDER_SPEC_KIND, idea: arg, voiceId, targetSeconds, captions: true, plan, voiceUrl: voicePath, words: voice.words }, null, 2));
  console.log(`OK : ${duration.toFixed(1)} s de video, ${plan.scenes.length} scenes, ${plan.scenes.map((s) => s.say).join(' ').length} caracteres dits, ${((Date.now() - started) / 1000).toFixed(0)} s au total`);
}
