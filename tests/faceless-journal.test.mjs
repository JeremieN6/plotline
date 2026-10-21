import test from 'node:test';
import assert from 'node:assert/strict';

import { FACELESS_PRESETS } from '../server/data/facelessThemes.js';
import { buildFacelessPlanSystemPrompt, sanitizeFacelessPlan } from '../server/utils/facelessPlanGenerator.js';
import { defaultFacelessStyle, describeStyleForPrompt, normalizeFacelessStyle } from '../server/utils/facelessStyle.js';
import { layoutFacelessTimelineFromTrack } from '../server/utils/facelessTimeline.js';
import { buildFacelessHtml } from '../server/utils/facelessTemplate.js';
import { glidePoint, isUpcoming, onDarkAccent } from '../server/utils/facelessTemplateJournal.js';

const JOURNAL = ['journal-violet', 'journal-vert', 'journal-orange', 'journal-bleu'];

const lin = (c) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const lum = (hex) => { const n = parseInt(hex.slice(1), 16); return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255); };
const ratio = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };

function timelineOf(rawScenes, options = {}) {
  const plan = sanitizeFacelessPlan({ scenes: rawScenes }, { captions: true, ...options });
  const words = [];
  let cursor = 0;
  for (const scene of plan.scenes) {
    for (const text of scene.say.split(/\s+/).filter(Boolean)) { words.push({ text, start: cursor, end: cursor + 0.3 }); cursor += 0.3; }
  }
  return layoutFacelessTimelineFromTrack(plan, { path: 'x', duration: cursor, words }, { leadIn: 0, gap: 0, tail: 0.5, visualLead: 0 });
}

test('journal : 4 modeles, modele visuel "journal", accent et texte lisibles', () => {
  for (const key of JOURNAL) {
    const base = FACELESS_PRESETS[key].style;
    assert.equal(normalizeFacelessStyle({ ...base }).template, 'journal', key);
    assert.equal(base.font, 'instrumentserif');
    assert.ok(ratio(base.palette.text, base.palette.background) >= 10, `${key} : texte`);
    assert.ok(ratio(base.palette.accent, base.palette.background) >= 3.5, `${key} : accent sur le papier`);
    assert.ok(ratio('#ffffff', base.palette.accent) >= 3.5, `${key} : coche blanche sur le disque`);
    assert.ok(ratio(base.palette.text, base.palette.backgroundAlt) >= 10, `${key} : texte sur la teinte douce`);
    assert.ok(ratio(onDarkAccent(base.palette.accent), base.palette.dark) >= 4.5, `${key} : accent eclairci sur le fond sombre`);
  }
});

test('isUpcoming : seul le ton "watch" marque une ligne a venir', () => {
  assert.equal(isUpcoming({ tone: 'watch' }), true);
  assert.equal(isUpcoming({ tone: 'good' }), false);
  assert.equal(isUpcoming({}), false);
});

test('glidePoint : le curseur part du depart, arrive au point, et la courbe s ecarte de la droite', () => {
  const path = { x0: 100, y0: 800, x1: 500, y1: 400, bend: -90 };
  assert.deepEqual(glidePoint(path, 0), { x: 100, y: 800 });
  const end = glidePoint(path, 1);
  assert.equal(Math.round(end.x), 500);
  assert.equal(Math.round(end.y), 400);
  const mid = glidePoint(path, 0.5);
  const straight = glidePoint({ ...path, bend: 0 }, 0.5);
  assert.ok(Math.hypot(mid.x - straight.x, mid.y - straight.y) > 20, 'la trajectoire est courbe');
});

test('prompt : la DA Journal decrit le ship log, les lignes a venir et la capture', () => {
  const text = describeStyleForPrompt(defaultFacelessStyle('journal-violet', 'MALE'));
  assert.match(text, /modèle JOURNAL/);
  assert.match(text, /SHIP LOG/);
  assert.match(text, /"watch"/);
  assert.match(text, /photo/);
  assert.match(buildFacelessPlanSystemPrompt({ style: defaultFacelessStyle('journal-violet', 'MALE') }), /MONTAGE/);
});

test('buildFacelessHtml journal : disques de personas, notification, ship log avec ligne a venir, capture avec curseur', () => {
  const illustrations = { shot1: { kind: 'mockup', label: 'maquette', url: 'mem://x' } };
  const html = buildFacelessHtml(timelineOf([
    { say: 'Je construis une agence de personnas IA, seul, depuis des mois.', layout: 'hook', title: 'Journal de bord', text: 'Je construis une agence de personnas IA, **seul.**' },
    { say: 'Un persona, cest un visage coherent partout, tout le temps.', layout: 'title', title: 'Le principe', text: 'Un persona, c’est un visage **cohérent** partout.', tab: 'Persona créé' },
    { say: 'Livre cette semaine : la bibliotheque, les templates, et bientot la refonte.', layout: 'list', tab: 'Ship log', title: 'Livré cette **semaine**', items: [{ text: 'Bibliothèque', at: 'bibliotheque' }, { text: 'Refonte', tone: 'watch', at: 'refonte' }] },
    { say: 'Le vrai probleme, cest la coherence, plan apres plan, sans jamais changer.', layout: 'word', title: 'Le vrai problème', word: 'Cohérence', text: 'Garder le même visage.' },
    { say: 'Un persona, 4 plans, le meme visage, voila la capture du produit.', layout: 'photo', tab: 'plotline.sassify.fr', text: 'Un persona, **4 plans.**', image: 'shot1' },
  ], { illustrationIds: ['shot1'] }), { style: defaultFacelessStyle('journal-violet', 'MALE'), illustrations });
  const scenes = html.split('<section class="scene').slice(1);
  assert.equal(scenes.length, 5);
  assert.equal((scenes[0].match(/data-enter="persona-in"/g) || []).length, 3);
  assert.match(scenes[1], /class="toast"/);
  assert.match(scenes[1], /data-enter="jr-toast"/);
  assert.match(scenes[2], /class="card row"/);
  assert.match(scenes[2], /class="card row up"/);
  assert.match(scenes[2], /data-dashrun="24"/);
  assert.match(scenes[3], /data-enter="jr-giant"/);
  assert.match(scenes[3], /class="bar" data-line-at=/);
  assert.match(scenes[4], /data-glide-at="0.5"/);
  assert.match(scenes[4], /class="url">plotline.sassify.fr/);
  assert.match(html, /\["Instrument Serif","IBM Plex Mono"\]/);
  assert.match(html, /"captionTop":200/);
  const ids = [...html.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(new Set(ids).size, ids.length, 'jamais deux elements avec le meme id');
});
