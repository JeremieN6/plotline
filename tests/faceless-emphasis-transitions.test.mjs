import test from 'node:test';
import assert from 'node:assert/strict';

import { buildCaptionChunks, stripEmphasis } from '../server/utils/facelessTimeline.js';
import { sanitizeFacelessScene, spokenTextChanged } from '../server/utils/facelessPlanGenerator.js';
import { buildFacelessHtml } from '../server/utils/facelessTemplate.js';
import { defaultFacelessStyle } from '../server/utils/facelessStyle.js';

test('texte dit : les asterisques de mise en avant sont retires', () => {
  assert.equal(stripEmphasis('**ChatGPT**.'), 'ChatGPT.');
  assert.equal(stripEmphasis('Sans rien a retirer'), 'Sans rien a retirer');
  assert.equal(sanitizeFacelessScene({ say: 'Il arrive par **ChatGPT**.', layout: 'avatar' }).say, 'Il arrive par ChatGPT.');
});

test('sous-titres : une voix deja enregistree avec des asterisques n en affiche aucun', () => {
  const words = ['Par', '**ChatGPT**.', '**'].map((text, i) => ({ text, start: i, end: i + 0.5 }));
  const shown = buildCaptionChunks(words, { end: 3 }).flatMap((chunk) => chunk.words.map((w) => w.text));
  assert.deepEqual(shown, ['Par', 'ChatGPT.']);
});

test('voix : retirer les asterisques ne la regenere pas ; changer un mot ou le decompte la regenere', () => {
  const plan = (say) => ({ scenes: [{ say }] });
  assert.equal(spokenTextChanged(plan('Par **ChatGPT**.'), plan('Par ChatGPT.')), false);
  assert.equal(spokenTextChanged(plan('Par **ChatGPT**.'), plan('Par Claude.')), true);
  assert.equal(spokenTextChanged(plan('Par ** ChatGPT.'), plan('Par ChatGPT.')), true);
});

test('Dashboard avec cadre d ecran : la fenetre ne s efface pas et la suivante est la des la premiere image', () => {
  const style = { ...defaultFacelessStyle('dashboard-bleu', 'MALE'), screenFrame: true };
  const scenes = [{
    layout: 'title', text: 'Venu par **ChatGPT**', start: 0, end: 3, voiceStart: 0, voiceEnd: 2, words: [], say: 'Un texte', beats: [], items: [], sfx: [], captions: false, bg: 'main',
  }];
  const html = buildFacelessHtml({ duration: 3, scenes, captions: [], sfx: [] }, { style });
  assert.ok(!html.includes('data-exit="shrink"'));
  assert.ok(html.includes('data-enter="screen-swap"'));
});
