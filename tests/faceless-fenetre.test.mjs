import test from 'node:test';
import assert from 'node:assert/strict';

import { FACELESS_PRESETS } from '../server/data/facelessThemes.js';
import { defaultFacelessStyle, describeStyleForPrompt, normalizeFacelessStyle } from '../server/utils/facelessStyle.js';
import { sanitizeFacelessPlan, planForEditing } from '../server/utils/facelessPlanGenerator.js';
import { layoutFacelessTimelineFromTrack } from '../server/utils/facelessTimeline.js';
import { buildFacelessHtml } from '../server/utils/facelessTemplate.js';
import { compareWidths, parseCountable, revealTimes, revealUnits } from '../server/utils/facelessTemplateFenetre.js';

const FENETRE = ['fenetre-orange', 'fenetre-cobalt', 'fenetre-olive', 'fenetre-baie'];

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

const SCENES = [
  { say: 'Ton site met quatre secondes a charger.', layout: 'hook', tab: 'monsite.fr', text: 'Ton site met **4 secondes**' },
  { say: 'Trois couches : navigateur, CDN, Redis.', layout: 'list', items: [{ text: 'Navigateur', at: 'navigateur' }, { text: 'CDN', at: 'CDN' }] },
  { say: 'Quinze fois plus rapide.', layout: 'stat', word: '×15', compare: [{ label: 'sans cache', value: '27,9 ms' }, { label: 'avec cache', value: '1,9 ms' }] },
];

test('fenetre : 4 modeles, modele visuel "fenetre", lisibles', () => {
  for (const key of FENETRE) {
    const base = FACELESS_PRESETS[key].style;
    const style = normalizeFacelessStyle({ ...base });
    assert.equal(style.template, 'fenetre', key);
    assert.equal(style.font, 'bricolage');
    assert.equal(defaultFacelessStyle(key, 'MALE').template, 'fenetre');
    // Une seule dominante : fond et etiquettes de la meme couleur ; texte blanc des etiquettes lisible en grand (>= 3).
    assert.equal(base.palette.accent, base.palette.background);
    assert.ok(ratio('#ffffff', base.palette.background) >= 3, `${key} : blanc sur la dominante`);
    assert.ok(ratio(base.palette.text, '#0e0e10') >= 7, `${key} : texte sur l ecran`);
    assert.ok(ratio(base.palette.accent2, '#0e0e10') >= 7, `${key} : mot en couleur sur l ecran`);
  }
});

test('fenetre : une DA enregistree avant les modeles reste "classic", un modele inconnu aussi', () => {
  assert.equal(normalizeFacelessStyle({ preset: 'brutalisme', font: 'archivo' }).template, 'classic');
  assert.equal(normalizeFacelessStyle({}).template, 'classic');
  assert.equal(normalizeFacelessStyle({ preset: 'fenetre-orange', template: 'n-importe-quoi' }).template, 'fenetre');
  assert.equal(normalizeFacelessStyle({ preset: 'brutalisme', template: 'fenetre' }).template, 'fenetre');
});

test('revealUnits : mots, mot cle groupe et sauts de ligne', () => {
  assert.deepEqual(revealUnits('Ton site **4 secondes**\nà charger'), [
    { text: 'Ton', kw: false }, { text: 'site', kw: false }, { text: '4 secondes', kw: true }, { br: true }, { text: 'à', kw: false }, { text: 'charger', kw: false },
  ]);
});

test('revealTimes : mots dans l ordre, mot cle cale sur la voix quand il est dit', () => {
  const scene = { start: 10, voiceStart: 10, voiceEnd: 13, words: [{ text: 'Ton', start: 10 }, { text: 'site', start: 10.3 }, { text: 'met', start: 10.6 }, { text: 'quatre', start: 10.9 }, { text: '4', start: 11.8 }] };
  const units = revealUnits('Ton site met **4 secondes**');
  const times = revealTimes(units, scene);
  assert.ok(times[0] < times[1] && times[1] < times[2]);
  assert.equal(times[3], 1.75);
  // Mot cle jamais dit : il suit simplement les autres.
  const silent = revealTimes(revealUnits('Ton **site**'), { start: 0, voiceStart: 0, voiceEnd: 2, words: [] });
  assert.ok(silent[1] > silent[0]);
});

