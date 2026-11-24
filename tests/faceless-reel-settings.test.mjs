import test from 'node:test';
import assert from 'node:assert/strict';

import { DEFAULT_REEL_SETTINGS, REEL_DURATIONS, describeReelSettings, normalizeReelSettings } from '../server/utils/facelessReelSettings.js';
import { FACELESS_DURATIONS } from '../server/utils/facelessPlanGenerator.js';
import { mergeClientStyle, normalizeFacelessStyle } from '../server/utils/facelessStyle.js';
import { V3_STABILITY } from '../server/utils/elevenLabsTts.js';

test('reglage des Reels : valeurs inconnues = defaut, durees alignees sur /studio/faceless', () => {
  assert.deepEqual(REEL_DURATIONS, FACELESS_DURATIONS);
  assert.deepEqual(normalizeReelSettings(undefined), DEFAULT_REEL_SETTINGS);
  assert.deepEqual(normalizeReelSettings({ durationSeconds: 99, styleSlot: 7, stability: 'x' }), DEFAULT_REEL_SETTINGS);
  assert.deepEqual(normalizeReelSettings({ durationSeconds: '60', styleSlot: 1, stability: 'creative' }), { durationSeconds: 60, styleSlot: 1, stability: 'creative' });
  assert.equal(V3_STABILITY[normalizeReelSettings({ stability: 'creative' }).stability], 0);
});

test('reglage des Reels : stocke dans la DA principale, jamais pris du client, conserve a l enregistrement de la DA', () => {
  const stored = normalizeFacelessStyle({ reelSettings: { durationSeconds: 60, styleSlot: 1, stability: 'creative' } }, { keepPack: true });
  assert.equal(stored.reelSettings.durationSeconds, 60);
  // Une DA venant du client ne peut pas fixer le reglage.
  assert.deepEqual(normalizeFacelessStyle({ reelSettings: { durationSeconds: 60 } }).reelSettings, DEFAULT_REEL_SETTINGS);
  // Enregistrer la DA depuis sa page garde le reglage deja en base.
  assert.equal(mergeClientStyle(stored, { name: 'Autre' }).reelSettings.stability, 'creative');
});

test('resume affiche sur le plan : dit la duree, la DA, la voix et l expressivite', () => {
  const settings = { durationSeconds: 60, styleSlot: 1, stability: 'creative' };
  assert.equal(
    describeReelSettings(settings, { style: { name: 'Dashboard bleu' }, cloneVoice: { name: 'Jérémie - 2' } }),
    'Vidéo faceless · 60 s · DA Dashboard bleu · voix Jérémie - 2 · expressivité forte',
  );
  assert.equal(describeReelSettings(DEFAULT_REEL_SETTINGS, { style: { name: 'Terminal' } }), 'Vidéo faceless · 30 s · DA Terminal · voix de synthèse');
});
