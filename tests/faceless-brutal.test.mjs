import test from 'node:test';
import assert from 'node:assert/strict';

import { FACELESS_PRESETS } from '../server/data/facelessThemes.js';
import { defaultFacelessStyle, describeStyleForPrompt, normalizeFacelessStyle } from '../server/utils/facelessStyle.js';
import { sanitizeFacelessPlan } from '../server/utils/facelessPlanGenerator.js';
import { layoutFacelessTimelineFromTrack } from '../server/utils/facelessTimeline.js';
import { buildFacelessHtml } from '../server/utils/facelessTemplate.js';
import { brutalBg, brutalLines, layoutLines, lineTimes } from '../server/utils/facelessTemplateBrutal.js';

const BRUTAL = ['brutal-fluo', 'brutal-rose', 'brutal-orange', 'brutal-cyan'];

const lin = (c) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const lum = (hex) => { const n = parseInt(hex.slice(1), 16); return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255); };
const ratio = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };

function timelineOf(rawScenes) {
  const plan = sanitizeFacelessPlan({ scenes: rawScenes }, { captions: true });
  const words = [];
  let cursor = 0;
  for (const scene of plan.scenes) {
    for (const text of scene.say.split(/\s+/).filter(Boolean)) { words.push({ text, start: cursor, end: cursor + 0.3 }); cursor += 0.3; }
  }
  return layoutFacelessTimelineFromTrack(plan, { path: 'x', duration: cursor, words }, { leadIn: 0, gap: 0, tail: 0.5, visualLead: 0 });
}

test('brutal : 4 modeles, texte noir sur le fluo (>= 4,5 : texte en tres grand corps), noir sur papier et fluo sur noir', () => {
  for (const key of BRUTAL) {
    const base = FACELESS_PRESETS[key].style;
    assert.equal(normalizeFacelessStyle({ ...base }).template, 'brutal', key);
    assert.equal(base.font, 'anton');
    assert.ok(ratio('#0a0a0a', base.palette.accent) >= 4.5, `${key} : noir sur fluo`);
    assert.ok(ratio(base.palette.accent, base.palette.dark) >= 4.5, `${key} : fluo sur noir`);
    assert.ok(ratio(base.palette.text, base.palette.background) >= 15, `${key} : noir sur papier`);
  }
});

test('brutalLines : le mot cle a sa ligne, les autres mots se regroupent, jamais sans fluo', () => {
  assert.deepEqual(brutalLines('POURQUOI CE CLUB **PRESSE** SI HAUT ?'), [
    { text: 'POURQUOI', kw: false }, { text: 'CE CLUB', kw: false }, { text: 'PRESSE', kw: true }, { text: 'SI HAUT ?', kw: false },
  ]);
  assert.deepEqual(brutalLines('Un deux\ntrois', { fallbackKeyword: false }), [{ text: 'Un deux', kw: false }, { text: 'trois', kw: false }]);
  // Sans mot cle : la ligne la plus longue prend le fluo.
  const lines = brutalLines('je vais mourir tellement');
  assert.equal(lines.filter((l) => l.kw).length, 1);
  assert.equal(lines.find((l) => l.kw).text, 'tellement');
  assert.equal(brutalLines('a **b** c', { fallbackKeyword: false }).filter((l) => l.kw).length, 1);
});

test('layoutLines : une ligne longue est plus petite, la pile haute est reduite ensemble', () => {
  const [short, long] = layoutLines([{ text: 'CE CLUB' }, { text: 'ANTICONSTITUTIONNELLEMENT' }], { minSize: 60 });
  assert.ok(short.size > long.size);
  const tall = layoutLines(Array.from({ length: 8 }, () => ({ text: 'PRESSE' })), { maxH: 600 });
  assert.ok(tall.reduce((sum, l) => sum + l.size * 0.88, 0) <= 600 + 8);
});

test('lineTimes : dans l ordre, sur le mot dit, sans attendre un mot trop tardif', () => {
  const scene = { start: 0, end: 4, words: [{ text: 'pourquoi', start: 0.1 }, { text: 'presse', start: 1.0 }, { text: 'haut', start: 3.0 }] };
  const times = lineTimes([{ text: 'POURQUOI' }, { text: 'PRESSE' }, { text: 'SI HAUT' }, { text: 'FIN' }], scene);
  assert.ok(times.every((t, i) => i === 0 || t > times[i - 1]));
  assert.ok(times[1] >= 0.9);
  assert.ok(times[2] < 2.5, 'un mot dit a 3 s ne retarde pas la ligne de plus de 0,6 s');
  // Une scene tres courte : toutes les lignes commencent avant la fin.
  const short = lineTimes([{ text: 'A' }, { text: 'B' }, { text: 'C' }], { start: 0, end: 1 });
  assert.ok(short.every((t) => t <= 0.65));
});

test('buildFacelessHtml brutal : cadre qui se trace, lignes en masque, bloc fluo, un seul fluo par ecran, mot geant inverse', () => {
  const html = buildFacelessHtml(timelineOf([
    { say: 'Pourquoi ce club presse si haut dans le terrain adverse maintenant.', layout: 'hook', text: 'POURQUOI CE CLUB **PRESSE** SI HAUT ?', tab: 'Analyse tactique' },
    { say: 'Il presse quand la passe est en retrait, le controle mauvais, la touche adverse.', layout: 'list', title: 'Il **presse** quand :', items: [{ text: 'Passe en retrait', at: 'retrait' }, { text: 'Touche adverse', at: 'touche' }] },
    { say: 'On appelle ca le pressing et ca change tout dans le match.', layout: 'word', word: 'Pressing' },
    { say: 'Resultat quinze pour cent de ballons recuperes en plus ce mois.', layout: 'stat', word: '+15 %', text: 'Ballons **récupérés**', compare: [{ label: 'avant', value: '8 %' }, { label: 'après', value: '23 %' }] },
  ]), { style: defaultFacelessStyle('brutal-fluo', 'MALE') });
  const scenes = html.split('<section class="scene').slice(1);
  assert.equal(scenes.length, 4);
  for (const scene of scenes) assert.match(scene, /data-dash-at="0"/);
  assert.match(scenes[0], /scene bg-main|bg-main/);
  assert.match(scenes[0], /data-enter="wipe"/);
  assert.match(scenes[0], /class="flbg" data-sx-at=/);
  assert.match(scenes[0], /— Analyse tactique/);
  // Liste : le fluo est la rangee active, le titre n en porte pas.
  assert.doesNotMatch(scenes[1], /class="flbg"/);
  assert.match(scenes[1], /data-hl-b="#c6ff00"/);
  assert.match(scenes[2], /bg-dark/);
  assert.equal((scenes[2].match(/class="g wd"/g) || []).length, 5);
  assert.match(scenes[2], /data-enter="shock"/);
  // Chiffre cle : le fluo est le chiffre, la phrase n en porte pas.
  assert.equal((scenes[3].match(/class="flbg"/g) || []).length, 1);
  assert.match(html, /\["Anton","Space Mono"\]/);
  assert.match(html, /"captionTop":190/);
  assert.equal(brutalBg({ layout: 'word' }), 'dark');
  assert.equal(brutalBg({ layout: 'hook', bg: 'dark' }), 'main');
});

test('describeStyleForPrompt brutal : explique le mot cle et le mot geant', () => {
  const text = describeStyleForPrompt(defaultFacelessStyle('brutal-rose', 'MALE'));
  assert.match(text, /modèle BRUTAL/);
  assert.match(text, /UN seul mot/);
  assert.match(text, /"word"/);
});
