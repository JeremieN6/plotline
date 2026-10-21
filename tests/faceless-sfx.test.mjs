import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { FACELESS_SFX } from '../server/data/facelessCatalog.js';
import { FACELESS_PRESETS } from '../server/data/facelessThemes.js';
import { FACELESS_SFX_PALETTES, FACELESS_SFX_ROLES } from '../server/data/facelessSfxPalettes.js';
import { adaptSfxName, buildDuckEnvelope, finalizeSfx, sfxPaletteKey, sfxPaletteNames } from '../server/utils/facelessSfxPlan.js';
import { buildFacelessPlanSystemPrompt } from '../server/utils/facelessPlanGenerator.js';
import { defaultFacelessStyle } from '../server/utils/facelessStyle.js';
import { engineSfx, sceneSoundEvents } from '../server/utils/facelessSfxEvents.js';
import { encodeWav } from '../server/utils/facelessSfxSynth.js';
import { MIX_SAMPLE_RATE, mixFacelessAudio } from '../server/utils/facelessRenderer.js';

test('catalogue : chaque son a un role, un fichier, et chaque palette n utilise que des sons du catalogue', () => {
  for (const name of Object.keys(FACELESS_SFX)) {
    assert.ok(FACELESS_SFX_ROLES[name], `${name} : role`);
    assert.ok(existsSync(join('resources/faceless/sfx', `${name}.wav`)), `${name} : fichier genere`);
  }
  for (const [key, palette] of Object.entries(FACELESS_SFX_PALETTES)) {
    for (const name of sfxPaletteNames(key)) assert.ok(FACELESS_SFX[name], `${key} : ${name}`);
    assert.ok(sfxPaletteNames(key).length >= 5, `${key} : assez de sons`);
    assert.ok(palette.label);
  }
});

test('palette d une DA : par modele visuel, par preset, ou "full" pour une DA personnalisee', () => {
  assert.equal(sfxPaletteKey({ template: 'editeur' }), 'tech');
  assert.equal(sfxPaletteKey({ template: 'hanko' }), 'impact');
  assert.equal(sfxPaletteKey({ template: 'herbier' }), 'soft');
  assert.equal(sfxPaletteKey({ template: 'classic', preset: 'terminal' }), 'tech');
  assert.equal(sfxPaletteKey({ template: 'classic', preset: 'pop-jaune' }), 'playful');
  assert.equal(sfxPaletteKey({ template: 'classic', preset: 'papercraft-pastel' }), 'full');
  assert.equal(sfxPaletteKey({ template: 'classic', preset: 'ma-da' }), 'full');
  for (const preset of Object.values(FACELESS_PRESETS)) {
    const key = sfxPaletteKey(preset.style);
    assert.ok(key === 'full' || FACELESS_SFX_PALETTES[key], preset.style.preset);
  }
  assert.equal(sfxPaletteNames('full').length, 22);
});

test('adaptSfxName : un son hors palette est remplace par celui de meme role, ou supprime', () => {
  assert.equal(adaptSfxName('paper/stamp-thump', 'tech'), 'tech/confirm');
  assert.equal(adaptSfxName('paper/pencil-scribble', 'tech'), 'tech/key-tap');
  assert.equal(adaptSfxName('ui/pop', 'tech'), 'ui/pop');
  assert.equal(adaptSfxName('girly/heart-boop', 'tech'), null, 'pas de coeur dans un terminal');
  assert.equal(adaptSfxName('girly/heart-boop', 'full'), 'girly/heart-boop');
  assert.equal(adaptSfxName('girly/heart-boop', 'playful'), 'girly/heart-boop');
});

const scene = (start, end, firstWordEnd) => ({ start, end, voiceStart: start, words: [{ text: 'mot', start, end: firstWordEnd }] });

