import test from 'node:test';
import assert from 'node:assert/strict';

import { FACELESS_PRESETS } from '../server/data/facelessThemes.js';
import { defaultFacelessStyle, describeStyleForPrompt, normalizeFacelessStyle } from '../server/utils/facelessStyle.js';
import { planForEditing, sanitizeFacelessPlan } from '../server/utils/facelessPlanGenerator.js';
import { layoutFacelessTimelineFromTrack } from '../server/utils/facelessTimeline.js';
import { buildFacelessHtml } from '../server/utils/facelessTemplate.js';
import { chartGeometry, dashboardBg, pillTone, seriesFor, trendOf } from '../server/utils/facelessTemplateDashboard.js';

const DASHBOARD = ['dashboard-indigo', 'dashboard-vert', 'dashboard-bleu'];

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

test('dashboard : 3 modeles, accent lisible sur les cartes blanches, texte sur fond gris', () => {
  for (const key of DASHBOARD) {
    const base = FACELESS_PRESETS[key].style;
    assert.equal(normalizeFacelessStyle({ ...base }).template, 'dashboard', key);
    assert.equal(base.font, 'geist');
    assert.ok(ratio(base.palette.accent, '#ffffff') >= 4.5, `${key} : accent sur blanc`);
    assert.ok(ratio(base.palette.text, base.palette.background) >= 12, `${key} : texte sur le fond`);
    assert.ok(ratio('#ffffff', base.palette.dark) >= 12, `${key} : cartes sur fond sombre`);
  }
});

test('trendOf et pillTone : le sens se lit dans le texte, jamais invente', () => {
  assert.equal(trendOf('en baisse'), 'down');
  assert.equal(trendOf('↓ 3,1 pts'), 'down');
  assert.equal(trendOf('-12 %'), 'down');
  assert.equal(trendOf('+12 %'), 'up');
  assert.equal(trendOf('en hausse'), 'up');
  assert.equal(trendOf('stables'), 'flat');
  assert.equal(pillTone('Alerte'), 'alert');
  assert.equal(pillTone('↓ 3,1 pts'), 'good');
  assert.equal(pillTone('plus rapide'), 'neutral');
});

test('seriesFor : la serie du script, sinon avant / apres ; jamais sans deux valeurs chiffrees', () => {
  assert.deepEqual(seriesFor({ series: [{ label: 'Mai', value: '5,2' }, { label: 'Juin', value: '4,7' }] }).map((p) => p.value), [5.2, 4.7]);
  assert.deepEqual(seriesFor({ compare: [{ label: 'Avant', value: '5,2 %' }, { label: 'Après', value: '2,1 %' }] }).map((p) => p.label), ['Avant', 'Après']);
  assert.equal(seriesFor({ compare: [{ label: 'Avant', value: 'beaucoup' }, { label: 'Après', value: '2,1 %' }] }), null);
  assert.equal(seriesFor({ series: [{ label: 'Mai', value: '5,2' }] }), null);
  assert.equal(seriesFor({}), null);
});

test('chartGeometry : la plus grande valeur est en haut, aire fermee, droite si valeurs egales', () => {
  const g = chartGeometry([5, 2.5, 1], { w: 400, h: 200, padX: 10, padTop: 20, padBottom: 20 });
  assert.equal(g.points.length, 3);
  assert.ok(g.points[0].y < g.points[1].y && g.points[1].y < g.points[2].y);
  assert.equal(g.points[0].x, 10);
  assert.equal(g.points[2].x, 390);
  assert.match(g.line, /^M10,20 L200,/);
  assert.match(g.area, /Z$/);
  assert.ok(chartGeometry([3, 3, 3], { h: 200 }).points.every((p) => p.y === 100));
  assert.equal(chartGeometry([1]), null);
});

test('plan : "sub", "series" et la comparaison de l accroche sont gardes et nettoyes', () => {
  const plan = sanitizeFacelessPlan({ scenes: [
    { say: 'Une accroche avec deux metriques.', layout: 'hook', text: 'Une **accroche**', compare: [{ label: 'Inscriptions', value: 'stables' }, { label: 'Clients', value: 'en baisse' }] },
    { say: 'Une liste.', layout: 'list', title: 'A surveiller', items: [{ text: 'Connexions', sub: 'Il se désengage', at: 'a' }, { text: 'Tickets', sub: '', at: 'b' }] },
    { say: 'Un chiffre.', layout: 'stat', word: '2,1 %', series: [{ label: 'Mai', value: '5,2' }, { label: 'Juin', value: '' }, { label: 'Juil', value: '4,1' }] },
  ] });
  assert.equal(plan.scenes[0].compare.length, 2);
  assert.equal(plan.scenes[1].items[0].sub, 'Il se désengage');
  assert.deepEqual(plan.scenes[2].series.map((p) => p.label), ['Mai', 'Juil']);
  assert.equal(planForEditing(plan).scenes[2].series.length, 2);
  assert.equal(planForEditing(plan).scenes[0].compare.length, 2);
});

