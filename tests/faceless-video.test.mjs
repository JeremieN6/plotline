import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildCaptionChunks,
  layoutFacelessTimeline,
  normalizeWord,
  resolveCue,
  withWordEnds,
} from '../server/utils/facelessTimeline.js';
import { buildFacelessHtml, richText, tornClipPath } from '../server/utils/facelessTemplate.js';
import { AVATAR_EXPRESSIONS, buildChibiSvg } from '../server/utils/facelessAvatar.js';

const words = [
  { text: 'Un', start: 0 },
  { text: ':', start: 0.3 },
  { text: "l'affiliation.", start: 0.5 },
  { text: 'Tu', start: 1.4 },
  { text: 'touches', start: 1.6 },
  { text: 'zéro', start: 2.0 },
];

test('normalizeWord : accents, ponctuation et elision', () => {
  assert.equal(normalizeWord('Zéro,'), 'zero');
  assert.equal(normalizeWord("l'affiliation."), 'affiliation');
  assert.equal(normalizeWord('Qu’il'), 'il');
});

test('resolveCue : secondes, mot, sequence de mots, inconnu', () => {
  assert.equal(resolveCue(1.25, words), 1.25);
  assert.equal(resolveCue('zero', words), 2.0);
  assert.equal(resolveCue('affiliation', words), 0.5);
  assert.equal(resolveCue('tu touches', words), 1.4);
  assert.equal(resolveCue('absent', words), 0);
});

test('withWordEnds : fin = debut du mot suivant, dernier mot = fin du clip', () => {
  const ended = withWordEnds([{ text: 'a', start: 0 }, { text: 'b', start: 0.4 }], 1.1);
  assert.deepEqual(ended.map((w) => w.end), [0.4, 1.1]);
});

test('buildCaptionChunks : 3 mots max, coupure apres ponctuation', () => {
  const ended = withWordEnds([
    { text: 'Abonne-toi,', start: 0 },
    { text: 'je', start: 0.5 },
    { text: 'te', start: 0.6 },
    { text: 'montre', start: 0.7 },
    { text: 'comment', start: 1.0 },
  ], 1.5);
  const chunks = buildCaptionChunks(ended, { maxWords: 3, end: 2 });
  assert.deepEqual(chunks.map((c) => c.words.map((w) => w.text).join(' ')), ['Abonne-toi,', 'je te montre', 'comment']);
  assert.equal(chunks[0].end, 0.5);
  assert.equal(chunks[2].end, 2);
});

test('layoutFacelessTimeline : scenes calees sur la voix, reperes par mot', () => {
  const spec = {
    scenes: [
      { say: 'a', layout: 'hook', text: 'A', sfx: [{ name: 'pop', at: 0 }] },
      { say: 'b', layout: 'list', items: [{ text: 'x', at: 'zero' }], captions: true },
    ],
  };
  const clips = [
    { path: 'a.wav', duration: 2, words: [{ text: 'a', start: 0 }] },
    { path: 'b.wav', duration: 3, words },
  ];
  const tl = layoutFacelessTimeline(spec, clips, { leadIn: 0.3, gap: 0.2, tail: 1, visualLead: 0.1 });

  assert.deepEqual(tl.voice.map((v) => v.start), [0.3, 2.5]);
  assert.equal(tl.scenes[0].start, 0);
  assert.equal(tl.scenes[0].end, 2.4);
  assert.equal(tl.scenes[1].start, 2.4);
  assert.equal(tl.duration, 6.5);
  // "zero" est dit a 2,0 s dans le clip : 2,1 s apres le debut visuel de la scene.
  assert.equal(Number(tl.scenes[1].items[0].at.toFixed(3)), 2.1);
  assert.equal(tl.scenes[1].words[0].start, 2.5);
  assert.ok(tl.scenes[1].captionChunks.length > 0);
  assert.equal(tl.scenes[0].captionChunks.length, 0);
  assert.deepEqual(tl.sfx, [{ name: 'pop', start: 0, gain: 0.5 }]);
});

test('layoutFacelessTimeline : refuse un nombre de clips incoherent', () => {
  assert.throws(() => layoutFacelessTimeline({ scenes: [{}] }, []), /1 scenes pour 0 clips/);
});

