import test from 'node:test';
import assert from 'node:assert/strict';

import { isAccountType, normalizeAccountType } from '../server/utils/accountType.js';
import { selectVideoModel } from '../server/utils/videoModelSelector.js';

test('normalizeAccountType normalizes to uppercase', () => {
  assert.equal(normalizeAccountType(' brand '), 'BRAND');
  assert.equal(normalizeAccountType('content_creator'), 'CONTENT_CREATOR');
});

test('isAccountType accepts only supported values', () => {
  assert.equal(isAccountType('INFLUENCER_CREATOR'), true);
  assert.equal(isAccountType('CONTENT_CREATOR'), true);
  assert.equal(isAccountType('BRAND'), true);
  assert.equal(isAccountType('OTHER'), false);
  assert.equal(isAccountType(''), false);
});

test('selectVideoModel chooses kling for dynamic prompt', () => {
  const model = selectVideoModel('A dynamic dance action scene with high energy movement');
  assert.equal(model, 'kling');
});

test('selectVideoModel chooses veo for cinematic prompt', () => {
  const model = selectVideoModel('A cinematic slow landscape with atmospheric ambiance');
  assert.equal(model, 'veo');
});

test('selectVideoModel defaults to seedance', () => {
  const model = selectVideoModel('Create a clean product shot with studio lighting');
  assert.equal(model, 'seedance');
});
