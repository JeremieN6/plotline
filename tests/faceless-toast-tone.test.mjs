import test from 'node:test';
import assert from 'node:assert/strict';

import { sanitizeFacelessScene, planForEditing } from '../server/utils/facelessPlanGenerator.js';
import { toastKind } from '../server/utils/facelessTemplateDashboard.js';
import { buildFacelessHtml } from '../server/utils/facelessTemplate.js';
import { defaultFacelessStyle } from '../server/utils/facelessStyle.js';
import { sceneFieldsFor } from '../app/utils/facelessSceneFields.js';

const chapter = (extra = {}) => ({
  say: 'Un chapitre.', layout: 'title', title: 'Étape', text: 'Une phrase', tab: 'Persona créé', start: 0, end: 4, words: [], items: [], sfx: [], beats: [], captionChunks: [], avatar: { beats: [] }, bg: 'main', captions: false, ...extra,
});
const html = (scene) => buildFacelessHtml({ scenes: [scene], duration: 4, voice: [], sfx: [] }, { style: defaultFacelessStyle('dashboard-bleu', 'MALE') });

test('notification : seuls « good » et « info » sont gardes, le reste = croix rouge (vide)', () => {
  const clean = (tabTone) => sanitizeFacelessScene({ say: 'Texte.', layout: 'title', title: 'T', tab: 'x', tabTone }, {}).tabTone;
  assert.equal(clean('good'), 'good');
  assert.equal(clean('info'), 'info');
  assert.equal(clean('alert'), '');
  assert.equal(clean('rouge'), '');
  assert.equal(clean(undefined), '');
  assert.equal(planForEditing({ scenes: [{ say: 'a', layout: 'title', tabTone: 'good' }] }).scenes[0].tabTone, 'good');
});

test('notification : le modele Dashboard dessine la croix rouge par defaut, le check vert ou la pastille bleue', () => {
  assert.equal(toastKind({}), 'alert');
  assert.equal(toastKind({ tabTone: 'good' }), 'good');
  assert.equal(toastKind({ tabTone: 'bidon' }), 'alert');

  const alert = html(chapter());
  assert.match(alert, /class="ic danger"/);
  assert.match(alert, /<line x1="6" y1="6" x2="18" y2="18"\/>/);

  const good = html(chapter({ tabTone: 'good' }));
  assert.match(good, /class="ic ok"/);
  assert.match(good, /<polyline points="5,13 10,18 19,7"\/>/);
  assert.doesNotMatch(good, /class="ic danger"/);

  const info = html(chapter({ tabTone: 'info' }));
  assert.match(info, /class="ic info"/);
  assert.match(info, /<circle cx="12" cy="12" r="9"\/>/);
});

test('editeur : le choix du type de notification n est propose que sur un chapitre du modele Dashboard', () => {
  assert.equal(sceneFieldsFor('title', 'dashboard').toast, true);
  assert.equal(sceneFieldsFor('title', 'journal').toast, false);
  assert.equal(sceneFieldsFor('hook', 'dashboard').toast, false);
});