test('richText echappe le HTML et surligne **mot**', () => {
  assert.equal(richText('<b>**ok**</b>'), '&lt;b&gt;<mark>ok</mark>&lt;/b&gt;');
});

test('tornClipPath est deterministe', () => {
  assert.equal(tornClipPath(42), tornClipPath(42));
  assert.notEqual(tornClipPath(42), tornClipPath(43));
});

test('buildChibiSvg : chaque expression, tete et buste', () => {
  for (const expression of Object.keys(AVATAR_EXPRESSIONS)) {
    const svg = buildChibiSvg({ expression, mode: 'body', pose: 'wave', id: expression });
    assert.match(svg, /^<svg[\s\S]*<\/svg>$/);
    assert.match(svg, new RegExp(`fl-sticker-${expression}`));
  }
  assert.notEqual(buildChibiSvg({ expression: 'happy' }), buildChibiSvg({ expression: 'sad' }));
});

test('buildFacelessHtml : une section par scene et la fonction de rendu', () => {
  const tl = layoutFacelessTimeline(
    { scenes: [{ layout: 'hook', text: '<x>' }, { layout: 'avatar', text: 'b' }] },
    [{ path: 'a', duration: 1, words: [] }, { path: 'b', duration: 1, words: [] }],
  );
  const html = buildFacelessHtml(tl);
  assert.equal(html.match(/<section class="scene bg-main">/g).length, 2);
  assert.match(html, /window\.__seek/);
  assert.ok(!html.includes('<x>'));
});

// --- Etape 2 : plan Claude + voix ElevenLabs -------------------------------

const { alignmentToWords, buildElevenLabsBody, synthesizeWithTimestamps } = await import('../server/utils/elevenLabsTts.js');
const {
  generateFacelessPlan, normalizeFacelessDuration, parseFacelessPlanResponse, sanitizeFacelessPlan, sanitizeFacelessScene,
} = await import('../server/utils/facelessPlanGenerator.js');
const { assignWordsToScenes, layoutFacelessTimelineFromTrack } = await import('../server/utils/facelessTimeline.js');
const { buildFacelessCaption } = await import('../server/utils/facelessVideoJob.js');

function fakeAlignment(text, perChar = 0.05) {
  const characters = [...text];
  return {
    characters,
    character_start_times_seconds: characters.map((_, i) => i * perChar),
    character_end_times_seconds: characters.map((_, i) => (i + 1) * perChar),
  };
}

test('alignmentToWords : decoupe sur les espaces, garde la ponctuation', () => {
  const words = alignmentToWords(fakeAlignment("Un : l'affiliation."));
  assert.deepEqual(words.map((w) => w.text), ['Un', ':', "l'affiliation."]);
  assert.equal(words[0].start, 0);
  assert.equal(Number(words[0].end.toFixed(2)), 0.1);
  assert.equal(Number(words[2].start.toFixed(2)), 0.25);
});

test('buildElevenLabsBody : modele multilingue par defaut, texte nettoye', () => {
  const body = buildElevenLabsBody({ text: '  Salut  ' });
  assert.equal(body.text, 'Salut');
  assert.equal(body.model_id, 'eleven_multilingual_v2');
  assert.ok(body.voice_settings.stability > 0);
});

test('synthesizeWithTimestamps : audio + mots ; erreur lisible si refus', async () => {
  const ok = async () => ({ ok: true, json: async () => ({ audio_base64: Buffer.from('mp3').toString('base64'), alignment: fakeAlignment('a b') }) });
  const result = await synthesizeWithTimestamps({ text: 'a b', voiceId: 'v', apiKey: 'k', fetchImpl: ok });
  assert.equal(result.audio.toString(), 'mp3');
  assert.equal(result.words.length, 2);

  const ko = async () => ({ ok: false, status: 401, json: async () => ({ detail: { message: 'invalid key' } }) });
  await assert.rejects(synthesizeWithTimestamps({ text: 'a', voiceId: 'v', apiKey: 'k', fetchImpl: ko }), /401.*invalid key/);
  await assert.rejects(synthesizeWithTimestamps({ text: 'a', voiceId: '', apiKey: 'k', fetchImpl: ok }), /Voix/);
});

