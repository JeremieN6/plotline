import test from 'node:test';
import assert from 'node:assert/strict';

import {
  actionsFor, autoPublishBlockReason, cardStateOf, isPublicationFailure, isScheduleOverdue, joinHashtags, scheduledBadgeLabel, splitHashtags, countByTab, defaultPublishTarget, filterAndSort, formatDuration, isPublishedOn, posterTime, publishTargets, captionHook, tabOf, typeKeyOf,
} from '../app/utils/contentCards.js';

const item = (status, extra = {}) => ({ id: status + Math.random(), status, format: 'FEED', createdAt: '2026-11-01T10:00:00Z', caption: 'Texte', ...extra });

test('onglet et type d un contenu', () => {
  assert.equal(tabOf(item('PROCESSING')), 'PENDING');
  assert.equal(tabOf(item('PENDING')), 'PENDING');
  assert.equal(tabOf(item('VALIDATED')), 'VALIDATED');
  assert.equal(tabOf(item('PUBLISHED')), 'PUBLISHED');
  assert.equal(cardStateOf(item('FAILED')), 'failed');
  assert.equal(typeKeyOf({ format: 'REEL' }), 'reel');
  assert.equal(typeKeyOf({ format: 'STORY' }), 'story');
  assert.equal(typeKeyOf({ format: 'CUSTOM_PROMPT_STUDIO' }), 'feed');
});

test('compteurs : un echec ne compte que dans « Tout »', () => {
  const counts = countByTab([item('PENDING'), item('PENDING'), item('PROCESSING'), item('VALIDATED'), item('FAILED'), item('REJECTED')]);
  assert.deepEqual(counts, { ALL: 6, PENDING: 3, VALIDATED: 1, PUBLISHED: 0 });
});

test('filtre par onglet, type et tri', () => {
  const list = [
    item('PENDING', { id: 'a', format: 'REEL', createdAt: '2026-11-01T10:00:00Z' }),
    item('PENDING', { id: 'b', format: 'FEED', createdAt: '2026-11-03T10:00:00Z' }),
    item('VALIDATED', { id: 'c', format: 'REEL', createdAt: '2026-11-02T10:00:00Z' }),
    item('FAILED', { id: 'd', format: 'REEL', createdAt: '2026-11-04T10:00:00Z' }),
  ];
  assert.deepEqual(filterAndSort(list, { tab: 'ALL' }).map((x) => x.id), ['d', 'b', 'c', 'a']);
  assert.deepEqual(filterAndSort(list, { tab: 'ALL', sort: 'oldest' }).map((x) => x.id), ['a', 'c', 'b', 'd']);
  assert.deepEqual(filterAndSort(list, { tab: 'PENDING' }).map((x) => x.id), ['b', 'a']);
  assert.deepEqual(filterAndSort(list, { tab: 'ALL', types: ['reel'] }).map((x) => x.id), ['d', 'c', 'a']);
  assert.deepEqual(filterAndSort(list, { tab: 'VALIDATED', types: ['feed'] }), []);
});

test('accroche : premiere phrase en titre, le reste en texte', () => {
  assert.deepEqual(captionHook('Premier jet. Deuxieme phrase ici. Fin'), { hook: 'Premier jet.', rest: 'Deuxieme phrase ici. Fin' });
  assert.deepEqual(captionHook('Une seule phrase sans point'), { hook: 'Une seule phrase sans point', rest: '' });
  assert.deepEqual(captionHook('Ligne un\nLigne deux'), { hook: 'Ligne un', rest: 'Ligne deux' });
  assert.deepEqual(captionHook('Vraiment ? Oui !'), { hook: 'Vraiment ?', rest: 'Oui !' });
  assert.deepEqual(captionHook('Version 2.5 est la'), { hook: 'Version 2.5 est la', rest: '' });
  assert.deepEqual(captionHook('   '), { hook: '', rest: '' });
  assert.deepEqual(captionHook(null), { hook: '', rest: '' });
});

test('image d apercu a 25 % et duree', () => {
  assert.equal(posterTime(40), 10);
  assert.equal(posterTime(0), 0);
  assert.equal(posterTime(NaN), 0);
  assert.ok(posterTime(0.2) < 0.2);
  assert.equal(formatDuration(12), '0:12');
  assert.equal(formatDuration(65.4), '1:05');
  assert.equal(formatDuration(0), '');
});

test('plateformes : Instagram puis X, TikTok jamais propose', () => {
  const both = { instagramAccountId: 'ig1', twitterConnected: true };
  assert.deepEqual(publishTargets(both).map((t) => t.id), ['INSTAGRAM', 'X']);
  assert.equal(defaultPublishTarget(both).id, 'INSTAGRAM');
  assert.equal(defaultPublishTarget({ twitterConnected: true }).id, 'X');
  assert.equal(defaultPublishTarget({}), null);
  assert.equal(isPublishedOn({ publishedAt: '2026-11-01' }, 'INSTAGRAM'), true);
  assert.equal(isPublishedOn({ publishedAt: '2026-11-01' }, 'X'), false);
});

