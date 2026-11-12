import test from 'node:test';
import assert from 'node:assert/strict';
import { canAutoPublish, normalizePlannedPlatforms } from '../server/utils/plannedPlatforms.js';

test('normalizePlannedPlatforms : liste blanche, majuscules, sans doublon', () => {
  assert.deepEqual(normalizePlannedPlatforms(['x', 'Instagram', 'INSTAGRAM', 'myspace', '', null]), ['X', 'INSTAGRAM']);
  assert.deepEqual(normalizePlannedPlatforms([]), []);
  assert.equal(normalizePlannedPlatforms(undefined), undefined);
  assert.equal(normalizePlannedPlatforms('INSTAGRAM'), undefined);
});

test('canAutoPublish : seulement si Instagram est choisi', () => {
  assert.equal(canAutoPublish(['TIKTOK', 'INSTAGRAM']), true);
  assert.equal(canAutoPublish(['X', 'TIKTOK']), false);
  assert.equal(canAutoPublish([]), false);
  assert.equal(canAutoPublish(undefined), false);
});
