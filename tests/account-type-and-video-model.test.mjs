import test from 'node:test';
import assert from 'node:assert/strict';

import { isAccountType, normalizeAccountType } from '../server/utils/accountType.js';
import { detectAspectRatioFromPrompt, resolveAspectRatio } from '../server/utils/aspectRatio.js';
import {
  buildSeedanceRequestBody,
  extractSeedanceTaskId,
  extractSeedanceVideoUrl,
  resolveGenerationType,
  resolveSeedanceApiBase,
} from '../server/utils/seedanceGenerator.js';
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
  // Seedance reste un choix explicite tant qu il n a pas ete eprouve en production.
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

test('seedance: on ne garde que l origine de SEEDANCE_API_URL', () => {
  // La variable a longtemps contenu une URL d endpoint complete: la reutiliser
  // telle quelle produirait des chemins doubles du type /v1/videos/v1/videos.
  assert.equal(resolveSeedanceApiBase(''), 'https://api.seevio.ai');
  assert.equal(resolveSeedanceApiBase('https://api.seevio.ai'), 'https://api.seevio.ai');
  assert.equal(resolveSeedanceApiBase('https://api.seevio.ai/v1/videos/generations'), 'https://api.seevio.ai');
  assert.equal(resolveSeedanceApiBase('pas-une-url'), 'https://api.seevio.ai');
});

test('seedance: le mode depend de la presence d une image de depart', () => {
  assert.equal(resolveGenerationType([]), 'text-to-video');
  assert.equal(resolveGenerationType(null), 'text-to-video');
  assert.equal(resolveGenerationType(['https://blob/frame.jpg']), 'image-to-video');
});

test('seedance: le corps de requete respecte le format attendu', () => {
  const textBody = buildSeedanceRequestBody({ prompt: 'Une scene', aspectRatio: '16:9' });
  assert.equal(textBody.model, 'seedance-2-5');
  assert.equal(textBody.input.generation_type, 'text-to-video');
  assert.equal(textBody.input.aspect_ratio, '16:9');
  // Sans image, la cle ne doit pas etre envoyee vide.
  assert.equal('image_urls' in textBody.input, false);

  const imageBody = buildSeedanceRequestBody({ prompt: 'Une scene', imageUrls: ['https://blob/frame.jpg'] });
  assert.equal(imageBody.input.generation_type, 'image-to-video');
  assert.deepEqual(imageBody.input.image_urls, ['https://blob/frame.jpg']);
  assert.equal(imageBody.input.aspect_ratio, '9:16');
});

test('seedance: taskId et url de video sont lus quelle que soit l enveloppe', () => {
  assert.equal(extractSeedanceTaskId({ taskId: 'a' }), 'a');
  assert.equal(extractSeedanceTaskId({ data: { task_id: 'b' } }), 'b');
  assert.equal(extractSeedanceTaskId({}), '');

  assert.equal(extractSeedanceVideoUrl({ data: { results: ['https://v/1.mp4'] } }), 'https://v/1.mp4');
  assert.equal(extractSeedanceVideoUrl({ data: { results: [{ url: 'https://v/2.mp4' }] } }), 'https://v/2.mp4');
  assert.equal(extractSeedanceVideoUrl({ data: { results: [] } }), '');
});
