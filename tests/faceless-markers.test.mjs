import test from 'node:test';
import assert from 'node:assert/strict';

import { extractImageMarkers, findIllustrationByName, hasImageMarkers, resolveImageMarkers } from '../server/utils/facelessMarkers.js';
import { buildFacelessPlanSystemPrompt, sanitizeFacelessPlan, sanitizeFacelessScene } from '../server/utils/facelessPlanGenerator.js';

const FOLDER = {
  'ill-claude': { kind: 'logo', label: 'Claude' },
  'ill-cursor': { kind: 'logo', label: 'Cursor' },
  'ill-capture': { kind: 'mockup', label: 'Capture du tableau de bord' },
};

test('le marqueur est retire du texte dit et son repere est le mot juste avant', () => {
  const found = extractImageMarkers('Je te parle de Cursor [logo : Cursor], un éditeur de code.');
  assert.equal(found.say, 'Je te parle de Cursor, un éditeur de code.');
  assert.deepEqual(found.markers, [{ name: 'Cursor', cue: 'Cursor' }]);
});

test('si le nom est dit dans les 3 mots avant le marqueur, l image arrive des ce mot', () => {
  const found = extractImageMarkers('Voici Claude Code [logo : Claude] qui écrit du code');
  assert.equal(found.markers[0].cue, 'Claude Code');
  // sans nom retrouve : le dernier mot
  assert.equal(extractImageMarkers('Un assistant génial [logo : Claude]').markers[0].cue, 'génial');
  // marqueur au tout debut : pas de repere
  assert.equal(extractImageMarkers('[logo : Claude] Voici un assistant').markers[0].cue, '');
});

test('un texte sans marqueur est inchange', () => {
  assert.equal(hasImageMarkers('Texte [excited] normal'), false);
  const found = extractImageMarkers('Texte normal, sans rien.');
  assert.equal(found.say, 'Texte normal, sans rien.');
  assert.deepEqual(found.markers, []);
});

test('un nom se retrouve par libelle, sans accent ni casse, et un logo passe avant une autre image', () => {
  assert.equal(findIllustrationByName('claude', FOLDER), 'ill-claude');
  assert.equal(findIllustrationByName('CURSOR', FOLDER), 'ill-cursor');
  assert.equal(findIllustrationByName('capture du tableau', FOLDER), 'ill-capture');
  assert.equal(findIllustrationByName('Zorglub', FOLDER), '');
  assert.equal(findIllustrationByName('c', FOLDER), '');
});

test('resolveImageMarkers : un logo introuvable est signale, jamais ignore en silence', () => {
  const found = resolveImageMarkers('Claude [logo : Claude] et Zorglub [logo : Zorglub]', FOLDER);
  assert.deepEqual(found.images.map((image) => image.id), ['ill-claude']);
  assert.equal(found.notices.length, 1);
  assert.match(found.notices[0], /Zorglub/);
});

test('une scene avec UN marqueur devient une scene photo avec ce logo, voix sans le marqueur', () => {
  const scene = sanitizeFacelessScene(
    { say: 'Voici Claude Code [logo : Claude], une IA.', layout: 'title', title: 'Claude Code' },
    { illustrations: FOLDER, notices: [] },
  );
  assert.equal(scene.layout, 'photo');
  assert.equal(scene.image, 'ill-claude');
  assert.equal(scene.say, 'Voici Claude Code, une IA.');
});

test('plusieurs marqueurs : logos qui s ajoutent un a un, dans l ordre', () => {
  const scene = sanitizeFacelessScene(
    { say: 'Cursor [logo : Cursor] et Claude [logo : Claude] se partagent le marché.', layout: 'avatar' },
    { illustrations: FOLDER, notices: [] },
  );
  assert.equal(scene.layout, 'slideshow');
  assert.equal(scene.display, 'stack');
  assert.deepEqual(scene.images.map((image) => image.id), ['ill-cursor', 'ill-claude']);
  assert.equal(scene.images[1].at, 'Claude');
});

test('sans dossier connu, le marqueur est seulement retire de la voix (comportement d avant)', () => {
  const scene = sanitizeFacelessScene({ say: 'Voici Claude [logo : Claude] code.', layout: 'avatar' }, {});
  assert.equal(scene.layout, 'avatar');
  assert.equal(scene.say, 'Voici Claude code.');
});

test('le plan porte les avertissements, et rien s il n y en a pas', () => {
  const base = { scenes: [{ say: 'Un premier texte.', layout: 'avatar' }, { say: 'Et Zorglub [logo : Zorglub] aussi.', layout: 'avatar' }] };
  const withNotice = sanitizeFacelessPlan(base, { illustrations: FOLDER });
  assert.equal(withNotice.notices.length, 1);
  assert.match(withNotice.notices[0], /Zorglub/);
  const clean = sanitizeFacelessPlan({ scenes: [{ say: 'Un texte.', layout: 'avatar' }, { say: 'Un autre.', layout: 'avatar' }] }, { illustrations: FOLDER });
  assert.equal('notices' in clean, false);
});

test('Claude connait le marqueur quand il ecrit le plan', () => {
  const prompt = buildFacelessPlanSystemPrompt({ illustrations: FOLDER });
  assert.match(prompt, /\[logo : Nom\]/);
});
