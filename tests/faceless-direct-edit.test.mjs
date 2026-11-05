import test from 'node:test';
import assert from 'node:assert/strict';

import { retouchFacelessVideo } from '../server/utils/facelessVideoJob.js';

const scene = (say, extra = {}) => ({ say, layout: 'avatar', text: 'Un texte', start: 0, end: 3, words: [], items: [], sfx: [], beats: [], captionChunks: [], avatar: { beats: [] }, bg: 'main', captions: true, ...extra });
const spec = (extra = {}) => ({
  kind: 'faceless-render',
  plan: { title: 'T', caption: '', hashtags: [], scenes: [scene('Bonjour tout le monde.'), scene('Voici la suite.')] },
  voiceUrl: '/introuvable.mp3', words: [], captions: true, ...extra,
});

test('plan modifie a la main avec ma propre voix : changer un mot dit est refuse avant toute depense', async () => {
  const plan = JSON.parse(JSON.stringify(spec().plan));
  plan.scenes[0].say = 'Bonjour tout le monde entier.';
  await assert.rejects(
    retouchFacelessVideo({ spec: spec({ voiceSource: 'own' }), plan }),
    /ne peut pas changer ce qui est dit/,
  );
});

test('plan modifie a la main : un plan sans assez de scenes est refuse (comme au lancement d une video)', async () => {
  const plan = { title: 'T', scenes: [scene('Une seule scene.')] };
  await assert.rejects(retouchFacelessVideo({ spec: spec(), plan }), /moins de 2 scenes/);
});
