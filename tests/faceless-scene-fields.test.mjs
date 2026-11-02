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

test('trame de depart et sauvegarde du plan en cours', async () => {
  const { starterPlan, blankScene, parseSavedPlan, serializePlan, PLAN_MAX_AGE_MS } = await import('../app/utils/facelessStarterPlan.js');
  const plan = starterPlan();
  assert.equal(plan.scenes.length, 5);
  assert.deepEqual(plan.scenes.map((s) => s.layout), ['hook', 'avatar', 'avatar', 'avatar', 'avatar']);
  assert.ok(plan.scenes.every((s) => s.say === ''), 'aucun texte dit : une scene vide est ignoree au montage');
  // deux scenes vides ne partagent jamais le meme objet (modifier l une ne touche pas l autre)
  assert.notEqual(blankScene().avatar, blankScene().avatar);

  const now = 1_000_000_000_000;
  const raw = serializePlan(plan, { profileId: 'p1', now });
  assert.equal(parseSavedPlan(raw, { profileId: 'p1', now: now + 60_000 })?.plan.scenes.length, 5);
  assert.equal(parseSavedPlan(raw, { profileId: 'autre', now }), null, 'autre persona : pas de restauration');
  assert.equal(parseSavedPlan(raw, { profileId: 'p1', now: now + PLAN_MAX_AGE_MS + 1 }), null, 'plan perime');
  assert.equal(parseSavedPlan('pas du json', { profileId: 'p1', now }), null);
  assert.equal(parseSavedPlan(JSON.stringify({ profileId: '', savedAt: now, plan: { scenes: [] } }), { profileId: '', now }), null);
});

test('mot geant : libelle modifiable selon le modele, et une phrase de 22 caracteres n est plus coupee', async () => {
  assert.deepEqual(sceneFieldsFor('word', 'dashboard').fields.map((f) => f.key), ['word', 'title']);
  assert.deepEqual(sceneFieldsFor('word', 'journal').fields.map((f) => f.key), ['word', 'title', 'text']);
  assert.deepEqual(sceneFieldsFor('word', 'cahier').fields.map((f) => f.key), ['word', 'text']);
  assert.deepEqual(sceneFieldsFor('word', 'classic').fields.map((f) => f.key), ['word']);
  assert.equal(sceneFieldsFor('word', 'dashboard').fields[0].max, 30);

  const { sanitizeFacelessScene } = await import('../server/utils/facelessPlanGenerator.js');
  const scene = sanitizeFacelessScene({ say: 'Reformuler la promesse change tout.', layout: 'word', word: 'Reformuler la promesse', title: 'Mon libellé' });
  assert.equal(scene.word, 'Reformuler la promesse');
  assert.equal(scene.title, 'Mon libellé');
  assert.equal(scene.layout, 'word');
});
