import test from 'node:test';
import assert from 'node:assert/strict';

import tailwind from '../tailwind.config.js';
import { CONTENT_STATUSES, CONTENT_TYPES, contentStatusOf, contentTypeOf } from '../app/utils/contentTypes.js';
import { formatDateRange, formatShortDate, fromLocalDateTimeFields, toLocalDateTimeFields } from '../app/utils/formatDate.js';

const lin = (c) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const lum = (hex) => { const n = parseInt(hex.slice(1), 16); return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255); };
const ratio = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };

test('types de contenu : FEED, REEL, STORY ; tout autre format est un feed', () => {
  assert.equal(contentTypeOf('REEL').key, 'reel');
  assert.equal(contentTypeOf('story').key, 'story');
  assert.equal(contentTypeOf('FEED').key, 'feed');
  assert.equal(contentTypeOf('CUSTOM_PROMPT_STUDIO').key, 'feed');
  assert.equal(contentTypeOf(undefined).key, 'feed');
  assert.deepEqual(Object.keys(CONTENT_TYPES), ['feed', 'reel', 'story']);
});

test('statuts : brouillon et en generation en pointille, approuve et publie en plein', () => {
  assert.equal(contentStatusOf('draft').outline, 'border-dashed');
  assert.equal(contentStatusOf('generating').outline, 'border-dashed');
  assert.ok(contentStatusOf('generating').spinner);
  assert.equal(contentStatusOf('approved').outline, 'border-solid');
  assert.ok(contentStatusOf('published').check);
  assert.equal(contentStatusOf('inconnu').key, 'draft');
  assert.deepEqual(Object.values(CONTENT_STATUSES).map((s) => s.label), ['Brouillon', 'Approuvé', 'En génération', 'Publié']);
});

test('jetons reel et story : texte lisible (>= 4,5) sur leur fond doux, reperes >= 3 sur blanc, luminosites ecartees', () => {
  const ui = tailwind.theme.extend.colors.ui;
  for (const key of ['reel', 'story']) {
    assert.ok(ratio(ui[key].ink, ui[key].soft) >= 4.5, `${key} : texte sur fond doux`);
    assert.ok(ratio(ui[key].DEFAULT, '#ffffff') >= 3, `${key} : repere sur blanc`);
  }
  const lums = [ui.accent.DEFAULT, ui.reel.DEFAULT, ui.story.DEFAULT].map(lum).sort((a, b) => a - b);
  assert.ok(lums[1] - lums[0] > 0.05 && lums[2] - lums[1] > 0.05, 'les trois types se distinguent aussi par la luminosite');
});

test('dates : « mar. 6 oct., 18:00 » et periodes', () => {
  assert.match(formatShortDate(new Date(2026, 9, 6, 18, 0)), /^mar\. 6 oct\., 18:00$/);
  assert.equal(formatShortDate('pas une date'), '');
  assert.equal(formatDateRange(new Date(2026, 9, 6, 10), new Date(2026, 9, 11, 10)), '6–11 oct.');
  assert.equal(formatDateRange(new Date(2026, 8, 30, 10), new Date(2026, 9, 4, 10)), '30 sept.–4 oct.');
  assert.equal(formatDateRange(new Date(2026, 9, 6, 9), new Date(2026, 9, 6, 20)), '6 oct.');
});

test('champs date et heure : aller-retour en heure locale', () => {
  const iso = new Date(2026, 9, 6, 18, 30).toISOString();
  assert.deepEqual(toLocalDateTimeFields(iso), { date: '2026-10-06', time: '18:30' });
  assert.equal(fromLocalDateTimeFields({ date: '2026-10-06', time: '18:30' }), iso);
  assert.equal(fromLocalDateTimeFields({ date: '', time: '18:30' }), '');
  assert.deepEqual(toLocalDateTimeFields('x'), { date: '', time: '' });
});
