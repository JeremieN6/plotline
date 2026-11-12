import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSourceArticle, sourceArticleFromSlug, MAX_SOURCE_ARTICLE } from '../server/utils/sourceArticle.js';

test('normalizeSourceArticle : une ligne, bornee, vide si rien', () => {
  assert.equal(normalizeSourceArticle('  Mon  article\n\ttitre '), 'Mon article titre');
  assert.equal(normalizeSourceArticle(undefined), '');
  assert.equal(normalizeSourceArticle('x'.repeat(500)).length, MAX_SOURCE_ARTICLE);
});

test('sourceArticleFromSlug : slug de blog lisible', () => {
  assert.equal(sourceArticleFromSlug('skinalyze-m-adapter-a-une-cible'), 'Skinalyze m adapter a une cible');
  assert.equal(sourceArticleFromSlug(''), '');
});