test('finalizeSfx : scene courte, premier mot, ecart minimal, doublon, coupe des sons longs', () => {
  const scenes = [scene(0, 8, 0.5), scene(8, 8.8, 8.4), scene(8.8, 14, 9.3), scene(14, 20, 14.5)];
  const out = finalizeSfx([
    { name: 'paper/stamp-thump', start: 0, scene: 0, cued: false },          // debut de scene : dans le premier mot
    { name: 'paper/stamp-thump', start: 4, scene: 0, cued: true },
    { name: 'paper/paper-flip', start: 8, scene: 1, cued: false },           // scene de 0,8 s
    { name: 'ui/pop', start: 5.5, scene: 0, cued: true },                    // a moins de 2,5 s du precedent
    { name: 'paper/stamp-thump', start: 10, scene: 2, cued: true },          // meme son que le precedent retenu
    { name: 'tension/clock-ticking-a', start: 15, scene: 3, cued: true },
    { name: 'fail-error/nope', start: 17.6, scene: 3, cued: true },
  ], scenes, { paletteKey: 'full' });
  assert.deepEqual(out.map((s) => [s.name, s.start]), [['paper/stamp-thump', 4], ['tension/clock-ticking-a', 15], ['fail-error/nope', 17.6]]);
  assert.ok(out[0].maxDur >= 0.1);
  assert.ok(out[1].maxDur <= 2.6 - 0.05 + 1e-6, 'l horloge est coupee avant le son suivant');
});

test('finalizeSfx : un son cale sur un mot passe avant un son de debut de scene proche', () => {
  const scenes = [scene(0, 10, 0.3)];
  const out = finalizeSfx([
    { name: 'ui/pop', start: 0.4, scene: 0, cued: false },
    { name: 'transitions/whoosh-short', start: 1.5, scene: 0, cued: true },
  ], scenes, { paletteKey: 'full' });
  assert.deepEqual(out.map((s) => s.name), ['transitions/whoosh-short']);
});

test('buildDuckEnvelope : la voix descend sous un son puis remonte doucement', () => {
  const rate = 48000;
  const env = buildDuckEnvelope(rate * 2, [{ from: rate * 0.5, to: rate * 1 }], { rate, depth: 0.45 });
  assert.equal(env[0], 1);
  assert.ok(env[Math.round(rate * 0.9)] < 0.6, 'bien baissee sous le son');
  assert.ok(env[Math.round(rate * 0.5) + 10] > 0.9, 'l attaque n est pas instantanee');
  assert.ok(env[Math.round(rate * 1.05)] < 0.9 && env[Math.round(rate * 1.05)] > env[Math.round(rate * 0.95)], 'le relachement est progressif');
  assert.ok(env[rate * 2 - 1] > 0.99, 'la voix revient a son niveau');
});

test('prompt : seuls les sons de la palette sont proposes, avec les regles d espacement', () => {
  const tech = buildFacelessPlanSystemPrompt({ style: defaultFacelessStyle('terminal', 'MALE') });
  assert.match(tech, /tech\/key-tap/);
  assert.doesNotMatch(tech, /girly\/heart-boop/);
  assert.match(tech, /AUCUN bruitage dans une scene de moins de 2 secondes/);
  assert.match(tech, /AUTOMATIQUEMENT les sons d.interface/);
  assert.match(tech, /SENS d.un mot/);
  const playful = buildFacelessPlanSystemPrompt({ style: defaultFacelessStyle('pop-jaune', 'MALE') });
  assert.match(playful, /girly\/heart-boop/);
  assert.doesNotMatch(playful, /tech\/key-tap/);
});

