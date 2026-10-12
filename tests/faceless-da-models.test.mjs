import test from 'node:test';
import assert from 'node:assert/strict';

import { FACELESS_FONTS, FACELESS_PRESETS } from '../server/data/facelessThemes.js';
import { defaultFacelessStyle, normalizeFacelessStyle } from '../server/utils/facelessStyle.js';

const NEW_MODELS = ['atelier-vert', 'atelier-bleu', 'atelier-bordeaux', 'terminal'];

// Contraste WCAG entre deux couleurs hexadecimales.
const lin = (c) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const lum = (hex) => { const n = parseInt(hex.slice(1), 16); return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255); };
const ratio = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };

test('les 4 nouveaux modèles : présents, nommés et décrits, sans doublon avec les autres', () => {
  const keys = Object.keys(FACELESS_PRESETS);
  for (const key of NEW_MODELS) assert.ok(keys.includes(key), key);
  assert.equal(new Set(keys).size, keys.length);

  const labels = keys.map((key) => FACELESS_PRESETS[key].label);
  const names = keys.map((key) => FACELESS_PRESETS[key].style.name);
  assert.equal(new Set(labels).size, labels.length, 'deux modèles ne portent pas le même libellé');
  assert.equal(new Set(names).size, names.length);
  for (const key of NEW_MODELS) {
    assert.ok(FACELESS_PRESETS[key].label.length > 2);
    assert.ok(FACELESS_PRESETS[key].description.length > 20);
    assert.equal(FACELESS_PRESETS[key].style.preset, key);
  }
});

test('les 4 nouveaux modèles : valeurs valides, rien n est remplacé par un repli à la normalisation', () => {
  for (const key of NEW_MODELS) {
    const base = FACELESS_PRESETS[key].style;
    assert.ok(Object.hasOwn(FACELESS_FONTS, base.font), `${key} : police`);
    const style = normalizeFacelessStyle({ ...base });
    assert.equal(style.preset, key);
    assert.equal(style.name, base.name);
    assert.equal(style.font, base.font);
    assert.equal(style.card, base.card);
    assert.equal(style.background, base.background);
    assert.equal(style.motion, base.motion);
    assert.equal(style.density, base.density);
    assert.deepEqual(style.palette, base.palette, `${key} : toutes les couleurs sont des hexadécimaux valides`);
    assert.deepEqual(style.enters, base.enters);
    assert.deepEqual(style.captions, base.captions);
    assert.equal(style.rules, base.rules.replace(/\s+/g, ' ').trim());
    assert.equal(defaultFacelessStyle(key, 'MALE').preset, key);
    assert.equal(defaultFacelessStyle(key, 'FEMALE').preset, key);
  }
});

test('les 4 nouveaux modèles : lisibles (texte, cartes, accent sur les deux fonds, blanc sur fond profond)', () => {
  for (const key of NEW_MODELS) {
    const p = FACELESS_PRESETS[key].style.palette;
    assert.ok(ratio(p.text, p.background) >= 7, `${key} : texte sur fond principal`);
    assert.ok(ratio(p.text, p.backgroundAlt) >= 7, `${key} : texte sur fond secondaire`);
    assert.ok(ratio(p.cardText, p.card) >= 7, `${key} : texte de carte`);
    // L accent porte les mots clés : seuil AA du texte courant.
    assert.ok(ratio(p.accent, p.background) >= 4.5, `${key} : accent sur fond principal`);
    assert.ok(ratio(p.accent, p.backgroundAlt) >= 4.5, `${key} : accent sur fond secondaire`);
    assert.ok(ratio('#ffffff', p.dark) >= 7, `${key} : blanc sur fond profond`);
  }
});

test('famille Atelier : fonds secondaire et profond teintés (pas crème / noir), même structure', () => {
  const family = ['atelier-vert', 'atelier-bleu', 'atelier-bordeaux'].map((key) => FACELESS_PRESETS[key].style);
  for (const style of family) {
    const { background, backgroundAlt, dark } = style.palette;
    assert.equal(background, '#f4efe6', 'le crème reste commun à la famille');
    assert.notEqual(backgroundAlt, background, 'le fond secondaire porte la couleur');
    assert.notEqual(dark, '#000000');
    assert.ok(lum(dark) < 0.05, 'fond profond');
    assert.ok(style.rules.includes('Alterner les fonds'), 'la règle d alternance des fonds est dans la DA');
  }
  // Une famille = les mêmes réglages, seules les couleurs changent.
  const [first, ...others] = family;
  for (const other of others) {
    for (const key of ['font', 'card', 'background', 'decor', 'motion', 'density']) assert.equal(other[key], first[key], key);
    assert.deepEqual(other.enters, first.enters);
    assert.deepEqual(other.captions, first.captions);
    assert.equal(other.rules, first.rules);
  }
  // Les trois couleurs d accent sont distinctes.
  assert.equal(new Set(family.map((style) => style.palette.accent)).size, 3);
});

test('les 7 modèles d origine sont inchangés', () => {
  const originals = ['papercraft-pastel', 'brutalisme', 'cahier-ecolier', 'neon-nuit', 'kraft-carnet', 'luxe-minimal', 'pop-jaune'];
  assert.deepEqual(Object.keys(FACELESS_PRESETS).slice(0, 7), originals);
  assert.equal(FACELESS_PRESETS['luxe-minimal'].style.palette.accent, '#b8893b');
  assert.equal(FACELESS_PRESETS['brutalisme'].style.palette.accent, '#e8542f');
});
