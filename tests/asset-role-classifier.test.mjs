import test from 'node:test';
import assert from 'node:assert/strict';

import { buildRoleClassifierPrompt, parseRoleClassification } from '../server/utils/assetRoleClassifier.js';
import { describeGeminiFailure } from '../server/utils/assetSheetGeneration.js';
import { ASSET_SOURCE_ROLES } from '../server/utils/referenceAssets.js';

test('le prompt de classement liste tous les roles du type et exige un role par photo', () => {
  const prompt = buildRoleClassifierPrompt('CAR');
  for (const item of ASSET_SOURCE_ROLES.CAR) assert.ok(prompt.includes(item.role), item.role);
  assert.ok(prompt.includes('exactement une entree par photo'));
  assert.equal(buildRoleClassifierPrompt('INCONNU'), null);
});

test('parseRoleClassification : liste valide, avec ou sans bloc markdown', () => {
  assert.deepEqual(parseRoleClassification('{"roles":["EXTERIOR","INTERIOR","detail"]}', 'CAR', 3), ['EXTERIOR', 'INTERIOR', 'DETAIL']);
  assert.deepEqual(parseRoleClassification('```json\n{"roles":["INTERIOR"]}\n```', 'car', 1), ['INTERIOR']);
});

test('parseRoleClassification : mauvais nombre de photos, JSON invalide ou vide -> null (rien n est devine)', () => {
  assert.equal(parseRoleClassification('{"roles":["EXTERIOR"]}', 'CAR', 2), null);
  assert.equal(parseRoleClassification('pas du json', 'CAR', 1), null);
  assert.equal(parseRoleClassification('', 'CAR', 1), null);
  assert.equal(parseRoleClassification('{"roles":"EXTERIOR"}', 'CAR', 1), null);
});

test('parseRoleClassification : un role inconnu pour ce type devient OTHER, ou le defaut du type', () => {
  // TRUNK n existe pas pour un chapeau, GARDEN n existe pas pour une voiture.
  assert.deepEqual(parseRoleClassification('{"roles":["GARDEN"]}', 'CAR', 1), ['OTHER']);
  assert.deepEqual(parseRoleClassification('{"roles":["TRUNK"]}', 'HAT', 1), ['OTHER']);
  // WIDE (rue) a un OTHER aussi ; un type sans OTHER retomberait sur son defaut.
  assert.deepEqual(parseRoleClassification('{"roles":[null]}', 'STREET', 1), ['OTHER']);
});

test('describeGeminiFailure : credit epuise, quota, indisponibilite, cle refusee, inconnu', () => {
  const credit = describeGeminiFailure({ status: 402, message: '{"error":{"code":402,"message":"Your prepayment credits are depleted."}}' });
  assert.equal(credit.statusCode, 402);
  assert.match(credit.statusMessage, /crédit Gemini est épuisé/);

  // Statut absent de l objet : retrouve dans le texte JSON de l erreur.
  assert.equal(describeGeminiFailure({ message: '{"error":{"code":402,"message":"x"}}' }).statusCode, 402);
  assert.equal(describeGeminiFailure({ status: 429, message: 'x' }).statusCode, 429);
  assert.equal(describeGeminiFailure({ message: 'The model is overloaded' }).statusCode, 503);
  assert.equal(describeGeminiFailure({ status: 403, message: 'x' }).statusCode, 502);
  assert.equal(describeGeminiFailure(new Error('boum')), null);
  assert.equal(describeGeminiFailure(null), null);
});
