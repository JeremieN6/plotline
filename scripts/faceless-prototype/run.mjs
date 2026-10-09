// Prototype video faceless (etape 0, gratuit) : plan de montage JSON ->
// voix Windows -> timeline -> page HTML -> capture image par image -> MP4.
// Usage : node scripts/faceless-prototype/run.mjs [plan.json] [dossier des bruitages]
import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { layoutFacelessTimeline } from '../../server/utils/facelessTimeline.js';
import { buildFacelessHtml } from '../../server/utils/facelessTemplate.js';
import { measureTrimmedDuration, mixFacelessAudio, renderFacelessVideo } from '../../server/utils/facelessRenderer.js';

const execFileAsync = promisify(execFile);
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');

const specPath = resolve(process.argv[2] || join(here, 'demo.json'));
const sfxDir = resolve(process.argv[3] || join(root, 'resources/faceless/sfx'));
const outDir = join(root, 'tmp/faceless/out');
const voiceDir = join(outDir, 'voice');

/** Les evenements de la voix Windows donnent une position de caractere : on retrouve le mot du texte (ponctuation comprise). */
function eventsToWords(text, events) {
  const tokens = [...text.matchAll(/\S+/g)].map((m) => ({ text: m[0], from: m.index, to: m.index + m[0].length }));
  const words = [];
  let lastToken = -1;
  for (const event of events) {
    const index = tokens.findIndex((t) => event.pos >= t.from && event.pos < t.to);
    if (index <= lastToken || index === -1) continue;
    words.push({ text: tokens[index].text, start: event.ms / 1000 });
    lastToken = index;
  }
  return words;
}

const spec = JSON.parse(await readFile(specPath, 'utf8'));
await mkdir(voiceDir, { recursive: true });

console.log('1/4 voix de synthese Windows...');
const lines = spec.scenes.map((scene, i) => ({ id: `line-${i}`, text: scene.say }));
await writeFile(join(voiceDir, 'lines.json'), JSON.stringify(lines), 'utf8');
await execFileAsync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', join(here, 'tts-windows.ps1'), join(voiceDir, 'lines.json'), voiceDir]);
const spoken = JSON.parse((await readFile(join(voiceDir, 'words.json'), 'utf8')).replace(/^﻿/, ''));
const spokenList = Array.isArray(spoken) ? spoken : [spoken];

const clips = [];
for (const [i, item] of spokenList.entries()) {
  const events = Array.isArray(item.events) ? item.events : [item.events].filter(Boolean);
  clips.push({ path: item.wav, duration: await measureTrimmedDuration(item.wav), words: eventsToWords(lines[i].text, events) });
}

console.log('2/4 timeline + page HTML...');
const timeline = layoutFacelessTimeline(spec, clips);
const html = buildFacelessHtml(timeline);
await writeFile(join(outDir, 'timeline.json'), JSON.stringify(timeline, null, 2), 'utf8');
await writeFile(join(outDir, 'page.html'), html, 'utf8');

console.log(`3/4 mixage audio (${timeline.duration.toFixed(1)} s)...`);
const audioRaw = join(outDir, 'mix.f32');
await mixFacelessAudio([
  ...timeline.voice.map((v) => ({ path: v.path, start: v.start, gain: 1, trimTail: true })),
  ...timeline.sfx.map((s) => ({ path: join(sfxDir, `${s.name}.wav`), start: s.start, gain: s.gain })),
], timeline.duration, audioRaw);

console.log('4/4 rendu image par image...');
const started = Date.now();
const output = join(outDir, 'demo.mp4');
await renderFacelessVideo({
  html, timeline, audioRawPath: audioRaw, outputPath: output,
  onProgress: (p) => process.stdout.write(`\r   ${Math.round(p * 100)} %`),
});
console.log(`\nOK : ${output} (${((Date.now() - started) / 1000).toFixed(0)} s de rendu)`);
