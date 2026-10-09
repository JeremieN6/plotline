import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BROLL_DEFAULTS,
  addBrollToVideo,
  buildBrollFfmpegArgs,
  deriveSpeechBursts,
  pickBrollSlots,
} from '../server/utils/brollOverlay.js';

test('deriveSpeechBursts : la parole est le complement des silences', () => {
  // 10 s ; silences au debut, au milieu et a la fin.
  const bursts = deriveSpeechBursts([[0, 0.8], [3.2, 4.0], [8.5, 10]], 10);
  assert.deepEqual(bursts, [[0.8, 3.2], [4.0, 8.5]]);
});

test('deriveSpeechBursts : aucun silence = une seule plage ; silence total = aucune', () => {
  assert.deepEqual(deriveSpeechBursts([], 6), [[0, 6]]);
  assert.deepEqual(deriveSpeechBursts([[0, 6]], 6), []);
  // Un trou de parole trop court n est pas une plage.
  assert.deepEqual(deriveSpeechBursts([[0, 1], [1.1, 2]], 2), []);
});

test('pickBrollSlots : fenetre centree dans la plage, loin des bords, de la duree demandee', () => {
  const slots = pickBrollSlots([[0.8, 4]], 10, 1);
  assert.equal(slots.length, 1);
  const [start, end] = slots[0];
  assert.equal(Number((end - start).toFixed(3)), BROLL_DEFAULTS.cutawaySeconds);
  assert.ok(start >= BROLL_DEFAULTS.edgeMarginSeconds);
  // Centree dans la zone utilisable [1 ; 4].
  assert.equal(Number((start + end).toFixed(3)), 5);
});

test('pickBrollSlots : jamais dans la premiere ni la derniere seconde', () => {
  const slots = pickBrollSlots([[0, 1.5], [8.6, 10]], 10, 2);
  assert.deepEqual(slots, []);
});

test('pickBrollSlots : plage trop courte ignoree, plage juste assez longue raccourcit le plan', () => {
  assert.deepEqual(pickBrollSlots([[3, 3.8]], 10, 1), []);
  const [slot] = pickBrollSlots([[3, 4.5]], 10, 1);
  assert.equal(Number((slot[1] - slot[0]).toFixed(3)), 1.5);
});

test('pickBrollSlots : plusieurs plans espaces et tries, jamais plus que demande', () => {
  const bursts = [[1, 3.2], [3.4, 6], [6.3, 9]];
  const slots = pickBrollSlots(bursts, 10, 3);
  for (let i = 1; i < slots.length; i += 1) {
    assert.ok(slots[i][0] > slots[i - 1][0], 'tries');
  }
  assert.ok(slots.length <= 3);
  assert.equal(pickBrollSlots(bursts, 10, 1).length, 1);
  assert.deepEqual(pickBrollSlots(bursts, 10, 0), []);
  assert.deepEqual(pickBrollSlots([], 10, 2), []);
});

test('pickBrollSlots : une longue plage accueille plusieurs plans espaces', () => {
  const slots = pickBrollSlots([[0, 10]], 10, 5);
  assert.equal(slots.length, 2);
  assert.ok(slots[1][0] - slots[0][1] >= BROLL_DEFAULTS.minGapSeconds);
  assert.ok(slots[0][0] >= BROLL_DEFAULTS.edgeMarginSeconds && slots[1][1] <= 10 - BROLL_DEFAULTS.edgeMarginSeconds);
});

test('deriveSpeechBursts : les micro-pauses sont fusionnees seulement avec mergeGap', () => {
  const silences = [[0, 0.8], [3.2, 3.7], [8.5, 10]];
  assert.deepEqual(deriveSpeechBursts(silences, 10), [[0.8, 3.2], [3.7, 8.5]]);
  assert.deepEqual(deriveSpeechBursts(silences, 10, { mergeGap: 0.8 }), [[0.8, 8.5]]);
  // Un silence de debut ou de fin n est jamais fusionne.
  assert.deepEqual(deriveSpeechBursts([[0, 0.5], [9.6, 10]], 10, { mergeGap: 0.8 }), [[0.5, 9.6]]);
});


test('buildBrollFfmpegArgs : une image par plan, enable sur la fenetre, audio conserve sans reencodage', () => {
  const args = buildBrollFfmpegArgs({
    videoPath: 'in.mp4',
    items: [
      { imagePath: 'a.jpg', start: 2.5, end: 4.5 },
      { imagePath: 'b.png', start: 6, end: 8 },
    ],
    width: 720,
    height: 1280,
    outputPath: 'out.mp4',
  });

  assert.equal(args.filter((value) => value === '-i').length, 3);
  const graph = args[args.indexOf('-filter_complex') + 1];
  assert.match(graph, /enable='between\(t,2\.500,4\.500\)'/);
  assert.match(graph, /enable='between\(t,6\.000,8\.000\)'/);
  assert.match(graph, /setpts=PTS-STARTPTS\+2\.500\/TB/);
  assert.match(graph, /zoompan=z='1\+0\.08\*on\/60'/);
  assert.ok(graph.endsWith('[v]'));
  assert.deepEqual(args.slice(args.indexOf('-map')), [
    '-map', '[v]', '-map', '0:a?',
    '-c:v', 'libx264', '-crf', '18', '-preset', 'fast', '-pix_fmt', 'yuv420p',
    '-c:a', 'copy', 'out.mp4',
  ]);
});

test('addBrollToVideo : sans image, rien ne change et rien n est lance', async () => {
  const video = Buffer.from('pas une vraie video');
  const result = await addBrollToVideo(video, []);
  assert.equal(result.buffer, video);
  assert.equal(result.applied, 0);
});

test('addBrollToVideo : ne leve jamais, renvoie la video d origine si ffmpeg echoue', async () => {
  const video = Buffer.from('pas une vraie video');
  const result = await addBrollToVideo(video, [{ buffer: Buffer.from('pas une image') }]);
  assert.equal(result.buffer, video);
  assert.equal(result.applied, 0);
});
