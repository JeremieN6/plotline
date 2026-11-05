import test from 'node:test';
import assert from 'node:assert/strict';

import { windowAddress } from '../server/utils/facelessTemplateDashboard.js';
import { buildFacelessHtml } from '../server/utils/facelessTemplate.js';
import { defaultFacelessStyle } from '../server/utils/facelessStyle.js';
import { sceneFieldsFor } from '../app/utils/facelessSceneFields.js';

const scene = (extra = {}) => ({ say: 'Un texte dit.', layout: 'photo', image: 'a', text: 'Légende', start: 0, end: 4, words: [], items: [], sfx: [], beats: [], captionChunks: [], avatar: { beats: [] }, bg: 'main', captions: false, ...extra });
const html = (s) => buildFacelessHtml(
  { scenes: [s], duration: 4, voice: [], sfx: [] },
  { style: { ...defaultFacelessStyle('dashboard-bleu', 'MALE'), screenFrame: true }, illustrations: { a: { kind: 'screenshot', label: 'x', url: '/api/media/a.jpg' } } },
);

test('adresse de la fenetre : le champ tab, sinon l adresse par defaut', () => {
  assert.equal(windowAddress({ tab: 'flysmart.com/demo' }), 'flysmart.com/demo');
  assert.equal(windowAddress({ tab: '  ' }), 'tableau-de-bord');
  assert.equal(windowAddress({}), 'tableau-de-bord');
});

test('capture dans le cadre d ecran : adresse modifiable, image entiere avec une marge', () => {
  const custom = html(scene({ tab: 'flysmart.com/demo' }));
  assert.match(custom, /<span class="waddr">flysmart\.com\/demo<\/span>/);
  assert.match(html(scene()), /<span class="waddr">tableau-de-bord<\/span>/);
  // jamais rognee : « contain », et posee avec une marge (pas a x = 0)
  assert.match(custom, /\.shot\{[^}]*object-fit:contain/);
  assert.doesNotMatch(custom, /\.shot\{[^}]*object-fit:cover/);
});

test('editeur : l adresse de la fenetre est proposee sur une scene Photo du modele Dashboard', () => {
  assert.ok(sceneFieldsFor('photo', 'dashboard').tab);
  assert.match(sceneFieldsFor('photo', 'dashboard').tab.label, /Adresse/);
});

test('capture dans le cadre : la fenetre est marquee pour epouser la forme de l image (marge sur les cotes)', () => {
  const page = html(scene());
  assert.match(page, /data-fit-shot="\d+"/);
  assert.match(page, /data-shot-m="28"/);
  // une scene sans capture (autre mise en page) n est jamais marquee
  assert.doesNotMatch(html({ ...scene(), layout: 'avatar', image: undefined }), /data-fit-shot="d+"/);
});
