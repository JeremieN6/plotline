import test from 'node:test';
import assert from 'node:assert/strict';

import { extendInstructionCuts, findImmediateRepeats, keptIndices, normalizeCleaning, tokenizeTranscript } from '../server/utils/ownVoice.js';
import { mergePackEntries } from '../server/utils/facelessVideoJob.js';

const say = (text, start = 0, step = 0.3) => tokenizeTranscript(text.split(' ').map((t, k) => ({ type: 'word', text: t, start: start + k * step, end: start + k * step + 0.25 })));

test('findImmediateRepeats : une phrase dite deux fois de suite est coupee, la derniere prise est gardee', () => {
  const words = say('SPF DKIM DMARC tout ça n\'était pas configuré au lancement tout ça n\'était pas configuré au lancement et rien ne le signalait');
  const cuts = findImmediateRepeats(words);
  assert.equal(cuts.length, 1);
  assert.deepEqual([cuts[0].from, cuts[0].to], [3, 9]);
  const kept = keptIndices(words.length, cuts).map((i) => words[i].text).join(' ');
  assert.equal(kept, 'SPF DKIM DMARC tout ça n\'était pas configuré au lancement et rien ne le signalait');
});

test('findImmediateRepeats : emphase courte, texte sans reprise, grand ecart ou ponctuation/casse', () => {
  assert.deepEqual(findImmediateRepeats(say('ça va paraître très très bête mais voilà')), []);
  assert.deepEqual(findImmediateRepeats(say('on envoie le message puis on relit le message demain')), []);
  const far = tokenizeTranscript([
    ...'je vérifie que ça arrive'.split(' ').map((t, k) => ({ type: 'word', text: t, start: k * 0.3, end: k * 0.3 + 0.25 })),
    ...'je vérifie que ça arrive'.split(' ').map((t, k) => ({ type: 'word', text: t, start: 20 + k * 0.3, end: 20 + k * 0.3 + 0.25 })),
  ]);
  assert.deepEqual(findImmediateRepeats(far), []);
  const loose = say('Tout ça, n\'était pas configuré. tout ça n\'était pas configuré encore');
  assert.equal(findImmediateRepeats(loose).length, 1);
});

test('findImmediateRepeats : triple reprise = les deux premieres coupees ; ne retire jamais la derniere prise de Claude', () => {
  const words = say('a b c d a b c d a b c d fin');
  const cuts = findImmediateRepeats(words);
  assert.equal(keptIndices(words.length, cuts).map((i) => words[i].text).join(' '), 'a b c d fin');

  // Claude a deja coupe la PREMIERE prise : le filet ne voit plus de reprise et ne coupe rien de plus.
  const claudeCuts = normalizeCleaning({ cuts: [{ from: 0, to: 3 }] }, words.length).cuts;
  const keptWords = keptIndices(words.length, claudeCuts).map((i) => words[i]);
  const extra = findImmediateRepeats(keptWords);
  const merged = normalizeCleaning({ cuts: [...claudeCuts, ...extra] }, words.length).cuts;
  assert.equal(keptIndices(words.length, merged).map((i) => words[i].text).join(' '), 'a b c d fin');
});

test('mergePackEntries : les poses de la video gardent leur image, les nouvelles du pack s ajoutent', () => {
  const merged = mergePackEntries(
    { happy: { mode: 'head', url: 'video-happy.png' } },
    { happy: { mode: 'head', url: 'nouvelle-happy.png' }, laugh: { mode: 'head', url: 'laugh.png' } },
  );
  assert.equal(merged.happy.url, 'video-happy.png');
  assert.equal(merged.laugh.url, 'laugh.png');
  assert.deepEqual(mergePackEntries(undefined, null), {});
  assert.deepEqual(mergePackEntries({ a: { url: 'x' } }, undefined), { a: { url: 'x' } });
});

// --- Cache des transcriptions + filet "reprise immediate" dans la chaine complete --------------------------------

