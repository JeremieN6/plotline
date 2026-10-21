import test from 'node:test';
import assert from 'node:assert/strict';

import { FACELESS_LAYOUTS } from '../server/data/facelessCatalog.js';
import { FACELESS_PRESETS } from '../server/data/facelessThemes.js';
import { buildFacelessPlanSystemPrompt, planForEditing, sanitizeFacelessPlan } from '../server/utils/facelessPlanGenerator.js';
import { defaultFacelessStyle, describeStyleForPrompt, normalizeFacelessStyle } from '../server/utils/facelessStyle.js';
import { layoutFacelessTimelineFromTrack } from '../server/utils/facelessTimeline.js';
import { buildFacelessHtml } from '../server/utils/facelessTemplate.js';
import { branchGeometry, glueQuotes, toneOf } from '../server/utils/facelessTemplateHerbier.js';
import { revealUnits } from '../server/utils/facelessTemplateFenetre.js';

const HERBIER = ['herbier-terracotta', 'herbier-lavande', 'herbier-argile'];

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

test('herbier : 3 modeles, modele visuel "herbier", texte et accent lisibles sur le papier', () => {
  for (const key of HERBIER) {
    const base = FACELESS_PRESETS[key].style;
    assert.equal(normalizeFacelessStyle({ ...base }).template, 'herbier', key);
    assert.equal(base.font, 'dmserif');
    assert.ok(ratio(base.palette.text, base.palette.background) >= 10, `${key} : texte`);
    // Le mot d accent n est qu en tres grand corps : seuil des grands textes.
    assert.ok(ratio(base.palette.accent, base.palette.background) >= 3, `${key} : accent`);
    assert.ok(ratio(base.palette.text, base.palette.backgroundAlt) >= 7, `${key} : texte sur le fond sauge`);
  }
});

test('toneOf : seuls avoid, good et watch sont des jugements', () => {
  assert.equal(toneOf('avoid'), 'avoid');
  assert.equal(toneOf('good'), 'good');
  assert.equal(toneOf('watch'), 'watch');
  assert.equal(toneOf('bad'), '');
  assert.equal(toneOf(undefined), '');
});

test('branchGeometry : une tige, des feuilles alternees de part et d autre, un fruit au bout', () => {
  const g = branchGeometry({ w: 600, h: 600, leaves: 6 });
  assert.match(g.stem, /^M[\d.]+,[\d.]+ C/);
  assert.equal(g.leaves.length, 6);
  // Les feuilles alternent (angles de signe oppose par rapport a la tige) et rapetissent vers le bout.
  assert.ok(g.leaves[0].size > g.leaves[5].size);
  assert.notEqual(Math.sign(g.leaves[0].angle - g.leaves[1].angle), 0);
  assert.ok(g.leaves.every((l) => l.x > 0 && l.x < 600 && l.y > 0 && l.y < 600));
  assert.ok(g.tip.x > g.leaves[0].x && g.tip.y < g.leaves[0].y, 'le fruit est au bout de la tige, en haut a droite');
});

test('glueQuotes : « et » restent colles a leur mot', () => {
  const units = glueQuotes(revealUnits('Ton shampoing « bio » ne l’est pas'));
  assert.deepEqual(units.map((u) => u.text), ['Ton', 'shampoing', '« bio »', 'ne', 'l’est', 'pas']);
  assert.deepEqual(glueQuotes(revealUnits('rien à coller ici')).map((u) => u.text), ['rien', 'à', 'coller', 'ici']);
});

test('plan : "label", "tone" et jusqu a 8 ingredients ; label sans deux ingredients retombe sur "avatar"', () => {
  const items = Array.from({ length: 10 }, (_, i) => ({ text: `Ingredient ${i}`, tone: i === 1 ? 'avoid' : (i === 2 ? 'nimporte' : 'good'), sub: i === 1 ? 'sulfate' : '', at: 0 }));
  const plan = sanitizeFacelessPlan({ scenes: [
    { say: 'Une etiquette a lire.', layout: 'label', title: 'Ingredients', tab: 'Shampoing · 250 ml', text: 'Verdict : **à reposer.**', items },
    { say: 'Pas assez.', layout: 'label', title: 'Ingredients', items: [{ text: 'Aqua', at: 0 }] },
    { say: 'Une liste.', layout: 'list', title: 'Reperes', items: items.slice(0, 6) },
  ] });
  assert.equal(plan.scenes[0].layout, 'label');
  assert.equal(plan.scenes[0].items.length, 8);
  assert.equal(plan.scenes[0].items[1].tone, 'avoid');
  assert.equal(plan.scenes[0].items[2].tone, '', 'un ton inconnu n est pas un jugement');
  assert.equal(plan.scenes[1].layout, 'avatar');
  assert.equal(plan.scenes[2].items.length, 4, 'une liste ordinaire reste a 4 elements');
  assert.equal(planForEditing(plan).scenes[0].items[1].tone, 'avoid');
});