test('actions par statut (brief : un seul principal, Supprimer seulement dans le menu)', () => {
  assert.deepEqual(actionsFor(item('PENDING')), { primary: 'validate', secondary: 'reject', menu: ['edit', 'copy', 'delete'] });
  assert.deepEqual(actionsFor(item('VALIDATED')), { primary: 'publish', secondary: 'schedule', menu: ['markPublished', 'unvalidate', 'copy', 'delete'] });
  assert.deepEqual(actionsFor(item('VALIDATED', { scheduledAt: '2026-11-09T09:00:00Z' })).menu, ['cancelSchedule', 'markPublished', 'unvalidate', 'copy', 'delete']);
  assert.ok(!actionsFor(item('PENDING', { scheduledAt: '2026-11-09T09:00:00Z' })).menu.includes('cancelSchedule'));
  assert.ok(!actionsFor(item('PUBLISHED', { scheduledAt: '2026-11-09T09:00:00Z' })).menu.includes('cancelSchedule'));
  assert.deepEqual(actionsFor(item('PUBLISHED')), { primary: null, secondary: 'detail', menu: ['copy', 'delete'] });
  assert.deepEqual(actionsFor(item('PUBLISHED', { manualPublication: { at: 'x', platforms: ['TIKTOK'] } })).menu, ['cancelManual', 'copy', 'delete']);
  assert.deepEqual(actionsFor(item('PROCESSING')), { primary: null, secondary: null, menu: [] });
  assert.deepEqual(actionsFor(item('FAILED')).menu, ['delete']);
  // echec de publication (le media existe) : « Remettre en Valide » ; echec de generation (pas de media) : rien a recuperer
  assert.equal(actionsFor(item('FAILED', { imageUrl: 'https://x/v.mp4' })).secondary, 'recover');
  assert.equal(actionsFor(item('FAILED')).secondary, null);
  assert.equal(actionsFor(item('FAILED', { imageUrl: '   ' })).secondary, null);
  assert.deepEqual(actionsFor(item('PENDING', { caption: '' })).menu, ['edit', 'delete']);
  for (const status of ['PENDING', 'VALIDATED', 'PUBLISHED', 'PROCESSING', 'FAILED']) {
    const { primary, secondary } = actionsFor(item(status));
    assert.notEqual(primary, 'delete');
    assert.notEqual(secondary, 'delete');
  }
});

test('pastille « Programmé » : contenu valide avec une date a venir seulement', () => {
  const now = new Date('2026-11-07T08:00:00Z').getTime();
  const future = '2026-11-08T09:00:00Z';
  const label = scheduledBadgeLabel(item('VALIDATED', { scheduledAt: future }), now);
  assert.match(label, /^Programmé \d{1,2} \S+, \d{2}:\d{2}$/);
  assert.equal(scheduledBadgeLabel(item('VALIDATED'), now), '');
  assert.equal(scheduledBadgeLabel(item('VALIDATED', { scheduledAt: '2026-11-06T09:00:00Z' }), now), '');
  assert.equal(scheduledBadgeLabel(item('PENDING', { scheduledAt: future }), now), '');
  assert.equal(scheduledBadgeLabel(item('PUBLISHED', { scheduledAt: future }), now), '');
  assert.equal(scheduledBadgeLabel(item('VALIDATED', { scheduledAt: 'nimporte quoi' }), now), '');
  assert.equal(isScheduleOverdue(item('VALIDATED', { scheduledAt: '2026-11-06T09:00:00Z' }), now), true);
  assert.equal(isScheduleOverdue(item('VALIDATED', { scheduledAt: future }), now), false);
  assert.equal(isScheduleOverdue(item('PENDING', { scheduledAt: '2026-11-06T09:00:00Z' }), now), false);
});

test('publication automatique ratee : en erreur + media + date planifiee seulement', () => {
  const media = 'https://x/v.mp4';
  const date = '2026-11-09T15:00:00Z';
  assert.equal(isPublicationFailure(item('FAILED', { imageUrl: media, scheduledAt: date })), true);
  assert.equal(isPublicationFailure(item('FAILED', { imageUrl: media })), false); // echec de generation : pas de date
  assert.equal(isPublicationFailure(item('FAILED', { scheduledAt: date })), false); // pas de media
  assert.equal(isPublicationFailure(item('VALIDATED', { imageUrl: media, scheduledAt: date })), false);
  assert.equal(isPublicationFailure(item('PUBLISHED', { imageUrl: media, scheduledAt: date })), false);
});

test('planifier : raison de blocage quand la publication automatique echouerait forcement', () => {
  assert.equal(autoPublishBlockReason(item('VALIDATED', { platform: 'INSTAGRAM' }), { instagramAccountId: 'ig1' }), '');
  assert.match(autoPublishBlockReason(item('VALIDATED', { platform: 'INSTAGRAM' }), { instagramAccountId: '' }), /Instagram n’est pas connecté/);
  assert.match(autoPublishBlockReason(item('VALIDATED', { platform: 'INSTAGRAM' }), null), /Instagram n’est pas connecté/);
  assert.match(autoPublishBlockReason(item('VALIDATED', { platform: 'TIKTOK' }), { instagramAccountId: 'ig1' }), /TikTok/);
});

test('hashtags de fin separes de la legende, et recomposes', () => {
  assert.deepEqual(splitHashtags('Salut le monde.\n\n#un #deux'), { body: 'Salut le monde.', tags: ['#un', '#deux'] });
  assert.deepEqual(splitHashtags('Pas de tags ici'), { body: 'Pas de tags ici', tags: [] });
  assert.deepEqual(splitHashtags('Un #mot au milieu et du texte'), { body: 'Un #mot au milieu et du texte', tags: [] });
  assert.deepEqual(splitHashtags('Texte\n#a\n#b #a'), { body: 'Texte', tags: ['#a', '#b'] });
  assert.equal(joinHashtags('Salut.', ['un', '#deux', 'un']), 'Salut.\n\n#un #deux');
  assert.equal(joinHashtags('Salut.', []), 'Salut.');
  assert.equal(joinHashtags('', ['a']), '#a');
  const original = 'Texte long.\nDeux lignes.\n\n#alpha #beta';
  const { body, tags } = splitHashtags(original);
  assert.equal(joinHashtags(body, tags), original);
});