import { hashAudio, isUsableTranscript, transcribeWithCache, transcriptCachePath } from '../server/utils/transcriptCache.js';
import { produceOwnVoiceVideo } from '../server/utils/facelessOwnVoice.js';

const memoryCache = () => {
  const store = new Map();
  return { store, read: async (key) => store.get(key) ?? null, write: async (key, value) => { store.set(key, value); } };
};
const transcript = { words: [{ text: 'bonjour', start: 0, end: 0.5, type: 'word' }, { text: 'a', start: 0.6, end: 0.7, type: 'word' }], languageCode: 'fra', text: 'bonjour a' };

test('cache de transcription : la 2e fois avec le meme fichier, aucun appel de transcription', async () => {
  const cache = memoryCache();
  const audio = Buffer.from('un enregistrement'.repeat(10));
  let calls = 0;
  const transcribe = async () => { calls += 1; return transcript; };

  const first = await transcribeWithCache({ userId: 'u1', audio, transcribe, cache });
  assert.deepEqual([first.cached, calls], [false, 1]);
  const second = await transcribeWithCache({ userId: 'u1', audio, transcribe, cache });
  assert.deepEqual([second.cached, calls], [true, 1]);
  assert.deepEqual(second.transcript, transcript);

  // Autre fichier ou autre compte : on retranscrit (le cache est propre a chaque compte).
  await transcribeWithCache({ userId: 'u1', audio: Buffer.from('autre fichier'.repeat(10)), transcribe, cache });
  await transcribeWithCache({ userId: 'u2', audio, transcribe, cache });
  assert.equal(calls, 3);
  assert.equal(hashAudio(audio).length, 64);
});

test('cache de transcription : sans compte pas de cache ; cache casse ou corrompu = on transcrit, jamais d erreur', async () => {
  let calls = 0;
  const transcribe = async () => { calls += 1; return transcript; };
  const audio = Buffer.from('x'.repeat(100));
  assert.deepEqual((await transcribeWithCache({ audio, transcribe })).cached, false);
  assert.equal(transcriptCachePath({ userId: '', hash: hashAudio(audio) }), '');

  const broken = { read: async () => { throw new Error('panne lecture'); }, write: async () => { throw new Error('panne ecriture'); } };
  const result = await transcribeWithCache({ userId: 'u1', audio, transcribe, cache: broken });
  assert.deepEqual([result.cached, calls, result.transcript.words.length], [false, 2, 2]);

  const corrupted = memoryCache();
  corrupted.store.set(transcriptCachePath({ userId: 'u1', hash: hashAudio(audio) }), { format: 1, transcript: { words: 'pas une liste' } });
  assert.equal((await transcribeWithCache({ userId: 'u1', audio, transcribe, cache: corrupted })).cached, false);
  assert.equal(isUsableTranscript({ format: 1, transcript }), true);
  assert.equal(isUsableTranscript({ format: 2, transcript }), false);
  assert.match(transcriptCachePath({ userId: 'u_1', hash: hashAudio(audio) }), /^faceless-transcripts\/u_1\/[0-9a-f]{64}\.json$/);
});

test('produceOwnVoiceVideo : reutilise la transcription en cache et coupe une reprise que Claude a laissee', async () => {
  const mp3 = Buffer.concat([Buffer.from('ID3'), Buffer.alloc(64)]);
  const words = 'SPF DKIM tout ça n\'était pas configuré tout ça n\'était pas configuré et voilà'.split(' ');
  const heard = words.map((text, k) => ({ type: 'word', text, start: k * 0.4, end: k * 0.4 + 0.3 }));
  let transcriptions = 0;
  const cache = memoryCache();
  let cutSegments;
  const run = () => produceOwnVoiceVideo({
    audio: mp3, idea: 't', userId: 'u1',
    deps: {
      transcriptCache: cache,
      transcribe: async () => { transcriptions += 1; return { words: heard }; },
      clean: async () => ({ cuts: [], directives: [] }),
      cut: async (_a, _e, segments) => { cutSegments = segments; return Buffer.from('cleaned'); },
      plan: async ({ scenes }) => ({ title: 't', caption: '', hashtags: [], scenes: scenes.map((s) => ({ say: s.say, layout: 'avatar' })) }),
      render: async () => ({ video: Buffer.from('mp4'), duration: 5 }),
    },
  });

  const first = await run();
  assert.equal(first.report.transcriptCached, false);
  assert.equal(first.report.wordsHeard, 14);
  assert.equal(first.report.wordsKept, 9);
  assert.equal(first.plan.scenes.map((s) => s.say).join(' '), 'SPF DKIM tout ça n\'était pas configuré et voilà');
  assert.ok(cutSegments.length >= 2);

  const second = await run();
  assert.equal(second.report.transcriptCached, true);
  assert.equal(transcriptions, 1);
});

