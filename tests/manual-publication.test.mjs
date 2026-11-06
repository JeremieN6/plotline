import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MANUAL_PLATFORM_IDS, buildManualPublishData, buildManualUnpublishData, isManualPublicationInputError, parseManualPublishInput, readManualPublication,
} from '../server/utils/manualPublication.js';
import { MANUAL_PLATFORMS, formatPlatforms, readManualPublication as readClient } from '../app/utils/manualPlatforms.js';

const NOW = new Date('2026-11-06T12:00:00Z');

test('la liste des plateformes du client est la meme que celle du serveur', () => {
  assert.deepEqual(MANUAL_PLATFORMS.map((p) => p.value), MANUAL_PLATFORM_IDS);
});

test('saisie : date passee + plateformes valides (doublons et inconnues ecartes)', () => {
  const input = parseManualPublishInput({ publishedAt: '2026-11-05T17:30:00Z', platforms: ['tiktok', 'INSTAGRAM', 'tiktok', 'MYSPACE'] }, NOW);
  assert.equal(input.at.toISOString(), '2026-11-05T17:30:00.000Z');
  assert.deepEqual(input.platforms, ['TIKTOK', 'INSTAGRAM']);
});

test('saisie : date manquante, invalide ou dans le futur, aucune plateforme = refus avec message', () => {
  const refuse = (body) => assert.throws(() => parseManualPublishInput(body, NOW), (error) => isManualPublicationInputError(error) && Boolean(error.userMessage));
  refuse({ platforms: ['TIKTOK'] });
  refuse({ publishedAt: 'pas une date', platforms: ['TIKTOK'] });
  refuse({ publishedAt: '2026-11-08T10:00:00Z', platforms: ['TIKTOK'] });
  refuse({ publishedAt: '2026-11-05T10:00:00Z', platforms: [] });
  refuse({ publishedAt: '2026-11-05T10:00:00Z', platforms: ['MYSPACE'] });
});

test('publication manuelle : statut publie, date = date du calendrier, drapeaux Instagram / X seulement si choisis', () => {
  const at = new Date('2026-11-05T17:30:00Z');
  const tiktok = buildManualPublishData({}, { at, platforms: ['TIKTOK'] });
  assert.equal(tiktok.status, 'PUBLISHED');
  assert.equal(tiktok.scheduledAt, at);
  assert.deepEqual(tiktok.manualPublication, { at: at.toISOString(), platforms: ['TIKTOK'] });
  assert.ok(!('publishedAt' in tiktok) && !('twitterPublishedAt' in tiktok));

  const both = buildManualPublishData({}, { at, platforms: ['INSTAGRAM', 'X'] });
  assert.equal(both.publishedAt, at);
  assert.equal(both.twitterPublishedAt, at);

  // une publication deja enregistree n est jamais ecrasee
  const already = buildManualPublishData({ publishedAt: new Date('2026-11-01T00:00:00Z') }, { at, platforms: ['INSTAGRAM'] });
  assert.ok(!('publishedAt' in already));

  // diapositive d un carrousel autre que la couverture : pas de date (une seule puce au calendrier)
  assert.equal(buildManualPublishData({}, { at, platforms: ['TIKTOK'] }, { isCover: false }).scheduledAt, null);
});

test('annulation : redevient valide ; un drapeau pose par l outil apres coup n est jamais efface', () => {
  const at = '2026-11-05T17:30:00.000Z';
  const manual = { at, platforms: ['TIKTOK', 'INSTAGRAM'] };

  const simple = buildManualUnpublishData({ manualPublication: manual, publishedAt: new Date(at) });
  assert.equal(simple.status, 'VALIDATED');
  assert.equal(simple.manualPublication, null);
  assert.equal(simple.scheduledAt, null);
  assert.equal(simple.publishedAt, null);

  // X publie ensuite par l outil : reste publie
  const afterX = buildManualUnpublishData({ manualPublication: manual, publishedAt: new Date(at), twitterPublishedAt: new Date('2026-11-06T09:00:00Z') });
  assert.equal(afterX.status, 'PUBLISHED');
  assert.ok(!('twitterPublishedAt' in afterX));

  // Instagram publie par l outil a un autre instant : drapeau garde
  const realIg = buildManualUnpublishData({ manualPublication: manual, publishedAt: new Date('2026-11-06T09:00:00Z') });
  assert.equal(realIg.status, 'PUBLISHED');
  assert.ok(!('publishedAt' in realIg));

  assert.equal(buildManualUnpublishData({ manualPublication: null }), null);
});

test('lecture de la colonne et libelles', () => {
  assert.deepEqual(readManualPublication({ at: '2026-11-05T17:30:00Z', platforms: ['TIKTOK', 'bidon'] }), { at: '2026-11-05T17:30:00.000Z', platforms: ['TIKTOK'] });
  assert.equal(readManualPublication({ at: 'x', platforms: ['TIKTOK'] }), null);
  assert.equal(readManualPublication(null), null);
  assert.deepEqual(readClient({ at: '2026-11-05T17:30:00Z', platforms: ['X'] }), { at: '2026-11-05T17:30:00.000Z', platforms: ['X'] });
  assert.equal(formatPlatforms(['TIKTOK', 'INSTAGRAM']), 'TikTok et Instagram');
  assert.equal(formatPlatforms(['TIKTOK', 'INSTAGRAM', 'X']), 'TikTok, Instagram et X');
  assert.equal(formatPlatforms(['TIKTOK']), 'TikTok');
  assert.equal(formatPlatforms([]), '');
});
