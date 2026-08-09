import test from 'node:test';
import assert from 'node:assert/strict';

import { isAccountType, normalizeAccountType } from '../server/utils/accountType.js';
import { detectAspectRatioFromPrompt, resolveAspectRatio } from '../server/utils/aspectRatio.js';
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

test('selectVideoModel defaults to veo', () => {
  const model = selectVideoModel('Create a clean product shot with studio lighting');
  assert.equal(model, 'veo');
});

test('selectVideoModel ne renvoie jamais seedance par defaut', () => {
  // L endpoint Seedance par defaut n existe pas: le selectionner automatiquement
  // faisait echouer la generation avec un "fetch failed" opaque.
  const prompts = [
    'Create a clean product shot with studio lighting',
    'Une femme prepare un cafe dans sa cuisine',
    '',
  ];

  for (const prompt of prompts) {
    assert.notEqual(selectVideoModel(prompt), 'seedance');
  }
});

test('le ratio ecrit dans le prompt fait foi', () => {
  assert.equal(detectAspectRatioFromPrompt('Horizontal 16:9 format, beauty institute'), '16:9');
  assert.equal(detectAspectRatioFromPrompt('Vertical 9:16 portrait format video'), '9:16');
  assert.equal(detectAspectRatioFromPrompt('format 16/9 pour youtube'), '16:9');
  assert.equal(detectAspectRatioFromPrompt('square format product shot'), '1:1');
});

test('un decor ou un style ne sont pas pris pour un cadrage', () => {
  // "landscape" au sens paysage et "portrait" au sens photo de visage ne
  // doivent pas imposer un format: seule une mention qualifiee compte.
  assert.equal(detectAspectRatioFromPrompt('A cinematic landscape at sunset'), null);
  assert.equal(detectAspectRatioFromPrompt('Professional portrait photography'), null);
  assert.equal(detectAspectRatioFromPrompt('Une estheticienne tend un flacon'), null);
});

test('repli seulement quand le prompt ne dit rien', () => {
  assert.equal(resolveAspectRatio('Une scene simple'), '9:16');
  assert.equal(resolveAspectRatio('Horizontal 16:9 format'), '16:9');
});