test('prompt : la mise en page "label" n est proposee que par le modele Herbier', () => {
  assert.ok(FACELESS_LAYOUTS.label);
  assert.match(buildFacelessPlanSystemPrompt({ style: defaultFacelessStyle('herbier-terracotta', 'FEMALE') }), /  - label :/);
  assert.doesNotMatch(buildFacelessPlanSystemPrompt({ style: defaultFacelessStyle('brutal-fluo', 'MALE') }), /  - label :/);
  assert.doesNotMatch(buildFacelessPlanSystemPrompt({}), /  - label :/);
  const text = describeStyleForPrompt(defaultFacelessStyle('herbier-lavande', 'FEMALE'));
  assert.match(text, /modèle HERBIER/);
  assert.match(text, /"label"/);
  assert.match(text, /avoid/);
});

test('buildFacelessHtml herbier : rameau, titres en italique, cases a cocher, etiquette lue ligne par ligne, disque de sauge', () => {
  const html = buildFacelessHtml(timelineOf([
    { say: 'Ton shampoing bio ne l’est peut etre pas, decryptage complet maintenant.', layout: 'hook', title: 'Décryptage', text: 'Ton shampoing « bio » ne l’est **peut-être pas.**' },
    { say: 'Pour choisir : un label fiable, une liste courte, zero silicone.', layout: 'list', tab: 'Pour choisir', title: 'Trois **repères**', items: [{ text: 'Un label fiable', tone: 'good', at: 'label' }, { text: 'Zéro sulfate', tone: 'avoid', at: 'silicone' }] },
    { say: 'L’ingredient star : l’aloe vera, Aloe barbadensis, un classique des soins.', layout: 'word', title: 'Ingrédient', word: 'Aloe', text: 'Aloe barbadensis' },
    { say: 'Decryptons : aqua, sulfate, dimethicone, jus d’aloe, parfum. Verdict : a reposer.', layout: 'label', title: 'Ingrédients', tab: 'Shampoing · 250 ml', text: 'Verdict : **à reposer.**', items: [{ text: 'Aqua', at: 0 }, { text: 'Sodium Laureth Sulfate', tone: 'avoid', sub: 'sulfate', at: 0 }, { text: 'Aloe Barbadensis Leaf Juice', tone: 'good', sub: 'aloe vera', at: 0 }, { text: 'Parfum', tone: 'watch', sub: 'à surveiller', at: 0 }] },
    { say: 'Abonne toi pour decrypter la suite avec moi, merci beaucoup.', layout: 'avatar', text: '**Abonne-toi** pour la suite' },
  ]), { style: defaultFacelessStyle('herbier-terracotta', 'FEMALE') });
  const scenes = html.split('<section class="scene').slice(1);
  assert.equal(scenes.length, 5);
  assert.match(scenes[0], /data-sway="1.2"/);
  assert.match(scenes[0], /data-pop-dur="0.3" data-pop-c="1.3"/);
  assert.match(scenes[0], /« bio »/);
  assert.match(scenes[0], /class="wd kw" data-enter="serif-in"[^>]*data-ink-b="#c4623a"/);
  assert.match(scenes[1], /class="chk" style="background:#2f7a4b"/);
  assert.match(scenes[1], /class="chk" style="background:#b3382c"/);
  assert.match(scenes[1], /data-hl-prop="borderColor"/);
  assert.match(scenes[2], /class="latin"/);
  assert.match(scenes[2], /data-type-cps="40" data-type-len="16"/);
  assert.match(scenes[3], /data-scan-at=/);
  assert.match(scenes[3], /class="strike" data-sx-at=/);
  assert.match(scenes[3], /class="wash" data-fade-at=/);
  assert.match(scenes[3], /class="vp avoid wd"/);
  assert.match(scenes[3], /class="vp good wd"/);
  assert.match(scenes[3], /class="vp watch wd"/);
  assert.match(scenes[4], /class="disc"/);
  assert.match(html, /\["DM Serif Display","DM Mono"\]/);
  assert.match(html, /"italic 400 100px \\"DM Serif Display\\""|italic 400 100px/);
  assert.match(html, /font-style:italic/);
  assert.match(html, /"captionTop":200/);
  const ids = [...html.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(new Set(ids).size, ids.length, 'jamais deux elements avec le meme id');
});