test('buildFacelessHtml dashboard : cartes, pastilles, courbe dessinee, compteur avant / apres, fond sombre pour l appel a l action', () => {
  const html = buildFacelessHtml(timelineOf([
    { say: 'Ton SaaS perd des clients en silence et tu ne le vois pas dans tes chiffres.', layout: 'hook', tab: 'Alerte', text: 'Ton SaaS perd des clients **en silence.**', compare: [{ label: 'Inscriptions', value: 'stables' }, { label: 'Clients actifs', value: 'en baisse' }] },
    { say: 'Trois signaux a surveiller : les connexions, les tickets, la facture.', layout: 'list', title: 'À surveiller', items: [{ text: 'Connexions en baisse', sub: 'Il se désengage', at: 'connexions' }, { text: 'Tickets', sub: 'Il se sent ignoré', at: 'tickets' }] },
    { say: 'Le churn mensuel passe de cinq virgule deux a deux virgule un pour cent.', layout: 'stat', title: 'Churn mensuel', word: '2,1 %', text: '↓ 3,1 pts', compare: [{ label: 'Avant', value: '5,2 %' }, { label: 'Après', value: '2,1 %' }], series: [{ label: 'Mai', value: '5,2' }, { label: 'Juin', value: '4,0' }, { label: 'Juil', value: '2,1' }] },
    { say: 'Abonne toi pour la suite de la serie.', layout: 'avatar', text: '**Abonne-toi** pour la suite', bg: 'dark' },
  ]), { style: defaultFacelessStyle('dashboard-indigo', 'MALE') });
  const scenes = html.split('<section class="scene').slice(1);
  assert.equal(scenes.length, 4);
  assert.match(scenes[0], /class="pill alert wd" data-enter="pill"/);
  assert.match(scenes[0], /class="gcard mini wd"/);
  assert.match(scenes[0], /class="mval down"/);
  assert.match(scenes[0], /↓ en baisse/);
  assert.match(scenes[1], /data-hl-prop="borderColor"/);
  assert.match(scenes[1], /data-hl-prop="backgroundColor"/);
  assert.match(scenes[2], /data-count-from="5.2" data-count-to="2.1"/);
  assert.match(scenes[2], /data-dash-ease="inout"/);
  assert.match(scenes[2], /data-clip-at=/);
  assert.equal((scenes[2].match(/data-pop-at=/g) || []).length, 3);
  assert.match(scenes[2], /data-halo-at=/);
  assert.match(scenes[2], /class="bval now"/);
  assert.match(scenes[3], /bg-dark/);
  assert.match(html, /\["Geist","Geist Mono"\]/);
  assert.match(html, /"captionTop":190/);
  const ids = [...html.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(new Set(ids).size, ids.length, 'jamais deux elements avec le meme id');
  assert.equal(dashboardBg({ bg: 'alt' }), 'main');
  assert.equal(dashboardBg({ bg: 'dark' }), 'dark');
});

test('buildFacelessHtml dashboard : sans valeurs chiffrees, pas de graphique ; le compteur part de zero si l unite differe', () => {
  const html = buildFacelessHtml(timelineOf([
    { say: 'Quinze fois plus rapide sur cette mesure et sur toutes les autres.', layout: 'stat', title: 'Vitesse', word: '×15', text: 'plus rapide' },
    { say: 'Un autre chiffre sans unite commune ici dans cette scene.', layout: 'stat', title: 'Autre', word: '12 %', compare: [{ label: 'Avant', value: '8 ms' }, { label: 'Après', value: '3 ms' }] },
  ]), { style: defaultFacelessStyle('dashboard-vert', 'MALE') });
  const [a, b] = html.split('<section class="scene').slice(1);
  assert.doesNotMatch(a, /class="chart"/);
  assert.match(a, /data-count-from="0"/);
  assert.match(b, /class="chart"/);
  assert.match(b, /data-count-from="0" data-count-to="12"/);
});

test('describeStyleForPrompt dashboard : explique series, sub et le sens du rouge et du vert', () => {
  const text = describeStyleForPrompt(defaultFacelessStyle('dashboard-bleu', 'MALE'));
  assert.match(text, /modèle DASHBOARD/);
  assert.match(text, /"series"/);
  assert.match(text, /"sub"/);
  assert.match(text, /Rouge et vert/);
});
