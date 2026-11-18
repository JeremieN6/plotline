import test from 'node:test';
import assert from 'node:assert/strict';

import { describeGraphError } from '../server/utils/instagramPublisher.js';
import { isRetryableFailure } from '../server/utils/scheduledPublisher.js';

test('describeGraphError : jeton expire (190) = erreur definitive lisible', () => {
  const error = describeGraphError({ statusCode: 400, message: '400 Bad Request', data: { error: { code: 190, message: 'Error validating access token' } } });
  assert.equal(error.code, 'TOKEN_EXPIRED');
  assert.match(error.message, /reconnectez/);
  assert.match(error.message, /Error validating access token/);
  assert.equal(isRetryableFailure(error), false);
});

test('describeGraphError : rejet 4xx = definitif, limite de debit et 5xx = nouvelle tentative', () => {
  const rejected = describeGraphError({ statusCode: 400, data: { error: { code: 9004, message: 'Media upload has failed' } } });
  assert.equal(rejected.code, 'GRAPH_REJECTED');
  assert.equal(isRetryableFailure(rejected), false);

  const limited = describeGraphError({ statusCode: 400, data: { error: { code: 4, message: 'Too many calls' } } });
  assert.equal(limited.code, 'GRAPH_TEMPORARY');
  assert.equal(isRetryableFailure(limited), true);

  const server = describeGraphError({ statusCode: 503, message: 'Service Unavailable' });
  assert.equal(server.code, 'GRAPH_TEMPORARY');
  assert.equal(isRetryableFailure(server), true);
});

test('describeGraphError : une erreur sans statut HTTP (reseau, code metier) est renvoyee telle quelle', () => {
  const plain = new Error('boom');
  assert.equal(describeGraphError(plain), plain);
});
