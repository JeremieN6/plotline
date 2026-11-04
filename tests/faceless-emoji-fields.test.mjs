import test from 'node:test';
import assert from 'node:assert/strict';

import { sceneEmoji, sceneFieldsFor } from '../app/utils/facelessSceneFields.js';
import { buildFacelessHtml } from '../server/utils/facelessTemplate.js';
import { defaultFacelessStyle } from '../server/utils/facelessStyle.js';

const TEMPLATE_PRESETS = {
  classic: 'papercraft-pastel', fenetre: 'fenetre-orange', cahier: 'cahier-vert', editeur: 'editeur-jaune', brutal: 'brutal-fluo',
  dashboard: 'dashboard-bleu', herbier: 'herbier-terracotta', hanko: 'hanko-rouge', journal: 'journal-violet',
};

const base = { say: 'Un texte dit.', start: 0, end: 4, words: [], sfx: [], beats: [], captionChunks: [], avatar: { beats: [] }, bg: 'main', captions: false };
const render = (preset, scene) => buildFacelessHtml({ scenes: [{ ...base, ...scene }], duration: 4, voice: [], sfx: [] }, { style: defaultFacelessStyle(preset, 'MALE') });

test('emoji d un element de liste : propose seulement la ou le modele le dessine (classique)', () => {
  assert.equal(sceneFieldsFor('list', 'classic').items.emoji, true);
  for (const template of Object.keys(TEMPLATE_PRESETS).filter((t) => t !== 'classic')) {
    assert.equal(sceneFieldsFor('list', template).items.emoji, false, template);
  }
});

test('emoji d un element de liste : verifie sur le rendu, seul le classique l affiche', () => {
  const list = { layout: 'list', title: 'Liste', items: [{ emoji: '🦄', text: 'Un', at: 0 }, { emoji: '🦄', text: 'Deux', at: 1 }] };
  for (const [template, preset] of Object.entries(TEMPLATE_PRESETS)) {
    assert.equal(render(preset, list).includes('🦄'), template === 'classic', template);
  }
});

test('emoji d une scene : classique (accroche, chapitre, mot, logo) ; logo seul pour Cahier, Dashboard et Fenetre', () => {
  for (const kind of ['hook', 'title', 'word', 'logo']) assert.equal(sceneEmoji('classic', kind), true, kind);
  assert.equal(sceneEmoji('classic', 'list'), false);
  for (const template of ['cahier', 'dashboard', 'fenetre']) {
    assert.equal(sceneEmoji(template, 'logo'), true, template);
    assert.equal(sceneEmoji(template, 'hook'), false, template);
  }
  for (const template of ['editeur', 'brutal', 'herbier', 'hanko', 'journal']) assert.equal(sceneEmoji(template, 'logo'), false, template);
});

test('emoji d un logo : le rendu l affiche exactement pour les modeles ou l editeur le propose', () => {
  const logo = { layout: 'logo', word: 'Outil', emoji: '🦄' };
  for (const [template, preset] of Object.entries(TEMPLATE_PRESETS)) {
    assert.equal(render(preset, logo).includes('🦄'), sceneEmoji(template, 'logo'), template);
  }
});
