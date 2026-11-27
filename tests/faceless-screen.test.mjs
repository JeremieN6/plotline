import test from 'node:test';
import assert from 'node:assert/strict';

import { computerGeometry, phoneGeometry, resolveScreen } from '../server/utils/facelessDevice.js';
import { labelVerdict } from '../server/utils/facelessLabelCard.js';
import { buildFacelessHtml } from '../server/utils/facelessTemplate.js';
import { defaultFacelessStyle, normalizeFacelessStyle } from '../server/utils/facelessStyle.js';
import { resolveRestyle } from '../server/utils/facelessRestyle.js';

const PRESETS = ['papercraft', 'fenetre-orange', 'cahier-bleu', 'editeur-jaune', 'brutal-fluo', 'dashboard-bleu', 'herbier-terracotta', 'hanko-rouge', 'journal-violet'];
const page = (style, scene) => buildFacelessHtml({
  duration: 4,
  scenes: [{ start: 0, end: 4, voiceStart: 0, voiceEnd: 3, words: [], say: 'Un texte', beats: [], items: [], sfx: [], captions: false, bg: 'main', ...scene }],
  captions: [],
  sfx: [],
}, { style });

test('resolveScreen : le choix explicite, sinon l’ancien cadre du seul Dashboard', () => {
  assert.equal(resolveScreen({ screen: 'phone', template: 'cahier' }), 'phone');
  assert.equal(resolveScreen({ screen: 'computer', template: 'herbier' }), 'computer');
  assert.equal(resolveScreen({ screenFrame: true, template: 'dashboard' }), 'computer');
  assert.equal(resolveScreen({ screenFrame: true, template: 'cahier' }), 'none');
  assert.equal(resolveScreen({ screen: 'bidon', template: 'cahier' }), 'none');
});

test('DA : aucun écran par défaut, choix gardé au nettoyage, valeur inconnue refusée', () => {
  for (const preset of PRESETS) assert.equal(defaultFacelessStyle(preset, 'MALE').screen, 'none', preset);
  assert.equal(normalizeFacelessStyle({ preset: 'cahier-bleu', screen: 'phone' }).screen, 'phone');
  assert.equal(normalizeFacelessStyle({ preset: 'cahier-bleu', screen: 'télé' }).screen, 'none');
});

test('toutes les DA : ordinateur et téléphone disponibles ; rien sans choix', () => {
  const scene = { layout: 'title', title: 'Titre', text: 'Texte' };
  for (const preset of PRESETS) {
    const plain = page(defaultFacelessStyle(preset, 'MALE'), scene);
    assert.ok(!plain.includes('class="dv-box'), `${preset} sans écran`);
    const phone = page({ ...defaultFacelessStyle(preset, 'MALE'), screen: 'phone' }, scene);
    assert.ok(phone.includes('class="dv-box dv-phone'), `${preset} téléphone`);
    const computer = page({ ...defaultFacelessStyle(preset, 'MALE'), screen: 'computer' }, scene);
    // Le Dashboard garde son propre cadre d’ordinateur ; les autres prennent la fenêtre commune.
    if (preset === 'dashboard-bleu') assert.ok(computer.includes('class="win') && !computer.includes('class="dv-box'), preset);
    else assert.ok(computer.includes('class="dv-box dv-computer'), `${preset} ordinateur`);
  }
});

test('étiquette produit : aucun ingrédient perdu quelle que soit la DA (8 lignes, phrase du bas)', () => {
  const items = Array.from({ length: 8 }, (_, i) => ({ text: `Ingrédient ${i + 1}`, tone: ['avoid', 'watch', 'good'][i % 3], at: i * 0.2 }));
  for (const preset of PRESETS) {
    for (const screen of ['none', 'computer', 'phone']) {
      const html = page({ ...defaultFacelessStyle(preset, 'MALE'), screen }, { layout: 'label', title: 'Étiquette', text: 'À retenir', items });
      for (const item of items) assert.ok(html.includes(item.text), `${preset}/${screen} : ${item.text}`);
      assert.ok(html.includes('retenir'), `${preset}/${screen} : phrase du bas`);
    }
  }
  assert.deepEqual(labelVerdict({ tone: 'avoid' }), { mark: '✕', word: 'à éviter', tone: 'avoid' });
  assert.equal(labelVerdict({ tone: 'good', sub: 'apaisant' }).word, 'apaisant');
  assert.equal(labelVerdict({}).word, '');
});

test('géométrie : l’appareil reste entre les sous-titres et la zone des réseaux, sans bande vide', () => {
  for (const capBottom of [false, true]) {
    for (const box of [{ top: 800, bottom: 1100 }, { top: 300, bottom: 1700 }, { top: 0, bottom: 500 }]) {
      const g = computerGeometry(box, capBottom);
      assert.ok(g.y >= 330 && g.y + g.height <= (capBottom ? 1500 : 1700) + 1, JSON.stringify({ box, capBottom, g }));
      assert.ok(g.canvasTop <= 0, 'jamais de bande vide au-dessus');
    }
    const p = phoneGeometry(capBottom);
    assert.ok(p.y >= 330 && p.y + p.height <= (capBottom ? 1500 : 1700));
  }
});

test('changer de DA : la DA choisie décide de l’écran, sauf si un autre est demandé', () => {
  const spec = { style: { ...defaultFacelessStyle('dashboard-bleu', 'MALE'), screen: 'computer', screenFrame: true } };
  // La vidéo avait un écran : une DA qui n’en a pas ne le reprend pas.
  const plain = resolveRestyle('preset:cahier-bleu', { spec });
  assert.equal(plain.style.screen, 'none');
  assert.match(plain.label, /écran : aucun/);
  // Une DA enregistrée garde son propre écran, y compris l’ancien cadre du Dashboard.
  const profileStyle = {
    ...defaultFacelessStyle('cahier-bleu', 'MALE'),
    alternates: [
      normalizeFacelessStyle({ ...defaultFacelessStyle('dashboard-bleu', 'MALE'), screen: undefined, screenFrame: true }),
      normalizeFacelessStyle({ ...defaultFacelessStyle('journal-violet', 'MALE'), screen: 'phone' }),
    ],
  };
  const dashboard = resolveRestyle('slot:1', { profileStyle, spec: { style: defaultFacelessStyle('cahier-bleu', 'MALE') } });
  assert.equal(dashboard.style.screen, 'computer');
  assert.equal(dashboard.style.screenFrame, true);
  assert.equal(resolveRestyle('slot:2', { profileStyle, spec }).style.screen, 'phone');
  assert.equal(resolveRestyle('slot:1', { profileStyle, screen: 'none' }).style.screenFrame, false);
  // Écran demandé pour cette vidéo : il remplace celui de la DA.
  assert.equal(resolveRestyle('preset:cahier-bleu', { spec, screen: 'phone' }).style.screen, 'phone');
  assert.equal(resolveRestyle('preset:dashboard-bleu', { spec, screen: 'computer' }).style.screenFrame, true);
});
