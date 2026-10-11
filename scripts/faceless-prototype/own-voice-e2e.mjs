// Essai de bout en bout du mode "ma voix" SANS base de donnees ni Blob.
// Couts : transcription ElevenLabs Scribe (quelques secondes d audio) + 2 appels Claude (quelques centimes).
//
// Usage : node scripts/faceless-prototype/own-voice-e2e.mjs <enregistrement.wav|mp3|m4a...> ["idee"]
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}

const { produceOwnVoiceVideo } = await import('../../server/utils/facelessOwnVoice.js');

const file = process.argv[2];
if (!file) throw new Error('Usage : own-voice-e2e.mjs <enregistrement> ["idee"]');
const out = resolve('tmp/faceless/out');
mkdirSync(out, { recursive: true });
const started = Date.now();

const result = await produceOwnVoiceVideo({
  audio: readFileSync(file),
  idea: process.argv[3] || '',
  onStep: (step) => console.log(`${((Date.now() - started) / 1000).toFixed(0)} s : ${step}`),
});

writeFileSync(join(out, 'own-voice.mp4'), result.video);
writeFileSync(join(out, 'own-voice-voice.mp3'), result.voice.audio);
writeFileSync(join(out, 'own-voice-report.json'), JSON.stringify({ report: result.report, plan: result.plan, words: result.voice.words }, null, 2));
console.log(`OK : ${result.duration.toFixed(1)} s, ${result.report.wordsHeard} mots entendus, ${result.report.wordsKept} gardes`);
console.log('coupes :', JSON.stringify(result.report.cuts));
console.log('indications :', JSON.stringify(result.report.directives));
console.log('scenes :', result.plan.scenes.map((s) => `${s.layout} « ${s.say} »`).join('\n         '));