test('mixage : la voix baisse sous un son, un son est coupe a maxDur, et la voix revient apres', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'plotline-sfx-test-'));
  try {
    const seconds = 3;
    const voice = new Float32Array(MIX_SAMPLE_RATE * seconds).fill(0.4);
    const click = new Float32Array(MIX_SAMPLE_RATE * 2).fill(0.1);
    await writeFile(join(dir, 'voice.wav'), encodeWav(voice, MIX_SAMPLE_RATE));
    await writeFile(join(dir, 'sfx.wav'), encodeWav(click, MIX_SAMPLE_RATE));
    const out = join(dir, 'mix.f32');
    await mixFacelessAudio([
      { path: join(dir, 'voice.wav'), start: 0, gain: 1 },
      { path: join(dir, 'sfx.wav'), start: 1, gain: 1, kind: 'sfx', maxDur: 0.5 },
    ], seconds, out);
    const buf = await readFile(out);
    const mix = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
    const at = (t) => mix[Math.round(t * MIX_SAMPLE_RATE) * 2];
    // Une piste mono passe en stereo avec un gain de 0,707.
    const base = 0.4 * Math.SQRT1_2;
    assert.ok(Math.abs(at(0.5) - base) < 0.01, 'voix intacte avant le son');
    assert.ok(at(1.3) < base - 0.03, 'voix baissee sous le son (malgre le son ajoute)');
    assert.ok(at(1.9) < base + 0.01, 'son coupe a 0,5 s : plus rien apres 1,5 s');
    assert.ok(Math.abs(at(2.5) - base) < 0.01, 'voix revenue a son niveau');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

const placed = (layout, extra = {}, start = 0, end = 6) => ({ layout, start, end, voiceStart: start, words: [{ text: 'mot', start, end: start + 0.4 }], items: [], ...extra });

test('evenements du moteur : une rangee de liste = un son a son instant, un tampon Hanko = un son fort', () => {
  const list = sceneSoundEvents(placed('list', { items: [{ at: 1, tone: '' }, { at: 2.5, tone: 'avoid' }, { at: 9, tone: '' }] }), { template: 'classic' });
  assert.deepEqual(list.map((e) => [e.role, e.at]), [['item', 1], ['error', 2.5], ['item', 5.5]], 'le dernier est ramene dans la scene');
  const word = sceneSoundEvents(placed('word', { jp: '傑作' }), { template: 'hanko' });
  assert.equal(word[0].role, 'strong');
  assert.ok(word[0].weight >= 1.5);
  assert.equal(sceneSoundEvents(placed('word'), { template: 'hanko' })[0].at, 0.25, 'sans tampon, le mot se pose');
  assert.deepEqual(sceneSoundEvents(placed('hook'), { template: 'classic' }), [], 'pas de son sur l accroche');
  const journal = sceneSoundEvents(placed('list', { items: [{ at: 1, tone: '' }, { at: 2, tone: 'watch' }] }), { template: 'journal' });
  assert.equal(journal.length, 1, 'une ligne a venir ne sonne pas');
  assert.ok(sceneSoundEvents(placed('photo'), { template: 'journal' }).some((e) => e.role === 'click'));
  const label = sceneSoundEvents(placed('label', { items: [{ tone: 'avoid' }, { tone: '' }, { tone: 'good' }] }), { template: 'herbier' });
  assert.deepEqual(label.map((e) => e.role), ['error', 'good'], 'seuls les ingredients juges sonnent');
});

test('engineSfx : le son vient de la palette de la DA et se pose a l instant de l animation', () => {
  const scenes = [placed('title', {}, 0, 5), placed('list', { items: [{ at: 1 }] }, 5, 12)];
  const tech = engineSfx(scenes, { template: 'editeur' }, 'tech');
  assert.ok(tech.every((s) => s.engine && s.cued));
  assert.ok(tech.some((s) => s.name === 'tech/terminal-blip' && Math.abs(s.start - 6) < 1e-6), 'rangee a 5 + 1 s');
  const full = engineSfx(scenes, { template: 'classic' }, 'full');
  assert.ok(full.some((s) => s.name === 'paper/sticker-peel'));
});

test('finalizeSfx avec le moteur : un son de sens de Claude et un son du moteur trop proches, le plus important reste', () => {
  const scenes = [placed('list', { items: [{ at: 2 }] }, 0, 10)];
  const engine = engineSfx(scenes, { template: 'classic' }, 'full');
  const out = finalizeSfx([...engine, { name: 'fail-error/nope', start: 2.6, scene: 0, cued: true }], scenes, { paletteKey: 'full' });
  assert.deepEqual(out.map((s) => s.name), ['fail-error/nope'], 'le son de sens (1,3) passe avant la rangee (1)');
  const rows = placed('list', { items: [{ at: 1 }, { at: 3.2 }, { at: 5.4 }] }, 0, 10);
  const three = finalizeSfx(engineSfx([rows], { template: 'classic' }, 'full'), [rows], { paletteKey: 'full' });
  assert.equal(three.length, 3, 'les rangees d une liste gardent le meme son');
});

test('finalizeSfx : un son du moteur reste dans une scene de 1,6 s, pas un son de Claude', () => {
  const scenes = [placed('word', {}, 0, 1.6)];
  const out = finalizeSfx([...engineSfx(scenes, { template: 'classic' }, 'full'), { name: 'ui/pop', start: 1, scene: 0, cued: true }], scenes, { paletteKey: 'full' });
  assert.deepEqual(out.map((s) => s.name), ['paper/stamp-thump']);
});
