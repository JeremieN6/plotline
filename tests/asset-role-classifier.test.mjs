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

test('vues detaillees : anciens identifiants conserves, vues interieures marquees "interior" pour le prompt', () => {
  const legacy = {
    CAR: ['EXTERIOR', 'INTERIOR', 'TRUNK', 'DETAIL', 'OTHER'],
    HOUSE: ['EXTERIOR', 'INTERIOR', 'GARDEN', 'DETAIL', 'OTHER'],
    STREET: ['WIDE', 'DETAIL', 'OTHER'],
    JEWEL: ['FRONT', 'WORN', 'DETAIL', 'OTHER'],
    SHOES: ['OVERALL', 'SIDE', 'SOLE', 'DETAIL', 'OTHER'],
    HAT: ['OVERALL', 'SIDE', 'INSIDE', 'DETAIL', 'OTHER'],
    PROP: ['OVERALL', 'DETAIL', 'OTHER'],
  };
  for (const [type, ids] of Object.entries(legacy)) {
    const have = ASSET_SOURCE_ROLES[type].map((item) => item.role);
    for (const id of ids) assert.ok(have.includes(id), `${type} garde ${id}`);
    assert.equal(new Set(have).size, have.length, `${type} : pas de doublon`);
  }
  for (const type of ['CAR', 'HOUSE']) {
    for (const item of ASSET_SOURCE_ROLES[type].filter((r) => ['INTERIOR', 'DASHBOARD', 'FRONT_SEATS', 'REAR_SEATS', 'LIVING', 'KITCHEN', 'BEDROOM', 'BATHROOM'].includes(r.role))) {
      assert.match(item.promptLabel, /interior/, `${type}/${item.role}`);
    }
  }
  // Une voiture a plus de vues qu une maison n en partage avec elle.
  assert.ok(ASSET_SOURCE_ROLES.CAR.some((r) => r.role === 'WHEEL') && !ASSET_SOURCE_ROLES.HOUSE.some((r) => r.role === 'WHEEL'));
});