test('parseCountable et compareWidths : compteur et barres proportionnelles', () => {
  assert.deepEqual(parseCountable('×15'), { prefix: '×', number: 15, decimals: 0, suffix: '' });
  assert.deepEqual(parseCountable('27,9 ms'), { prefix: '', number: 27.9, decimals: 1, suffix: ' ms' });
  assert.deepEqual(parseCountable('-30 %'), { prefix: '-', number: 30, decimals: 0, suffix: ' %' });
  assert.equal(parseCountable('beaucoup'), null);
  assert.deepEqual(compareWidths([{ value: '27,9 ms' }, { value: '1,9 ms' }]), [100, 7]);
  assert.deepEqual(compareWidths([{ value: '10' }, { value: '0,1' }]), [100, 4]);
  assert.equal(compareWidths([{ value: 'lent' }, { value: '1,9 ms' }]), null);
  assert.equal(compareWidths([{ value: '3' }]), null);
});

test('plan : "stat", "tab" et "compare" nettoyes ; un "stat" sans chiffre retombe sur "avatar"', () => {
  const plan = sanitizeFacelessPlan({ scenes: [
    { say: 'Quinze fois plus rapide.', layout: 'stat', word: '×15', tab: 'resultat.live<script>', compare: [{ label: 'sans cache', value: '27,9 ms' }, { label: 'avec', value: '1,9 ms' }, { label: 'trop', value: '1' }] },
    { say: 'Rien a compter ici.', layout: 'stat', text: 'Rien' },
  ] });
  assert.equal(plan.scenes[0].layout, 'stat');
  assert.equal(plan.scenes[0].tab, 'resultat.livescript');
  assert.equal(plan.scenes[0].compare.length, 3);
  assert.equal(plan.scenes[1].layout, 'avatar');
  assert.equal(plan.scenes[1].compare, undefined);
  const edited = planForEditing(plan);
  assert.equal(edited.scenes[0].tab, 'resultat.livescript');
  assert.equal(edited.scenes[0].compare.length, 3);
});

test('buildFacelessHtml fenetre : fenetres, deux polices, etiquette des sous-titres, aucun element du modele classique', () => {
  const html = buildFacelessHtml(timelineOf(SCENES), { style: defaultFacelessStyle('fenetre-orange', 'MALE') });
  assert.match(html, /class="win"/);
  assert.match(html, /monsite\.fr/);
  assert.match(html, /font-family:"Bricolage Grotesque"/);
  assert.match(html, /font-family:"JetBrains Mono"/);
  assert.match(html, /\["Bricolage Grotesque","JetBrains Mono"\]/);
  assert.match(html, /"capWrap":true/);
  assert.match(html, /data-enter="window"/);
  assert.match(html, /class="wd kw-label" data-enter="label"/);
  assert.match(html, /data-count-to="15"/);
  assert.match(html, /data-bar-w="100"/);
  assert.match(html, /data-hl-from=/);
  assert.match(html, /data-fit-h=/);
  assert.doesNotMatch(html, /card-wrap/);
  assert.match(html, /"captionTop":200/);
});

test('buildFacelessHtml classic : inchange pour une DA classique (une seule police, pas de fenetre), "stat" dessine', () => {
  const html = buildFacelessHtml(timelineOf(SCENES), { style: defaultFacelessStyle('brutalisme', 'MALE') });
  assert.doesNotMatch(html, /class="win"/);
  assert.match(html, /\["Archivo"\]/);
  assert.match(html, /"capWrap":false/);
  assert.match(html, /class="big-word"[^>]*>×15/);
  assert.match(html, /sans cache : <mark>27,9 ms<\/mark>/);
});

test('describeStyleForPrompt fenetre : explique le modele et le champ "tab"', () => {
  const text = describeStyleForPrompt(defaultFacelessStyle('fenetre-cobalt', 'MALE'));
  assert.match(text, /modèle FENÊTRE/);
  assert.match(text, /"tab"/);
  assert.match(text, /"stat"/);
  assert.doesNotMatch(describeStyleForPrompt(defaultFacelessStyle('brutalisme', 'MALE')), /FENÊTRE/);
});
