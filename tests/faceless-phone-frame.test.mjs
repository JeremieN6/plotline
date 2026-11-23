import test from 'node:test';
import assert from 'node:assert/strict';

import { buildFacelessHtml, isLogoShape, isPhoneShape } from '../server/utils/facelessTemplate.js';
import { defaultFacelessStyle } from '../server/utils/facelessStyle.js';

test('isPhoneShape : portrait (hauteur >= 1,4 x largeur) = telephone ; large, carré ou inconnu = non', () => {
  assert.equal(isPhoneShape(1080, 1920), true);
  assert.equal(isPhoneShape(1170, 2532), true);
  assert.equal(isPhoneShape(1000, 1400), true);
  assert.equal(isPhoneShape(1000, 1399), false);
  assert.equal(isPhoneShape(1600, 900), false);
  assert.equal(isPhoneShape(600, 600), false);
  assert.equal(isPhoneShape(0, 100), false);
  assert.equal(isPhoneShape(undefined, undefined), false);
});

test('un logo (carré) n’est jamais pris pour un téléphone, même s’il est marqué logo', () => {
  assert.equal(isLogoShape(600, 600, false), true);
  assert.equal(isPhoneShape(600, 600), false);
});

test('Dashboard : le cadre de téléphone est dans le CSS et la fonction est injectée dans la page', () => {
  const style = { ...defaultFacelessStyle('dashboard-bleu', 'MALE'), screenFrame: true };
  const scenes = [{
    layout: 'photo', image: 'p', start: 0, end: 3, voiceStart: 0, voiceEnd: 2, words: [], say: 'Un texte', beats: [], items: [], sfx: [], captions: false, bg: 'main',
  }];
  const html = buildFacelessHtml({ duration: 3, scenes, captions: [], sfx: [] }, { style, illustrations: { p: { kind: 'screenshot', label: 'p', url: 'mem://p' } } });
  assert.ok(html.includes('.win.ph{'));
  assert.ok(html.includes('.win.ph .wbar{display:none}'));
  assert.ok(html.includes('function isPhoneShape'));
  assert.ok(html.includes("classList.add('ph')"));
});
