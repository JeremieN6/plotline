import test from 'node:test';
import assert from 'node:assert/strict';

import { FACELESS_PRESETS } from '../server/data/facelessThemes.js';
import { defaultFacelessStyle, describeStyleForPrompt, normalizeFacelessStyle } from '../server/utils/facelessStyle.js';
import { sanitizeFacelessPlan, planForEditing } from '../server/utils/facelessPlanGenerator.js';
import { layoutFacelessTimelineFromTrack } from '../server/utils/facelessTimeline.js';
import { buildFacelessHtml } from '../server/utils/facelessTemplate.js';
import { activeLineIndex, codeLinesFor, tokenizeCode, typingSchedule } from '../server/utils/facelessTemplateEditeur.js';

const EDITEUR = ['editeur-cyan', 'editeur-corail', 'editeur-jaune'];

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

test('editeur : 3 modeles, modele visuel "editeur", lisibles sur le panneau', () => {
  for (const key of EDITEUR) {
    const base = FACELESS_PRESETS[key].style;
    assert.equal(normalizeFacelessStyle({ ...base }).template, 'editeur', key);
    assert.equal(base.font, 'sora');
    assert.ok(ratio(base.palette.text, base.palette.card) >= 7, `${key} : texte`);
    assert.ok(ratio(base.palette.accent, base.palette.card) >= 4.5, `${key} : surbrillance`);
    assert.ok(ratio(base.palette.accent2, base.palette.background) >= 4.5, `${key} : mot cle`);
  }
});

test('tokenizeCode : mots reserves, chaines, nombres, commentaires, fonctions', () => {
  const roles = (line) => tokenizeCode(line).filter((t) => t.t !== 'punct').map((t) => `${t.t}:${t.v}`);
  assert.deepEqual(roles('const site = { temps: "4 secondes" };'), ['kw:const', 'id:site', 'id:temps', 'str:"4 secondes"']);
  assert.deepEqual(roles('cache.get(); // vite'), ['id:cache', 'fn:get', 'com:// vite']);
  assert.deepEqual(roles('return 27,9'), ['kw:return', 'num:27,9']);
  // Rien n est perdu : les jetons recomposent la ligne.
  const line = 'const x = [ "a", 3 ]; // ok';
  assert.equal(tokenizeCode(line).map((t) => t.v).join(''), line);
});

test('codeLinesFor : le code de Claude, sinon une ligne deduite du mot cle', () => {
  assert.deepEqual(codeLinesFor({ code: ['a', ' ', 'b', 'c', 'd', 'e', 'f', 'g'] }, 3), ['a', 'b', 'c']);
  assert.deepEqual(codeLinesFor({ title: 'La Solution', text: 'Elle est **en mémoire**' }), ['// la solution', 'const idee = "en mémoire";']);
});

test('activeLineIndex et typingSchedule : ligne du mot cle, frappe dans l ordre et assez rapide', () => {
  const lines = ['const site = {', '  temps: "4 secondes",', '};', '// trop lent.'];
  assert.equal(activeLineIndex(lines, '4 secondes'), 1);
  // Sans mot cle : la derniere ligne qui porte du contenu (ni accolade seule, ni commentaire).
  assert.equal(activeLineIndex(lines, ''), 1);
  const { starts, cps } = typingSchedule(lines, { voiceStart: 0, voiceEnd: 2 });
  assert.ok(cps >= 28);
  assert.ok(starts.every((s, i) => i === 0 || s > starts[i - 1]));
  // Une ligne ne commence pas avant son repere.
  assert.ok(typingSchedule(['a', 'b'], { voiceStart: 0, voiceEnd: 3 }, [0, 2]).starts[1] >= 2);
});

test('plan : "code" nettoye (6 lignes, 32 caracteres, sans caracteres de controle) et visible en retouche', () => {
  const plan = sanitizeFacelessPlan({ scenes: [
    { say: 'Une phrase.', layout: 'hook', text: 'Une **phrase**', code: ['const a = 1;\u0007', 'x'.repeat(50), '', '1', '2', '3', '4', '5'] },
    { say: 'Deux phrases.', layout: 'avatar', text: 'Deux' },
  ] });
  assert.equal(plan.scenes[0].code.length, 6);
  assert.equal(plan.scenes[0].code[0], 'const a = 1;');
  assert.equal(plan.scenes[0].code[1].length, 32);
  assert.deepEqual(planForEditing(plan).scenes[0].code, plan.scenes[0].code);
  assert.equal(planForEditing(plan).scenes[1].code, undefined);
});

test('buildFacelessHtml editeur : panneau, frappe, curseur, bulle, diff, terminal, ids uniques', () => {
  const html = buildFacelessHtml(timelineOf([
    { say: 'Ton site met quatre secondes.', layout: 'hook', tab: 'site.js', text: 'Ton site met **4 secondes**', code: ['const site = {', '  temps: "4 secondes",', '};'] },
    { say: 'Elle est en memoire.', layout: 'title', title: 'la solution', text: 'Elle est **en mémoire**' },
    { say: 'On appelle ca le cache.', layout: 'word', word: 'cache' },
    { say: 'Encore le cache.', layout: 'word', word: 'cache' },
    { say: 'Quinze fois plus rapide.', layout: 'stat', word: '×15', compare: [{ label: 'sans cache', value: '27,9 ms' }, { label: 'avec cache', value: '1,9 ms' }] },
  ]), { style: defaultFacelessStyle('editeur-cyan', 'MALE') });
  assert.match(html, /class="panel"/);
  assert.match(html, /site\.js/);
  assert.match(html, /data-type-at=/);
  assert.match(html, /data-cur-from=/);
  assert.match(html, /color:#ffd166">&quot;4 secondes&quot;/);
  assert.match(html, /class="ring"/);
  assert.match(html, /class="drow wd minus"/);
  assert.match(html, /class="drow wd plus"/);
  assert.match(html, /data-count-to="15"/);
  assert.match(html, /\$ expliquer --mot/);
  assert.match(html, /\["Sora","JetBrains Mono"\]/);
  assert.match(html, /"captionTop":170/);
  const ids = [...html.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(new Set(ids).size, ids.length, 'deux elements ne partagent jamais un id');
});

test('describeStyleForPrompt editeur : explique "code" et "tab"', () => {
  const text = describeStyleForPrompt(defaultFacelessStyle('editeur-jaune', 'MALE'));
  assert.match(text, /modèle ÉDITEUR/);
  assert.match(text, /"code"/);
  assert.match(text, /"tab"/);
});
