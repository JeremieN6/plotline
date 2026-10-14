import test from 'node:test';
import assert from 'node:assert/strict';

import { generateOwnVoicePlan, produceOwnVoiceVideo } from '../server/utils/facelessOwnVoice.js';
import { attachNewImages } from '../server/utils/facelessVideoJob.js';

const reply = (obj, seen) => async (request) => {
  if (seen) seen.push(request);
  return { content: [{ type: 'text', text: JSON.stringify(obj) }] };
};

const scenes = [{ from: 0, to: 2, say: 'Salut tout le monde.' }, { from: 3, to: 6, say: 'Voici mon clavier.' }, { from: 7, to: 9, say: 'Et mon ecran.' }];
const claudePlan = {
  title: 'T', caption: 'C', hashtags: ['a'],
  scenes: [
    { say: 'x', layout: 'hook', text: 'Salut' },
    { say: 'x', layout: 'photo', newImage: { kind: 'photo', prompt: 'A mechanical keyboard on a wooden desk' } },
    { say: 'x', layout: 'photo', newImage: { kind: 'mockup', prompt: 'A code editor on a laptop screen' } },
  ],
};

test('ma voix : par defaut, aucune nouvelle image (consigne absente, demande ecartee)', async () => {
  const seen = [];
  const plan = await generateOwnVoicePlan({ scenes, createMessage: reply(claudePlan, seen) });
  assert.ok(!seen[0].system.includes('nouvelle(s) image(s)'), 'Claude ne sait meme pas qu il peut en demander');
  assert.ok(plan.scenes.every((scene) => !scene.newImage), 'aucune demande conservee');
  // Une scene "photo" sans image retombe en "avatar" : la video se fait quand meme.
  assert.equal(plan.scenes[1].layout, 'avatar');
});

test('ma voix : avec une autorisation, Claude est prevenu et la demande est plafonnee au nombre autorise', async () => {
  const seen = [];
  const plan = await generateOwnVoicePlan({ scenes, maxNew: 1, createMessage: reply(claudePlan, seen) });
  assert.ok(seen[0].system.includes('AU PLUS 1 nouvelle(s) image(s)'));
  assert.deepEqual(plan.scenes.map((scene) => Boolean(scene.newImage)), [false, true, false]);
  assert.equal(plan.scenes[1].newImage.prompt, 'A mechanical keyboard on a wooden desk');
  // Les "say" restent ceux du createur.
  assert.deepEqual(plan.scenes.map((scene) => scene.say), scenes.map((scene) => scene.say));
});

test('attachNewImages : sans demande, rien n est appele et le plan est inchange', async () => {
  const plan = { title: 't', scenes: [{ say: 'a', layout: 'avatar' }] };
  let called = false;
  const steps = [];
  const result = await attachNewImages({ plan, illustrations: { old: { kind: 'photo', label: 'x', url: 'u' } }, generateNewIllustrations: async () => { called = true; return []; }, onStep: (s) => steps.push(s) });
  assert.equal(called, false);
  assert.deepEqual(steps, []);
  assert.equal(result.plan, plan);
  assert.deepEqual(Object.keys(result.available), ['old']);
});

test('attachNewImages : image generee -> rangee et affectee a la scene ; image ratee -> scene "avatar"', async () => {
  const plan = { title: 't', scenes: [
    { say: 'a', layout: 'photo', newImage: { kind: 'photo', prompt: 'p1' } },
    { say: 'b', layout: 'photo', newImage: { kind: 'photo', prompt: 'p2' } },
  ] };
  const result = await attachNewImages({
    plan,
    generateNewIllustrations: async (requests) => {
      assert.equal(requests.length, 2);
      return [{ id: 'ill_1', kind: 'photo', label: 'Clavier', url: 'https://x/ill_1.jpg' }, null];
    },
  });
  assert.equal(result.plan.scenes[0].image, 'ill_1');
  assert.equal(result.plan.scenes[1].layout, 'avatar');
  assert.deepEqual(result.available.ill_1, { kind: 'photo', label: 'Clavier', url: 'https://x/ill_1.jpg' });
});

test('produceOwnVoiceVideo : les nouvelles images sont generees avant le rendu et passees au rendu', async () => {
  const mp3 = Buffer.concat([Buffer.from('ID3'), Buffer.alloc(32)]);
  const heard = [['Bonjour', 0.2, 0.7], ['a', 0.75, 0.9], ['tous.', 0.95, 1.4], ['Voici', 4.0, 4.4], ['mon', 4.45, 4.6], ['clavier.', 4.65, 5.2]]
    .map(([text, start, end]) => ({ text, start, end, type: 'word' }));
  const steps = [];
  let rendered;
  const result = await produceOwnVoiceVideo({
    audio: mp3, idea: 'mon setup', maxNew: 1, onStep: (s) => steps.push(s),
    generateNewIllustrations: async (requests) => requests.map(() => ({ id: 'ill_new', kind: 'photo', label: 'Clavier', url: 'https://x/k.jpg' })),
    deps: {
      transcribe: async () => ({ words: heard }),
      clean: async () => ({ cuts: [], directives: [] }),
      cut: async () => Buffer.from('cleaned'),
      plan: async ({ scenes, maxNew }) => {
        assert.equal(maxNew, 1, 'le plafond est transmis au plan');
        return { title: 't', caption: '', hashtags: [], scenes: scenes.map((s, i) => (i === scenes.length - 1
          ? { say: s.say, layout: 'photo', newImage: { kind: 'photo', prompt: 'keyboard' } }
          : { say: s.say, layout: 'avatar' })) };
      },
      render: async (plan, _voice, options) => { rendered = { plan, options }; return { video: Buffer.from('mp4'), duration: 6 }; },
    },
  });
  assert.deepEqual(steps, ['transcription', 'nettoyage', 'plan', 'images', 'render']);
  const photoScene = rendered.plan.scenes.find((scene) => scene.layout === 'photo');
  assert.equal(photoScene.image, 'ill_new');
  assert.ok(rendered.options.illustrations.ill_new);
  assert.deepEqual(Object.keys(result.illustrationEntries), ['ill_new']);
});