test('sanitizeFacelessScene : listes blanches et repli sur "avatar"', () => {
  const scene = sanitizeFacelessScene({
    say: 'Bonjour toi.',
    layout: 'list',
    items: [{ text: 'un seul', at: 'toi' }],
    avatar: { beats: [{ at: 3, expr: 'inconnue' }, { at: 'toi', expr: 'wink', flip: true }] },
    sfx: [{ name: 'memes/spiderman', at: 0 }, { name: 'ui/pop', at: 'toi' }],
    captions: true,
    title: 'Titre',
  });
  assert.equal(scene.layout, 'avatar');
  assert.equal(scene.text, 'Titre');
  assert.equal(scene.avatar.mode, 'body');
  assert.deepEqual(scene.avatar.beats, [{ at: 0, expr: 'neutral', flip: false }, { at: 'toi', expr: 'wink', flip: true }]);
  assert.deepEqual(scene.sfx, [{ name: 'ui/pop', at: 'toi' }]);
  assert.equal(scene.captions, true);
  assert.equal(sanitizeFacelessScene({ say: '   ' }), null);
  assert.equal(sanitizeFacelessScene({ say: 'x', captions: true }, { captions: false }).captions, false);
});

test('sanitizeFacelessPlan : au moins 2 scenes, hashtags normalises', () => {
  const plan = sanitizeFacelessPlan({
    title: 'T', caption: 'C', hashtags: ['argent', '#side hustle'],
    scenes: [{ say: 'Un.', layout: 'hook', text: 'Un' }, { say: 'Deux.', layout: 'word', word: 'DEUX' }, { say: '' }],
  });
  assert.equal(plan.scenes.length, 2);
  assert.deepEqual(plan.hashtags, ['#argent', '#sidehustle']);
  assert.throws(() => sanitizeFacelessPlan({ scenes: [{ say: 'seule' }] }), /moins de 2 scenes/);
});

test('normalizeFacelessDuration et parseFacelessPlanResponse', () => {
  assert.equal(normalizeFacelessDuration('45'), 45);
  assert.equal(normalizeFacelessDuration(999), 30);
  assert.deepEqual(parseFacelessPlanResponse('```json\n{"a":1}\n```'), { a: 1 });
  assert.throws(() => parseFacelessPlanResponse('rien'), /sans JSON/);
});

test('generateFacelessPlan : prompt avec persona et duree, plan nettoye', async () => {
  let request;
  const createMessage = async (req) => {
    request = req;
    return { content: [{ type: 'text', text: JSON.stringify({ scenes: [{ say: 'A.', layout: 'hook', text: 'A' }, { say: 'B.', layout: 'avatar' }] }) }] };
  };
  const plan = await generateFacelessPlan({ idea: 'idee', persona: { name: 'Camille', style: 'girly' }, targetSeconds: 20, createMessage });
  assert.equal(plan.scenes.length, 2);
  assert.match(request.system, /Camille/);
  assert.match(request.system, /environ 52 mots/);
  assert.match(request.messages[0].content, /idee/);
});

test('assignWordsToScenes et timeline sur piste unique', () => {
  const plan = { scenes: [{ say: 'Salut toi.', layout: 'hook', text: 'x' }, { say: 'Abonne-toi vite.', layout: 'avatar', captions: true, sfx: [{ name: 'ui/pop', at: 'vite.' }] }] };
  const words = alignmentToWords(fakeAlignment('Salut toi. Abonne-toi vite.', 0.1));
  assert.deepEqual(assignWordsToScenes(plan.scenes, words).map((l) => l.length), [2, 2]);
  assert.throws(() => assignWordsToScenes(plan.scenes, words.slice(1)), /3 mots/);

  const tl = layoutFacelessTimelineFromTrack(plan, { path: 'v.mp3', duration: 2.7, words }, { leadIn: 0.3, tail: 1, visualLead: 0.1 });
  assert.deepEqual(tl.voice, [{ path: 'v.mp3', start: 0.3 }]);
  // "Abonne-toi" commence au caractere 11 -> 1,1 s dans la piste, 1,4 s apres le lead-in.
  assert.equal(Number(tl.scenes[1].voiceStart.toFixed(2)), 1.4);
  assert.equal(Number(tl.scenes[1].start.toFixed(2)), 1.3);
  assert.equal(Number(tl.duration.toFixed(2)), 4.0);
  // "vite." commence au caractere 22 -> 2,5 s absolues.
  assert.equal(Number(tl.sfx[0].start.toFixed(2)), 2.5);
});

