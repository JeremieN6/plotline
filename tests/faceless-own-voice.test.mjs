import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildCutFilter, buildKeepSegments, keptIndices, normalizeCleaning, remapDirectives, splitIntoScenes, tokenizeTranscript,
} from '../server/utils/ownVoice.js';
import { buildScribeFields, transcribeWithScribe } from '../server/utils/elevenLabsStt.js';
import { cleanTranscript, detectAudioType, generateOwnVoicePlan, produceOwnVoiceVideo } from '../server/utils/facelessOwnVoice.js';
import { RECORDING_TIPS, generateOutline, sanitizeOutline } from '../server/utils/facelessOutline.js';
import { assignWordsToScenes, countSpokenTokens } from '../server/utils/facelessTimeline.js';

const raw = (list) => list.map(([text, start, end]) => ({ text, start, end, type: 'word' }));

test('tokenizeTranscript : ignore espaces et bruitages, indexe les mots', () => {
  const words = tokenizeTranscript([
    { text: 'Salut', start: 0, end: 0.4, type: 'word' },
    { text: ' ', start: 0.4, end: 0.5, type: 'spacing' },
    { text: '(rires)', start: 0.5, end: 0.9, type: 'audio_event' },
    { text: 'ça va', start: 1, end: 1.5, type: 'word' },
    { text: 'x', start: 'a', end: 2 },
  ]);
  assert.deepEqual(words.map((w) => [w.i, w.text]), [[0, 'Salut'], [1, 'ça'], [2, 'va']]);
});

test('normalizeCleaning : borne, trie et fusionne les plages ; ignore le reste', () => {
  const result = normalizeCleaning({
    cuts: [{ from: 5, to: 7 }, { from: 2, to: 3, reason: 'raté' }, { from: 8, to: 9 }, { from: 'x', to: 2 }, { from: 40, to: 50 }, { from: 6, to: 4 }],
    directives: [{ at: 3, instruction: ' change le fond ' }, { at: 99, instruction: 'hors' }, { at: 1, instruction: '' }],
  }, 12);
  assert.deepEqual(result.cuts.map((c) => [c.from, c.to]), [[2, 3], [5, 9]]);
  assert.deepEqual(result.directives, [{ at: 3, instruction: 'change le fond' }]);
  assert.deepEqual(normalizeCleaning(null, 5), { cuts: [], directives: [] });
});

test('buildKeepSegments : une reprise supprimee ne laisse ni trou ni mot parasite', () => {
  const words = tokenizeTranscript(raw([
    ['bonjour', 0.5, 1.0], ['a', 1.05, 1.2], ['tous', 1.25, 1.7],
    ['euh', 3.0, 3.3], ['bonjour', 3.4, 3.9], ['a', 3.95, 4.1],
    ['bonjour', 6.0, 6.5], ['a', 6.55, 6.7], ['tous', 6.75, 7.2],
  ]));
  const kept = keptIndices(words.length, [{ from: 0, to: 5 }]);
  const { segments, words: out } = buildKeepSegments(words, kept);
  assert.deepEqual(out.map((w) => w.text), ['bonjour', 'a', 'tous']);
  assert.equal(segments.length, 1);
  assert.ok(Math.abs(segments[0].start - 5.9) < 1e-9);
  assert.ok(out[0].start >= 0 && out[0].start < 0.2);
  assert.ok(out[2].end <= segments[0].end - segments[0].start);
});

test('buildKeepSegments : une coupe au milieu fait un joint de ~0,2 s ; une pause naturelle est gardee', () => {
  const words = tokenizeTranscript(raw([
    ['un', 0, 0.3], ['deux', 0.6, 0.9],
    ['rate', 2, 2.4],
    ['trois', 5, 5.4], ['quatre', 5.5, 5.9],
  ]));
  const { segments, words: out } = buildKeepSegments(words, [0, 1, 3, 4]);
  assert.equal(segments.length, 2);
  const joint = out[2].start - out[1].end;
  assert.ok(joint > 0.15 && joint < 0.25, `joint ${joint}`);
  assert.ok(Math.abs((out[1].start - out[0].end) - 0.3) < 1e-9);
  out.slice(1).forEach((w, i) => assert.ok(w.start >= out[i].end));
});

test('buildKeepSegments : rien a garder', () => {
  assert.deepEqual(buildKeepSegments([], []), { segments: [], words: [] });
});

test('buildCutFilter : un atrim par morceau, concat, normalisation du volume', () => {
  const filter = buildCutFilter([{ start: 0.5, end: 2 }, { start: 5, end: 6.5 }]);
  assert.match(filter, /atrim=start=0\.500:end=2\.000/);
  assert.match(filter, /\[s0\]\[s1\]concat=n=2:v=0:a=1,highpass=f=70,loudnorm=I=-16/);
  assert.match(filter, /\[out\]$/);
  assert.throws(() => buildCutFilter([]), /Aucun morceau/);
});

