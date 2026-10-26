import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildMonthWeeks, findTrailingGap, monthKey, monthTarget, parseMonthKey, parseTags, presetDays, splitCaption, statusFromContent, summarizeMonth, timeLabel,
} from '../app/utils/calendarGrid.js';

const entry = (day, hour, format = 'FEED', status = 'approved') => ({ id: `${day}-${hour}`, format, status, scheduledAt: new Date(2026, 9, day, hour, 0).toISOString() });
const OCT = new Date(2026, 9, 1);

test('grille : semaines de 7 cases, lundi en premier, cases hors du mois vides', () => {
  const weeks = buildMonthWeeks(OCT, [], new Date(2026, 9, 26, 10));
  assert.ok(weeks.every((week) => week.cells.length === 7));
  const cells = weeks.flatMap((week) => week.cells);
  assert.equal(cells.filter((cell) => cell.inMonth).length, 31);
  // 1er octobre 2026 = jeudi : 3 cases vides avant
  assert.deepEqual(cells.slice(0, 4).map((cell) => cell.inMonth), [false, false, false, true]);
  assert.equal(cells.find((cell) => cell.day === 26).isToday, true);
  assert.equal(cells.find((cell) => cell.day === 25).isPast, true);
  assert.equal(cells.find((cell) => cell.day === 27).isFuture, true);
  assert.equal(cells.find((cell) => cell.day === 26).isFuture, true, 'aujourd hui compte comme a venir');
  assert.deepEqual(cells.map((cell) => cell.index), cells.map((_, i) => i));
});

test('grille : contenus tries par heure dans leur jour, semaines avec contenu reperees', () => {
  const weeks = buildMonthWeeks(OCT, [entry(27, 15), entry(27, 9), entry(29, 12)], new Date(2026, 9, 26));
  const day27 = weeks.flatMap((week) => week.cells).find((cell) => cell.day === 27);
  assert.deepEqual(day27.items.map((item) => item.id), ['27-9', '27-15']);
  assert.deepEqual(weeks.map((week) => week.hasItems), [false, false, false, false, true]);
});

test('trou a venir : de la derniere publication a la fin du mois, ou null', () => {
  const today = new Date(2026, 9, 12, 10);
  assert.deepEqual(
    (({ start, end, days }) => [start.getDate(), end.getDate(), days])(findTrailingGap(OCT, [], today)),
    [12, 31, 20],
  );
  const gap = findTrailingGap(OCT, [entry(14, 18), entry(20, 9)], today);
  assert.deepEqual([gap.start.getDate(), gap.days], [21, 11]);
  assert.equal(findTrailingGap(OCT, [entry(30, 9)], today), null, 'moins de 3 jours : pas de trou');
  assert.equal(findTrailingGap(OCT, [entry(31, 9)], today), null, 'mois couvert');
  assert.equal(findTrailingGap(new Date(2026, 8, 1), [], today), null, 'mois passe');
  assert.equal(findTrailingGap(new Date(2026, 10, 1), [], today).start.getDate(), 1, 'mois a venir : tout le mois');
  assert.equal(presetDays(20), 30);
  assert.equal(presetDays(5), 7);
  assert.equal(presetDays(14), 14);
});

test('resume du mois et cadence', () => {
  const summary = summarizeMonth(OCT, [entry(1, 9), entry(2, 9, 'REEL'), entry(3, 9, 'STORY'), entry(4, 9, 'STORY'), { ...entry(1, 9), scheduledAt: new Date(2026, 10, 2).toISOString() }]);
  assert.deepEqual(summary, { total: 4, feed: 1, reel: 1, story: 2 });
  assert.equal(monthTarget(3, OCT), 13);
  assert.equal(monthTarget(0, OCT), 0);
  assert.equal(monthTarget(undefined, OCT), 0);
});

test('legende et hashtags : le dernier bloc de hashtags est separe du texte', () => {
  assert.deepEqual(splitCaption('Mon coin préféré.\n\n#cosy #lifestyle'), { text: 'Mon coin préféré.', tags: ['#cosy', '#lifestyle'] });
  assert.deepEqual(splitCaption('Pas de tags ici.'), { text: 'Pas de tags ici.', tags: [] });
  assert.deepEqual(splitCaption('Un #mot dans le texte.'), { text: 'Un #mot dans le texte.', tags: [] });
  assert.deepEqual(splitCaption(null), { text: '', tags: [] });
  assert.deepEqual(parseTags('#a b  #c'), ['#a', '#b', '#c']);
});

test('statuts, cles de mois et heure', () => {
  assert.equal(statusFromContent('PROCESSING'), 'generating');
  assert.equal(statusFromContent('PUBLISHED'), 'published');
  assert.equal(statusFromContent('PENDING'), 'approved');
  assert.equal(statusFromContent('VALIDATED'), 'approved');
  assert.equal(monthKey(new Date(2026, 9, 6)), '2026-10');
  assert.equal(parseMonthKey('2026-10').getMonth(), 9);
  assert.equal(parseMonthKey('2026-13'), null);
  assert.equal(parseMonthKey('abc'), null);
  assert.equal(timeLabel(new Date(2026, 9, 6, 9, 5).toISOString()), '09:05');
});
