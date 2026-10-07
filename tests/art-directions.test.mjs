import test from 'node:test';
import assert from 'node:assert/strict';

import { ART_DIRECTIONS, DEFAULT_ART_DIRECTION_ID } from '../server/data/artDirections.js';
import {
  ART_DIRECTION_WIDGET_IDS,
  applyArtDirection,
  getArtDirection,
  getDefaultArtDirectionScene,
  listArtDirections,
  normalizeArtDirectionId,
  resolveExternalScene,
} from '../server/utils/artDirections.js';
import { buildContinuationPrompt, buildFirstSegmentPrompt, resolveSpeechPace } from '../server/utils/omniFlashPrompts.js';

test('les 3 DA du premier lot existent, avec un id unique, un libellé français et une scène en anglais', () => {
  assert.deepEqual(ART_DIRECTIONS.map((item) => item.id), ['OFFICE_SOBER', 'UGC_PHONE', 'CINEMATIC']);
  assert.equal(new Set(ART_DIRECTIONS.map((item) => item.id)).size, ART_DIRECTIONS.length);
  for (const item of ART_DIRECTIONS) {
    assert.ok(item.label && item.description && item.scenePrompt.length > 40, item.id);
  }
});

test('la DA par défaut est identique à l\'ancienne scène neutre des vidéos d\'articles', () => {
  assert.equal(DEFAULT_ART_DIRECTION_ID, 'OFFICE_SOBER');
  assert.equal(
    getDefaultArtDirectionScene(),
    'A person speaking directly to the camera in a tidy, softly lit home office, natural daylight, relaxed and authentic atmosphere',
  );
});

test('normalizeArtDirectionId : casse libre, inconnu = null', () => {
  assert.equal(normalizeArtDirectionId('ugc_phone'), 'UGC_PHONE');
  assert.equal(normalizeArtDirectionId(' CINEMATIC '), 'CINEMATIC');
  assert.equal(normalizeArtDirectionId('NOPE'), null);
  assert.equal(normalizeArtDirectionId(''), null);
  assert.equal(normalizeArtDirectionId(undefined), null);
  assert.equal(getArtDirection('NOPE'), null);
});

test('listArtDirections : id, libellé, description, mais jamais le texte de la scène', () => {
  const list = listArtDirections();
  assert.equal(list.length, ART_DIRECTIONS.length);
  assert.ok(list.every((item) => Object.keys(item).sort().join() === 'description,id,label'));
});

test('applyArtDirection : ajoute la DA en tête, ne touche rien sans DA', () => {
  const scene = 'a kitchen with a window';
  assert.equal(applyArtDirection(scene, ''), scene);
  assert.equal(applyArtDirection(scene, 'NOPE'), scene);
  assert.equal(applyArtDirection('  ', ''), '');
  const withDa = applyArtDirection(scene, 'UGC_PHONE');
  assert.ok(withDa.startsWith(getArtDirection('UGC_PHONE').scenePrompt + '. '));
  assert.ok(withDa.endsWith(scene));
  assert.equal(applyArtDirection('', 'CINEMATIC'), getArtDirection('CINEMATIC').scenePrompt);
});

test('resolveExternalScene : DA explicite > décor du pilier > scène par défaut (jamais le script)', () => {
  assert.equal(resolveExternalScene({ artDirection: 'UGC_PHONE', decorPrompt: 'un bureau' }), getArtDirection('UGC_PHONE').scenePrompt);
  assert.equal(resolveExternalScene({ artDirection: null, decorPrompt: 'un bureau' }), 'un bureau');
  assert.equal(resolveExternalScene({ artDirection: null, decorPrompt: '  ' }), getDefaultArtDirectionScene());
  assert.equal(resolveExternalScene({}), getDefaultArtDirectionScene());
});

test('seul Video Scenario accepte une DA pour l\'instant', () => {
  assert.deepEqual(ART_DIRECTION_WIDGET_IDS, ['SCENARIO_BLOG']);
});


const OLD_DEFAULT_RULES =
  'Say the quoted text exactly once, word for word, in French, at a calm natural pace that fills about 10 seconds. Never repeat a word or a sentence, never add, skip or invent a word, and stop speaking right after the last word. Do not show subtitles, captions or any on-screen text: the video must contain no written words at all.';

test('rythme de parole : sans DA (ou avec la DA des articles), les prompts sont identiques à avant', () => {
  const plain = 'a bright kitchen';
  assert.ok(buildFirstSegmentPrompt(plain, 'Salut.').includes(OLD_DEFAULT_RULES));
  assert.ok(buildContinuationPrompt('Suite.').includes(OLD_DEFAULT_RULES));
  assert.ok(buildContinuationPrompt('Suite.', plain).includes(OLD_DEFAULT_RULES));
  const office = applyArtDirection(plain, 'OFFICE_SOBER');
  assert.ok(buildFirstSegmentPrompt(office, 'Salut.').includes(OLD_DEFAULT_RULES));
  assert.equal(
    buildFirstSegmentPrompt(plain, 'Salut.'),
    `${plain}. The person speaks clearly, in French, with natural lip movement synced to the speech. ${OLD_DEFAULT_RULES} Text: "Salut."`,
  );
});

test('rythme de parole : une DA avec son propre rythme remplace "calm natural pace", en gardant l\'ancrage de 10 s', () => {
  const ugc = applyArtDirection('a kitchen', 'UGC_PHONE');
  const first = buildFirstSegmentPrompt(ugc, 'Salut.');
  assert.ok(!first.includes('calm natural pace'));
  assert.ok(first.includes(getArtDirection('UGC_PHONE').speechPace));
  assert.match(first, /fills about 10 seconds/);
  const next = buildContinuationPrompt('Suite.', ugc);
  assert.ok(next.includes(getArtDirection('UGC_PHONE').speechPace));
  assert.ok(next.includes('do NOT say any earlier word again'));
  assert.equal(resolveSpeechPace(applyArtDirection('x', 'CINEMATIC')), getArtDirection('CINEMATIC').speechPace);
  assert.equal(resolveSpeechPace(''), resolveSpeechPace('rien de special'));
});

test('toute DA qui définit un rythme garde l\'ancrage "fills about 10 seconds"', () => {
  for (const item of ART_DIRECTIONS.filter((entry) => entry.speechPace)) {
    assert.match(item.speechPace, /fills about 10 seconds/, item.id);
  }
});
