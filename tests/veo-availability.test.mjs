import test from 'node:test';
import assert from 'node:assert/strict';

import { VEO_PREVIEW_SUNSET, VEO_RETIRED_MESSAGE, isVeoEnabled } from '../server/utils/veoAvailability.js';
import { selectVideoModel } from '../server/utils/videoModelSelector.js';

const at = (iso) => new Date(iso);

test('Veo est disponible jusqu a la date de retrait de Google, puis retire tout seul', () => {
  assert.equal(VEO_PREVIEW_SUNSET, '2026-10-22T00:00:00Z');
  assert.equal(isVeoEnabled({}, at('2026-10-11T12:00:00Z')), true);
  assert.equal(isVeoEnabled({}, at('2026-10-21T23:59:59Z')), true);
  assert.equal(isVeoEnabled({}, at('2026-10-22T00:00:00Z')), false);
  assert.equal(isVeoEnabled({}, at('2027-01-01T00:00:00Z')), false);
});

test('VEO_ENABLED prime sur la date, dans les deux sens', () => {
  const after = at('2026-11-01T00:00:00Z');
  const before = at('2026-10-11T00:00:00Z');
  for (const value of ['true', '1', 'yes', ' TRUE ']) assert.equal(isVeoEnabled({ VEO_ENABLED: value }, after), true, value);
  for (const value of ['false', '0', 'no', ' False ']) assert.equal(isVeoEnabled({ VEO_ENABLED: value }, before), false, value);
  // Valeur vide ou inconnue : on retombe sur la date.
  assert.equal(isVeoEnabled({ VEO_ENABLED: '' }, before), true);
  assert.equal(isVeoEnabled({ VEO_ENABLED: 'peut-etre' }, after), false);
});

test('garde serveur : une demande explicite de Veo est refusée (503) une fois retiré, Kling reste accepté', async () => {
  // createError est une globale injectee par Nitro : on la simule.
  globalThis.createError = (options) => Object.assign(new Error(options.statusMessage), options);
  const { resolveVideoModelOrThrow } = await import('../server/utils/videoGeneration.js');
  const original = process.env.VEO_ENABLED;
  const runtimeConfig = { geminiApiKey: 'cle-de-test', klingApiKey: 'cle-de-test' };
  const call = (forcedModel) => resolveVideoModelOrThrow({ prompt: 'une scene', withFaceRef: false, influencer: null, runtimeConfig, forcedModel });
  try {
    process.env.VEO_ENABLED = 'false';
    assert.throws(() => call('veo'), (error) => error.statusCode === 503 && /Veo n est plus disponible/.test(error.statusMessage));
    assert.equal(call('kling'), 'kling');
    assert.equal(call('omniflash'), 'omniflash');
    assert.equal(call('auto'), 'kling', 'Automatique retombe sur Kling');

    process.env.VEO_ENABLED = 'true';
    assert.equal(call('veo'), 'veo');
  } finally {
    if (original === undefined) delete process.env.VEO_ENABLED;
    else process.env.VEO_ENABLED = original;
  }
});

test('le message de refus nomme la cause et les alternatives', () => {
  assert.match(VEO_RETIRED_MESSAGE, /Veo/);
  assert.match(VEO_RETIRED_MESSAGE, /22 octobre 2026/);
  assert.match(VEO_RETIRED_MESSAGE, /Kling/);
  assert.match(VEO_RETIRED_MESSAGE, /Omni Flash/);
});

test('sans option, le sélecteur suit l état réel de Veo (variable VEO_ENABLED)', () => {
  const original = process.env.VEO_ENABLED;
  try {
    process.env.VEO_ENABLED = 'false';
    assert.equal(selectVideoModel('Create a clean product shot'), 'kling');
    process.env.VEO_ENABLED = 'true';
    assert.equal(selectVideoModel('Create a clean product shot'), 'veo');
  } finally {
    if (original === undefined) delete process.env.VEO_ENABLED;
    else process.env.VEO_ENABLED = original;
  }
});
