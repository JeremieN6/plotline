import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MAX_BROLL_IMAGES,
  applyBrollToBuffer,
  buildBrollPlanSystemPrompt,
  generateBrollImages,
  normalizeBrollCount,
  parseBrollPlan,
  planBrollPrompts,
} from '../server/utils/brollGeneration.js';

const LONG_PROMPT = 'A close-up of a hand pouring cold water from a metal bottle into a glass on a wooden kitchen table, natural window light.';

test('normalizeBrollCount : entier entre 0 et le plafond, 0 si invalide', () => {
  assert.equal(normalizeBrollCount(undefined), 0);
  assert.equal(normalizeBrollCount(''), 0);
  assert.equal(normalizeBrollCount('abc'), 0);
  assert.equal(normalizeBrollCount(0), 0);
  assert.equal(normalizeBrollCount(-2), 0);
  assert.equal(normalizeBrollCount(1), 1);
  assert.equal(normalizeBrollCount('2'), 2);
  assert.equal(normalizeBrollCount(99), MAX_BROLL_IMAGES);
  assert.equal(MAX_BROLL_IMAGES, 3);
});

test('buildBrollPlanSystemPrompt : demande exactement N images, sans visage ni texte, en JSON brut', () => {
  const prompt = buildBrollPlanSystemPrompt(2);
  assert.match(prompt, /exactement 2 image/);
  assert.match(prompt, /aucun visage reconnaissable/);
  assert.match(prompt, /aucun texte lisible, aucun logo/);
  assert.match(prompt, /JSON brut/);
  assert.equal((prompt.match(/\{"moment": string, "prompt": string\}/g) || []).length, 2);
});

test('parseBrollPlan : JSON valide, clotures retirees, au plus N, prompts trop courts ou longs ecartes', () => {
  const raw = JSON.stringify({ shots: [{ moment: 'a', prompt: LONG_PROMPT }, { moment: 'b', prompt: 'trop court' }, { moment: 'c', prompt: LONG_PROMPT + ' bis' }, { moment: 'd', prompt: LONG_PROMPT + ' ter' }] });
  assert.equal(parseBrollPlan(raw, 2).length, 2);
  assert.equal(parseBrollPlan(raw, 5).length, 3);
  assert.equal(parseBrollPlan('```json\n' + raw + '\n```', 1).length, 1);
  assert.equal(parseBrollPlan('Voici : ' + raw + ' voila', 1).length, 1);
  assert.deepEqual(parseBrollPlan('pas du json', 2), []);
  assert.deepEqual(parseBrollPlan('{"shots": "non"}', 2), []);
  assert.deepEqual(parseBrollPlan(raw, 0), []);
  assert.deepEqual(parseBrollPlan(JSON.stringify({ shots: [{ prompt: 'x'.repeat(600) }] }), 1), []);
});

test('planBrollPrompts : appelle le client injecte et renvoie les prompts valides', async () => {
  let received;
  const prompts = await planBrollPrompts({
    scriptText: 'Mon texte parle',
    count: 1,
    createMessage: async (request) => {
      received = request;
      return { content: [{ type: 'text', text: JSON.stringify({ shots: [{ moment: 'x', prompt: LONG_PROMPT }] }) }] };
    },
  });
  assert.deepEqual(prompts, [LONG_PROMPT]);
  assert.match(received.system, /exactement 1 image/);
  assert.match(received.messages[0].content, /Mon texte parle/);
});

test('generateBrollImages : une image qui echoue est ignoree, les autres gardees', async () => {
  const calls = [];
  const images = await generateBrollImages(['a'.repeat(30), 'b'.repeat(30), 'c'.repeat(30)], async (prompt) => {
    calls.push(prompt);
    if (prompt.startsWith('b')) throw new Error('IMAGE_SAFETY');
    return { data: Buffer.from('img').toString('base64'), mimeType: 'image/png' };
  });
  assert.equal(calls.length, 3);
  assert.equal(images.length, 2);
  assert.equal(images[0].mimeType, 'image/png');
  assert.ok(calls[0].includes('no text, no logos'));
});

test('applyBrollToBuffer : sans plans demandes ou sans script, aucun appel et video inchangee', async () => {
  const video = Buffer.from('video');
  const boom = async () => { throw new Error('ne doit pas etre appele'); };
  const deps = { planBrollPrompts: boom, generateBrollImages: boom, addBrollToVideo: boom };
  assert.equal(await applyBrollToBuffer(video, { count: 0, scriptText: 'texte' }, deps), video);
  assert.equal(await applyBrollToBuffer(video, { count: 2, scriptText: '  ' }, deps), video);
  assert.equal(await applyBrollToBuffer(video, undefined, deps), video);
});

test('applyBrollToBuffer : enchaine plan, images, pose, et renvoie la nouvelle video', async () => {
  const video = Buffer.from('video');
  const composed = Buffer.from('video-avec-broll');
  const seen = {};
  const result = await applyBrollToBuffer(video, { count: 2, scriptText: 'texte parle' }, {
    planBrollPrompts: async (args) => { seen.plan = args; return ['p1', 'p2']; },
    generateBrollImages: async (prompts) => { seen.prompts = prompts; return [{ buffer: Buffer.from('i1') }, { buffer: Buffer.from('i2') }]; },
    addBrollToVideo: async (buffer, images) => { seen.images = images.length; return { buffer: composed, applied: 2, slots: [] }; },
  });
  assert.equal(result, composed);
  assert.equal(seen.plan.count, 2);
  assert.deepEqual(seen.prompts, ['p1', 'p2']);
  assert.equal(seen.images, 2);
});

test('applyBrollToBuffer : ne leve jamais, video d origine si plan vide, images vides, pose ratee ou erreur', async () => {
  const video = Buffer.from('video');
  const ok = { count: 1, scriptText: 'texte' };
  const images = async () => [{ buffer: Buffer.from('i') }];
  const plan = async () => ['p'];

  assert.equal(await applyBrollToBuffer(video, ok, { planBrollPrompts: async () => [] }), video);
  assert.equal(await applyBrollToBuffer(video, ok, { planBrollPrompts: plan, generateBrollImages: async () => [] }), video);
  assert.equal(await applyBrollToBuffer(video, ok, { planBrollPrompts: plan, generateBrollImages: images, addBrollToVideo: async () => ({ buffer: Buffer.from('x'), applied: 0, slots: [] }) }), video);
  assert.equal(await applyBrollToBuffer(video, ok, { planBrollPrompts: async () => { throw new Error('Claude indisponible'); } }), video);
  assert.equal(await applyBrollToBuffer(video, ok, { planBrollPrompts: plan, generateBrollImages: async () => { throw new Error('quota'); } }), video);
});
