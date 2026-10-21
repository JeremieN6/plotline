import test from 'node:test';
import assert from 'node:assert/strict';

import { FACELESS_PRESETS } from '../server/data/facelessThemes.js';
import { buildFacelessPlanSystemPrompt, planForEditing, sanitizeFacelessPlan } from '../server/utils/facelessPlanGenerator.js';
import { defaultFacelessStyle, describeStyleForPrompt, normalizeFacelessStyle } from '../server/utils/facelessStyle.js';
import { layoutFacelessTimelineFromTrack } from '../server/utils/facelessTimeline.js';
import { buildFacelessHtml } from '../server/utils/facelessTemplate.js';
import { tierLetter, tierRowHeight, tierTone } from '../server/utils/facelessTemplateHanko.js';

const HANKO = ['hanko-rouge', 'hanko-indigo', 'hanko-pin'];

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

test('hanko : 3 modeles, modele visuel "hanko", texte et accent lisibles sur le papier', () => {
  for (const key of HANKO) {
    const base = FACELESS_PRESETS[key].style;
    assert.equal(normalizeFacelessStyle({ ...base }).template, 'hanko', key);
    assert.equal(base.font, 'shipporimincho');
    assert.ok(ratio(base.palette.text, base.palette.background) >= 10, `${key} : texte`);
    assert.ok(ratio(base.palette.accent, base.palette.background) >= 3, `${key} : accent (grand corps)`);
    assert.ok(ratio('#fffdf7', base.palette.accent) >= 3, `${key} : creme sur le tampon`);
  }
});

test('tier list : lettre donnee dans "sub" sinon S, A, B, C dans l ordre ; hauteur de rangee bornee', () => {
  assert.equal(tierLetter({ sub: 'b' }, 0), 'B');
  assert.equal(tierLetter({ sub: 'excellent' }, 1), 'A');
  assert.equal(tierLetter({}, 7), 'C');
  assert.deepEqual(['S', 'A', 'B', 'C'].map(tierTone), ['accent', 'ink', 'gray', 'gray']);
  assert.equal(tierRowHeight(3), 300 > (1500 - 640) / 3 - 18 ? Math.floor((1500 - 640) / 3) - 18 : 300);
  assert.ok(tierRowHeight(4) < tierRowHeight(2));
  assert.ok(tierRowHeight(1) <= 300);
});

test('plan : "jp" ne garde que des caracteres japonais (4 au plus)', () => {
  const plan = sanitizeFacelessPlan({ scenes: [
    { say: 'Un anime.', layout: 'hook', text: 'Un anime', jp: 'アニメーション' },
    { say: 'Un mot.', layout: 'word', word: 'Culte', jp: 'abc 傑作 !' },
    { say: 'Rien.', layout: 'avatar', text: 'Rien', jp: 'seulement latin' },
  ] });
  assert.equal(plan.scenes[0].jp, 'アニメー');
  assert.equal(plan.scenes[1].jp, '傑作');
  assert.equal(plan.scenes[2].jp, '');
  assert.equal(planForEditing(plan).scenes[1].jp, '傑作');
  assert.equal(planForEditing(plan).scenes[2].jp, undefined);
});

test('prompt : la DA Hanko decrit le tampon, la tier list et le champ jp', () => {
  const text = describeStyleForPrompt(defaultFacelessStyle('hanko-rouge', 'MALE'));
  assert.match(text, /modèle HANKO/);
  assert.match(text, /"jp"/);
  assert.match(text, /TIER LIST/);
  assert.match(buildFacelessPlanSystemPrompt({ style: defaultFacelessStyle('hanko-rouge', 'MALE') }), /"jp"\?: string/);
});

test('buildFacelessHtml hanko : disque, katakana, tampon avec flash, tier list, bulle', () => {
  const html = buildFacelessHtml(timelineOf([
    { say: 'Cet anime va te briser le coeur, sans spoiler, mon avis de fan.', layout: 'hook', text: 'Cet anime va te briser le **coeur.**', jp: 'アニメ', tab: 'mon avis de fan' },
    { say: 'Personne ne ma prevenu, vraiment personne au monde.', layout: 'title', text: 'Personne ne m’avait **prévenu !**' },
    { say: 'Ma tier list : le premier est culte, le deuxieme excellent.', layout: 'list', title: 'Ma **tier list**', items: [{ text: 'Chihiro', at: 'premier' }, { text: 'Perfect Blue', sub: 'B', at: 'deuxieme' }] },
    { say: 'On dit dun anime quil est culte, le mot est lache vraiment.', layout: 'word', title: 'On dit d’un anime', word: 'Culte', jp: '傑作' },
  ]), { style: defaultFacelessStyle('hanko-rouge', 'MALE') });
  const scenes = html.split('<section class="scene').slice(1);
  assert.equal(scenes.length, 4);
  assert.match(scenes[0], /data-enter="hk-disc"[^>]*data-pulse="0.015"/);
  assert.match(scenes[0], /class="kana">アニメ/);
  assert.doesNotMatch(scenes[0], /class="ul"/, 'sur le disque rouge le mot important reste noir');
  assert.match(scenes[1], /class="bub"/);
  assert.match(scenes[1], /data-enter="hanko"/);
  assert.match(scenes[1], /data-flash-at=/);
  assert.match(scenes[2], /class="tl accent"/);
  assert.match(scenes[2], /class="tl gray"[^>]*>B</);
  assert.match(scenes[2], /data-enter="clip-row"/);
  assert.match(scenes[3], /class="stamp v"[^>]*>傑作/);
  assert.match(html, /"captionTop":200/);
  const ids = [...html.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(new Set(ids).size, ids.length, 'jamais deux elements avec le meme id');
});
