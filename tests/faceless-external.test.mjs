import test from 'node:test';
import assert from 'node:assert/strict';

import { EXTERNAL_MAX_IDEA, parseExternalFacelessBody } from '../server/utils/facelessExternal.js';
import { MAX_SOURCE_TEXT } from '../server/utils/facelessPlanGenerator.js';

test('appel externe faceless : champs obligatoires', () => {
  assert.equal(parseExternalFacelessBody({}).error, 'profileId requis');
  assert.equal(parseExternalFacelessBody({ profileId: 'p1' }).error, 'sourceText requis');
  assert.equal(parseExternalFacelessBody({ profileId: 'p1', sourceText: '---\ntitle: x\n---\n   ' }).error, 'sourceText requis');
  assert.equal(parseExternalFacelessBody(null).error, 'profileId requis');
});

test('appel externe faceless : valeurs par defaut et normalisation', () => {
  const { value } = parseExternalFacelessBody({ profileId: ' p1 ', sourceText: '---\ntitle: x\n---\nCorps de l article.', slug: 'mon-article', sourceProject: 'home.sassify.fr' });
  assert.equal(value.profileId, 'p1');
  assert.equal(value.sourceText, 'Corps de l article.');
  assert.equal(value.idea, '');
  assert.equal(value.targetSeconds, 30);
  assert.equal(value.slug, 'mon-article');
  assert.equal(value.sourceProject, 'home.sassify.fr');
});

test('appel externe faceless : texte ou consigne trop longs refuses, jamais coupes en silence', () => {
  const tooLong = parseExternalFacelessBody({ profileId: 'p1', sourceText: 'x'.repeat(MAX_SOURCE_TEXT + 1) });
  assert.match(tooLong.error, /sourceText trop long/);
  assert.ok(parseExternalFacelessBody({ profileId: 'p1', sourceText: 'x'.repeat(MAX_SOURCE_TEXT) }).value);
  assert.match(parseExternalFacelessBody({ profileId: 'p1', sourceText: 'ok', idea: 'y'.repeat(EXTERNAL_MAX_IDEA + 1) }).error, /idea trop longue/);
});

test('appel externe faceless : duree limitee aux valeurs connues', () => {
  for (const seconds of [20, 30, 45, 60, '45']) {
    assert.equal(parseExternalFacelessBody({ profileId: 'p1', sourceText: 'ok', durationSeconds: seconds }).value.targetSeconds, Number(seconds));
  }
  assert.match(parseExternalFacelessBody({ profileId: 'p1', sourceText: 'ok', durationSeconds: 37 }).error, /durationSeconds invalide/);
  assert.equal(parseExternalFacelessBody({ profileId: 'p1', sourceText: 'ok', durationSeconds: '' }).value.targetSeconds, 30);
});