test('splitIntoScenes : phrases, pauses, longueur max ; le total de mots reste exact', () => {
  const w = (list) => tokenizeTranscript(raw(list));
  const sentence = (start, n, last) => Array.from({ length: n }, (_, k) => [k === n - 1 ? `fin${last}.` : `m${k}`, start + k * 0.3, start + k * 0.3 + 0.25]);
  const words = w([...sentence(0, 5, 1), ...sentence(3, 6, 2), ...sentence(6, 4, 3)]);
  const scenes = splitIntoScenes(words);
  assert.equal(scenes.length, 3);
  assert.equal(scenes.reduce((s, x) => s + countSpokenTokens(x.say), 0), words.length);

  const long = w(Array.from({ length: 60 }, (_, k) => [`m${k}`, k * 0.3, k * 0.3 + 0.25]));
  const cut = splitIntoScenes(long);
  assert.ok(cut.every((s) => countSpokenTokens(s.say) <= 24));
  assert.equal(cut.reduce((s, x) => s + countSpokenTokens(x.say), 0), 60);
  assert.equal(splitIntoScenes([]).length, 0);
});

test('les scenes decoupees se repartissent exactement sur les mots (assignWordsToScenes)', () => {
  const words = tokenizeTranscript(raw(Array.from({ length: 30 }, (_, k) => [k % 9 === 8 ? `m${k}.` : `m${k}`, k * 0.3, k * 0.3 + 0.25])));
  const scenes = splitIntoScenes(words);
  assert.doesNotThrow(() => assignWordsToScenes(scenes, words));
});

test('remapDirectives : ancre une indication sur le mot garde suivant', () => {
  assert.deepEqual(remapDirectives([{ at: 4, instruction: 'fond sombre' }, { at: 9, instruction: 'fin' }], [0, 1, 5, 6]), [
    { instruction: 'fond sombre', atWord: 2 },
    { instruction: 'fin', atWord: 3 },
  ]);
});

