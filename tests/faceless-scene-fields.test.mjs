import test from 'node:test';
import assert from 'node:assert/strict';
import { sceneFieldsFor, incompleteReason } from '../app/utils/facelessSceneFields.js';

test('chaque mise en page n expose que ses champs', () => {
  assert.deepEqual(sceneFieldsFor('word', 'classic').fields.map((f) => f.key), ['word']);
  assert.deepEqual(sceneFieldsFor('title', 'classic').fields.map((f) => f.key), ['title', 'text']);
  assert.equal(sceneFieldsFor('list', 'classic').items.max, 4);
  assert.equal(sceneFieldsFor('label', 'herbier').items.max, 8);
  assert.equal(sceneFieldsFor('stat', 'classic').compare.max, 3);
  assert.equal(sceneFieldsFor('avatar', 'classic').items, null);
});

test('les champs propres a un modele n apparaissent que pour lui', () => {
  assert.ok(sceneFieldsFor('hook', 'hanko').jp);
  assert.equal(sceneFieldsFor('hook', 'journal').jp, null);
  assert.ok(sceneFieldsFor('title', 'editeur').code);
  assert.equal(sceneFieldsFor('word', 'editeur').code, null);
  assert.ok(sceneFieldsFor('hook', 'brutal').tab);
  assert.equal(sceneFieldsFor('hook', 'classic').tab, null);
  assert.ok(sceneFieldsFor('stat', 'dashboard').series);
  assert.equal(sceneFieldsFor('stat', 'classic').series, null);
  assert.equal(sceneFieldsFor('hook', 'classic').emoji, true);
  assert.equal(sceneFieldsFor('hook', 'fenetre').emoji, false);
});

test('une scene incomplete est signalee comme le fait le serveur', () => {
  assert.match(incompleteReason({ layout: 'hook', text: '' }, 'classic'), /Avatar/);
  assert.equal(incompleteReason({ layout: 'hook', text: 'Salut' }, 'classic'), '');
  assert.match(incompleteReason({ layout: 'list', items: [{ text: 'a' }] }, 'classic'), /2 éléments/);
  assert.equal(incompleteReason({ layout: 'list', items: [{ text: 'a' }, { text: 'b' }] }, 'classic'), '');
  assert.match(incompleteReason({ layout: 'word', word: '' }, 'classic'), /Avatar/);
  assert.equal(incompleteReason({ layout: 'avatar', text: '' }, 'classic'), '');
});

test('cueIsSpoken : un repere absent de la phrase est detecte', async () => {
  const { cueIsSpoken } = await import('../app/utils/facelessSceneFields.js');
  assert.equal(cueIsSpoken("Office manager, outil dédié et long-courrier", 'Long-courrier'), true);
  assert.equal(cueIsSpoken("Office manager, outil dédié", 'Long-courrier'), false);
  assert.equal(cueIsSpoken('[sarcastic] Bref, tout le monde', 'bref'), true);
  assert.equal(cueIsSpoken('abc', ''), true);
});

test('scene photo : sans image, un avertissement ; avec image, aucun', () => {
  assert.match(incompleteReason({ layout: 'photo', image: '' }, 'dashboard'), /image/i);
  assert.equal(incompleteReason({ layout: 'photo', image: 'ill_1' }, 'dashboard'), '');
});
