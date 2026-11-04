import test from 'node:test';
import assert from 'node:assert/strict';

import { buildScenePreview, buildScenePreviewPage } from '../server/utils/facelessPreview.js';
import { defaultFacelessStyle } from '../server/utils/facelessStyle.js';
import { sanitizeFacelessScene } from '../server/utils/facelessPlanGenerator.js';

const style = defaultFacelessStyle('fenetre-orange', 'MALE');

test('apercu d une scene : le texte saisi est rendu, une scene vide recoit un texte de remplacement', () => {
  const page = buildScenePreviewPage({ say: 'Un chiffre simple.', layout: 'stat', word: '70 %', text: 'Contexte' }, { style });
  assert.match(page.html, /70 %/);
  assert.equal(page.plan.scenes.length, 1);
  assert.ok(page.time > 0);

  const empty = buildScenePreview({ say: '   ', layout: 'hook', text: 'Titre' }, { style });
  assert.equal(empty.scene.say, 'Texte dit de la scène.');
});

test('apercu d une scene : une mise en page incomplete retombe sur avatar, comme au montage', () => {
  const { scene } = buildScenePreview({ say: 'Phrase.', layout: 'stat', word: '' }, { style });
  assert.equal(scene.layout, 'avatar');
});

test('apercu d une scene : balises de ton et asterisques ne comptent pas comme mots a l ecran', () => {
  const { track } = buildScenePreview({ say: '[serious] La règle est **parfaite**.', layout: 'avatar', text: 'x' }, { style });
  assert.deepEqual(track.words.map((w) => w.text), ['La', 'règle', 'est', 'parfaite.']);
});

test('comparaison : la valeur accepte 24 caracteres (16 avant), jamais plus', () => {
  const scene = sanitizeFacelessScene({
    say: 'Un chiffre.', layout: 'stat', word: '5',
    compare: [{ label: 'Cold call moyen', value: 'Résultats faibles ici ok' }, { label: 'a', value: 'x'.repeat(40) }],
  });
  assert.equal(scene.compare[0].value, 'Résultats faibles ici ok');
  assert.equal(scene.compare[1].value.length, 24);
});

test('moteur : les lignes de comparaison longues sont reduites pour tenir (data-fit-row)', () => {
  const stat = { say: 'Un chiffre.', layout: 'stat', word: '5', compare: [{ label: 'Avant', value: '1' }, { label: 'Après', value: '2' }] };
  for (const preset of ['fenetre-orange', 'editeur-jaune', 'brutal-fluo', 'herbier-terracotta', 'hanko-rouge']) {
    const { html } = buildScenePreviewPage(stat, { style: defaultFacelessStyle(preset, 'MALE') });
    assert.match(html, /data-fit-row/, preset);
  }
});