test('detectAudioType : par signature, pas par nom', () => {
  const pad = (b) => Buffer.concat([Buffer.from(b), Buffer.alloc(16)]);
  assert.equal(detectAudioType(pad('ID3\u0004'))?.extension, 'mp3');
  assert.equal(detectAudioType(pad([0xff, 0xfb, 0x90]))?.extension, 'mp3');
  assert.equal(detectAudioType(Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WAVE'), Buffer.alloc(8)]))?.extension, 'wav');
  assert.equal(detectAudioType(Buffer.concat([Buffer.alloc(4), Buffer.from('ftypM4A '), Buffer.alloc(8)]))?.extension, 'm4a');
  assert.equal(detectAudioType(pad('OggS'))?.extension, 'ogg');
  assert.equal(detectAudioType(pad([0x1a, 0x45, 0xdf, 0xa3]))?.extension, 'webm');
  assert.equal(detectAudioType(Buffer.from('MZ pas de l audio du tout')), null);
  assert.equal(detectAudioType(Buffer.alloc(4)), null);
});

test('Scribe : champs envoyes et erreurs lisibles', async () => {
  assert.equal(buildScribeFields().timestamps_granularity, 'word');
  let sent;
  const ok = await transcribeWithScribe({
    audio: Buffer.from('abc'), apiKey: 'k',
    fetchImpl: async (url, init) => { sent = { url, init }; return { ok: true, json: async () => ({ words: [{ text: 'a' }], language_code: 'fra' }) }; },
  });
  assert.equal(ok.words.length, 1);
  assert.equal(sent.init.headers['xi-api-key'], 'k');
  assert.equal(sent.init.body.get('language_code'), 'fra');
  await assert.rejects(transcribeWithScribe({
    audio: Buffer.from('abc'), apiKey: 'k', fetchImpl: async () => ({ ok: false, status: 401, json: async () => ({ detail: { message: 'nope' } }) }),
  }), /401.*nope/);
  await assert.rejects(transcribeWithScribe({ audio: Buffer.alloc(0), apiKey: 'k' }), /vide/);
});

const reply = (obj) => async () => ({ content: [{ type: 'text', text: JSON.stringify(obj) }] });

test('cleanTranscript : si Claude echoue, aucune coupe', async () => {
  const words = tokenizeTranscript(raw([['a', 0, 1], ['b', 1, 2]]));
  const failing = await cleanTranscript({ words, createMessage: async () => { throw new Error('panne'); } });
  assert.deepEqual(failing, { cuts: [], directives: [] });
  const good = await cleanTranscript({ words, createMessage: reply({ cuts: [{ from: 0, to: 0 }], directives: [] }) });
  assert.equal(good.cuts.length, 1);
});

test('generateOwnVoicePlan : les "say" viennent du code, meme si Claude les modifie ou omet une scene', async () => {
  const scenes = [{ from: 0, to: 2, say: 'Salut tout le monde.' }, { from: 3, to: 6, say: 'Voici mon idée du jour.' }, { from: 7, to: 9, say: 'Abonne-toi vite.' }];
  const plan = await generateOwnVoicePlan({
    scenes,
    createMessage: reply({ title: 'T', caption: 'C', hashtags: ['a'], scenes: [
      { say: 'autre chose complètement', layout: 'hook', text: 'Salut', avatar: { beats: [{ at: 0, expr: 'neutral' }] } },
      { say: 'x', layout: 'title', title: 'Idée' },
    ] }),
  });
  assert.deepEqual(plan.scenes.map((s) => s.say), scenes.map((s) => s.say));
  assert.equal(plan.scenes[0].layout, 'hook');
  assert.equal(plan.scenes[2].layout, 'avatar');
  assert.equal(plan.scenes.length, 3);
});

test('produceOwnVoiceVideo : enchaine les etapes, coupe les ratés, rend avec les mots nettoyes', async () => {
  const mp3 = Buffer.concat([Buffer.from('ID3'), Buffer.alloc(32)]);
  const heard = raw([
    ['Bonjour', 0.2, 0.7], ['a', 0.75, 0.9], ['tous.', 0.95, 1.4],
    ['euh', 2.5, 2.8],
    ['Voici', 4.0, 4.4], ['mon', 4.45, 4.6], ['idee.', 4.65, 5.2],
  ]);
  const steps = [];
  let rendered;
  const result = await produceOwnVoiceVideo({
    audio: mp3, idea: 'test', onStep: (s) => steps.push(s),
    deps: {
      transcribe: async () => ({ words: heard }),
      clean: async () => ({ cuts: [{ from: 3, to: 3, reason: 'hésitation' }], directives: [] }),
      cut: async (_audio, ext, segments) => { assert.equal(ext, 'mp3'); assert.equal(segments.length, 2); return Buffer.from('cleaned'); },
      plan: async ({ scenes }) => ({ title: 't', caption: '', hashtags: [], scenes: scenes.map((s) => ({ say: s.say, layout: 'avatar' })) }),
      render: async (plan, voice) => { rendered = { plan, voice }; return { video: Buffer.from('mp4'), duration: 6 }; },
    },
  });
  assert.deepEqual(steps, ['transcription', 'nettoyage', 'plan', 'render']);
  assert.deepEqual(rendered.voice.words.map((w) => w.text), ['Bonjour', 'a', 'tous.', 'Voici', 'mon', 'idee.']);
  assert.equal(result.report.wordsHeard, 7);
  assert.equal(result.report.wordsKept, 6);
  assert.equal(rendered.plan.scenes.map((s) => s.say).join(' '), 'Bonjour a tous. Voici mon idee.');
  assert.doesNotThrow(() => assignWordsToScenes(rendered.plan.scenes, rendered.voice.words));
});

test('produceOwnVoiceVideo : refus clairs', async () => {
  await assert.rejects(produceOwnVoiceVideo({ audio: Buffer.from('pas audio du tout ici') }), /Format audio/);
  const mp3 = Buffer.concat([Buffer.from('ID3'), Buffer.alloc(32)]);
  await assert.rejects(produceOwnVoiceVideo({ audio: mp3, deps: { transcribe: async () => ({ words: raw([['a', 0, 1]]) }) } }), /Presque rien/);
  const many = raw(Array.from({ length: 8 }, (_, k) => [`m${k}`, k, k + 0.5]));
  await assert.rejects(produceOwnVoiceVideo({
    audio: mp3, deps: { transcribe: async () => ({ words: many }), clean: async () => ({ cuts: [{ from: 0, to: 7 }], directives: [] }) },
  }), /presque rien apres/i);
});

test('trame : nettoyee, bornee, avec les conseils d enregistrement', async () => {
  const outline = await generateOutline({
    idea: 'Mon idée', createMessage: reply({ title: 'T', beats: [
      { label: 'Accroche', goal: 'g', points: ['a', 'b', 'c', 'd'], example: 'Tu savais que… ?', seconds: 99, cue: 'fond sombre' },
      { label: 'Fin', goal: 'g', points: [], example: 'Abonne-toi.', seconds: 4 },
      { label: '', example: 'sans nom' },
    ] }),
  });
  assert.equal(outline.beats.length, 2);
  assert.equal(outline.beats[0].points.length, 3);
  assert.equal(outline.beats[0].seconds, 60);
  assert.deepEqual(outline.tips, RECORDING_TIPS);
  assert.throws(() => sanitizeOutline({ beats: [{ label: 'x', example: 'y' }] }), /moins de 2/);
  await assert.rejects(generateOutline({ idea: '  ', createMessage: reply({}) }), /Idee requise/);
});