test('buildFacelessCaption : legende + hashtags', () => {
  assert.equal(buildFacelessCaption({ caption: 'Hello', hashtags: ['#a', '#b'] }), 'Hello\n\n#a #b');
  assert.equal(buildFacelessCaption({}), null);
});

test('sanitizeFacelessScene : emoji retires des textes, sous-titres seulement sur avatar/word', () => {
  const hook = sanitizeFacelessScene({ say: 'Salut.', layout: 'hook', text: "C'est **pas** de la paresse 🚫", captions: true, emoji: '🚫' });
  assert.equal(hook.text, "C'est **pas** de la paresse");
  assert.equal(hook.emoji, '🚫');
  assert.equal(hook.captions, false);
  const word = sanitizeFacelessScene({ say: 'Deux minutes.', layout: 'word', word: '2 min ⏱️', captions: true });
  assert.equal(word.word, '2 min');
  assert.equal(word.captions, true);
});

// --- Retouches -------------------------------------------------------------

const { planForEditing, retouchFacelessPlan, spokenTextChanged } = await import('../server/utils/facelessPlanGenerator.js');
const { isFacelessRenderSpec } = await import('../server/utils/facelessVideoJob.js');
const { collectSafelyDeletableUrls, versionMediaUrls } = await import('../server/utils/contentVersions.js');

const basePlan = sanitizeFacelessPlan({
  title: 'T',
  scenes: [
    { say: 'Salut toi.', layout: 'hook', text: 'Salut' },
    { say: 'Abonne-toi.', layout: 'avatar', text: 'Abonne-toi' },
  ],
});

test('spokenTextChanged : seul le texte dit compte', () => {
  const visualOnly = { ...basePlan, scenes: basePlan.scenes.map((s) => ({ ...s, text: `${s.text} !`, layout: 'avatar' })) };
  assert.equal(spokenTextChanged(basePlan, visualOnly), false);
  const respaced = { ...basePlan, scenes: basePlan.scenes.map((s, i) => (i === 0 ? { ...s, say: ' Salut   toi. ' } : s)) };
  assert.equal(spokenTextChanged(basePlan, respaced), false);
  // Scene coupee en deux sans changer un mot : meme voix.
  const split = { ...basePlan, scenes: [{ ...basePlan.scenes[0], say: 'Salut' }, { ...basePlan.scenes[0], say: 'toi.' }, basePlan.scenes[1]] };
  assert.equal(spokenTextChanged(basePlan, split), false);
  const reworded = { ...basePlan, scenes: basePlan.scenes.map((s, i) => (i === 1 ? { ...s, say: 'Abonne-toi vite.' } : s)) };
  assert.equal(spokenTextChanged(basePlan, reworded), true);
});

test('planForEditing : retire les champs vides, garde say/layout/avatar', () => {
  const edited = planForEditing(basePlan);
  assert.deepEqual(Object.keys(edited.scenes[0]).sort(), ['avatar', 'layout', 'say', 'text']);
});

test('retouchFacelessPlan : plan actuel + consigne envoyes, regles de retouche presentes', async () => {
  let request;
  const createMessage = async (req) => {
    request = req;
    return { content: [{ type: 'text', text: JSON.stringify(planForEditing(basePlan)) }] };
  };
  const plan = await retouchFacelessPlan({ plan: basePlan, instruction: 'intro plus courte', createMessage });
  assert.equal(plan.scenes.length, 2);
  assert.match(request.system, /RETOUCHE/);
  assert.match(request.system, /recopie chaque "say" a l identique/);
  assert.match(request.messages[0].content, /intro plus courte/);
  assert.match(request.messages[0].content, /Salut toi\./);
  await assert.rejects(retouchFacelessPlan({ plan: basePlan, instruction: '  ', createMessage }), /vide/);
});