import { restoreSpokenText, spokenTextChanged } from '../server/utils/facelessPlanGenerator.js';

test('restoreSpokenText : la forme d origine des mots revient, les coupes entre scenes du nouveau plan restent', () => {
  const original = { scenes: [{ say: 'Vingt-deux leads, 11 % d\'ouverture.' }, { say: 'C\'était pas le message.' }] };
  // Claude a ecrit 22 a la place de Vingt-deux, retire une virgule et coupe autrement.
  const retouched = { scenes: [{ say: '22 leads 11 %' }, { say: 'd\'ouverture. C\'était pas' }, { say: 'le message.' }], title: 'T' };
  const restored = restoreSpokenText(retouched, original);
  assert.equal(spokenTextChanged(original, restored), false);
  assert.deepEqual(restored.scenes.map((s) => s.say), ['Vingt-deux leads, 11 %', 'd\'ouverture. C\'était pas', 'le message.']);
  assert.equal(restored.title, 'T');

  // Un vrai changement de texte (nombre de mots different) n est PAS masque.
  const different = { scenes: [{ say: 'Vingt-deux leads, 11 % d\'ouverture.' }, { say: 'C\'était pas le message du tout.' }] };
  assert.equal(spokenTextChanged(original, restoreSpokenText(different, original)), true);
});

test('findImmediateRepeats : une premiere prise coupee net ("les d-") avant la reprise est coupee avec son fragment', () => {
  const words = say("des spas. N'oublie pas de t'abonner pour savoir tous les d- N'oublie pas de t'abonner pour savoir tous les autres trucs");
  const cuts = findImmediateRepeats(words);
  assert.equal(cuts.length, 1);
  const kept = keptIndices(words.length, cuts).map((i) => words[i].text).join(' ');
  assert.equal(kept, "des spas. N'oublie pas de t'abonner pour savoir tous les autres trucs");
});

test('extendInstructionCuts : l amorce d une consigne dite a voix haute part avec la consigne', () => {
  const words = say("c'est un super chiffre. Et là, quand je dis Skinalyze, tu m'affiches Skinalyze en grand avec un emoji étoile. Sauf qu'en fait, c'était des robots.");
  const start = words.findIndex((w) => w.text === "m'affiches");
  const end = words.findIndex((w) => w.text === 'étoile.');
  // Claude n a coupe que la fin de la consigne : l amorce "Et là, quand je dis Skinalyze, tu" resterait dans la video.
  const cuts = extendInstructionCuts(words, [{ from: start, to: end, reason: 'consigne' }], [{ at: start, instruction: 'afficher Skinalyze' }]);
  const kept = keptIndices(words.length, normalizeCleaning({ cuts }, words.length).cuts).map((i) => words[i].text).join(' ');
  assert.equal(kept, "c'est un super chiffre. Sauf qu'en fait, c'était des robots.");
  // Sans consigne associee, la coupe reste telle quelle (un faux depart ordinaire n emporte pas la phrase d avant).
  assert.deepEqual(extendInstructionCuts(words, [{ from: start, to: end, reason: 'raté' }], []), [{ from: start, to: end, reason: 'raté' }]);
});
