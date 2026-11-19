import test from 'node:test';
import assert from 'node:assert/strict';

import { GENERATABLE_KINDS, ILLUSTRATION_KINDS } from '../server/data/facelessIllustrations.js';
import { isLogoShape } from '../server/utils/facelessTemplate.js';
import { shotIsLogo } from '../server/utils/facelessTemplateDashboard.js';

test('isLogoShape : marquée « logo » ou presque carrée et petite = logo ; une capture de site non', () => {
  assert.equal(isLogoShape(1200, 760, true), true);
  assert.equal(isLogoShape(512, 512, false), true);
  assert.equal(isLogoShape(900, 780, false), true);
  assert.equal(isLogoShape(1200, 760, false), false);
  assert.equal(isLogoShape(400, 800, false), false);
  assert.equal(isLogoShape(1600, 1600, false), false);
  assert.equal(isLogoShape(0, 0, false), false);
});

test('Logo de marque : type connu, seulement importé (jamais généré)', () => {
  assert.equal(ILLUSTRATION_KINDS.logo, 'Logo de marque');
  assert.ok(!GENERATABLE_KINDS.includes('logo'));
  assert.deepEqual(GENERATABLE_KINDS, ['photo', 'illustration', 'mockup']);
  assert.equal(shotIsLogo({ kind: 'logo' }), true);
  assert.equal(shotIsLogo({ kind: 'mockup' }), false);
  assert.equal(shotIsLogo(undefined), false);
});