test('isFacelessRenderSpec : plan, voix et mots requis', () => {
  const spec = { kind: 'faceless', plan: basePlan, voiceUrl: 'https://x/v.mp3', words: [{ text: 'a', start: 0, end: 1 }] };
  assert.equal(isFacelessRenderSpec(spec), true);
  assert.equal(isFacelessRenderSpec({ ...spec, voiceUrl: '' }), false);
  assert.equal(isFacelessRenderSpec({ ...spec, kind: 'autre' }), false);
  assert.equal(isFacelessRenderSpec(null), false);
});

test('purge : la voix partagee par une version gardee n est pas supprimee', () => {
  const voice = 'https://blob/voice-1.mp3';
  const old = { imageUrl: 'https://blob/v1.mp4', renderSpec: { voiceUrl: voice } };
  const kept = { imageUrl: 'https://blob/v2.mp4', renderSpec: { voiceUrl: voice } };
  assert.deepEqual(versionMediaUrls(old), ['https://blob/v1.mp4', voice]);
  assert.deepEqual(collectSafelyDeletableUrls({ versionsToPurge: [old], keptVersions: [kept], currentImageUrl: kept.imageUrl }), ['https://blob/v1.mp4']);
  // Plus aucune version ne l utilise : la voix part avec la video.
  const other = { imageUrl: 'https://blob/v3.mp4', renderSpec: { voiceUrl: 'https://blob/voice-2.mp3' } };
  assert.deepEqual(collectSafelyDeletableUrls({ versionsToPurge: [old], keptVersions: [other], currentImageUrl: other.imageUrl }), ['https://blob/v1.mp4', voice]);
  // Contenus classiques : comportement inchange.
  assert.deepEqual(collectSafelyDeletableUrls({ versionsToPurge: [{ imageUrl: 'a.png' }], keptVersions: [{ imageUrl: 'b.png' }], currentImageUrl: 'b.png' }), ['a.png']);
});

// --- Polices et bruitages embarques ----------------------------------------

const { SYNTH_SFX_NAMES, encodeWav, synthesizeSfx } = await import('../server/utils/facelessSfxSynth.js');
const { FACELESS_SFX } = await import('../server/data/facelessCatalog.js');
const { facelessAssetPath } = await import('../server/utils/facelessRenderer.js');
const { resolve: resolvePath, sep: pathSep } = await import('node:path');

test('chaque bruitage du catalogue a sa recette de synthese, sonore et courte', () => {
  assert.deepEqual([...SYNTH_SFX_NAMES].sort(), Object.keys(FACELESS_SFX).sort());
  for (const name of SYNTH_SFX_NAMES) {
    const samples = synthesizeSfx(name);
    assert.ok(samples.length > 0 && samples.length <= 3 * 48000, name);
    const peak = samples.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
    assert.ok(Number.isFinite(peak) && peak > 0.05 && peak <= 0.71, `${name} pic ${peak}`);
  }
  assert.throws(() => synthesizeSfx('memes/spiderman'), /inconnu/);
});

test('synthese deterministe et WAV valide', () => {
  const a = encodeWav(synthesizeSfx('girly/kawaii-pop'));
  const b = encodeWav(synthesizeSfx('girly/kawaii-pop'));
  assert.ok(a.equals(b));
  assert.equal(a.toString('ascii', 0, 4), 'RIFF');
  assert.equal(a.readUInt32LE(24), 48000);
  assert.equal(a.length, 44 + synthesizeSfx('girly/kawaii-pop').length * 2);
});

test('facelessAssetPath : sert le dossier du theme, jamais au-dela', () => {
  const base = resolvePath('resources/faceless');
  assert.equal(facelessAssetPath('https://faceless.assets/fonts/Fredoka.ttf', base), resolvePath(base, 'fonts/Fredoka.ttf'));
  // L analyseur d URL ramene deja ".." a la racine : on reste dans le dossier.
  assert.equal(facelessAssetPath('https://faceless.assets/../../.env.local', base), resolvePath(base, '.env.local'));
  // Variantes encodees : le resultat, s il existe, reste DANS le dossier du theme.
  for (const url of ['https://faceless.assets/%2e%2e/%2e%2e/.env.local', 'https://faceless.assets/%252e%252e/%252e%252e/.env.local', 'https://faceless.assets/..%2f..%2f.env.local']) {
    const file = facelessAssetPath(url, base);
    assert.ok(file === null || file.startsWith(base + pathSep), url);
  }
  assert.equal(facelessAssetPath('pas une url', base), null);
});
