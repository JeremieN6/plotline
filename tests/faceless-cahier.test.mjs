import test from 'node:test';
import assert from 'node:assert/strict';

import { FACELESS_PRESETS } from '../server/data/facelessThemes.js';
import { defaultFacelessStyle, describeStyleForPrompt, normalizeFacelessStyle } from '../server/utils/facelessStyle.js';
import { sanitizeFacelessPlan } from '../server/utils/facelessPlanGenerator.js';
import { layoutFacelessTimelineFromTrack } from '../server/utils/facelessTimeline.js';
import { buildFacelessHtml } from '../server/utils/facelessTemplate.js';
import { keywordEm, stepHeights } from '../server/utils/facelessTemplateCahier.js';

const CAHIER = ['cahier-vert', 'cahier-bleu', 'cahier-brique'];

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

test('cahier : 3 modeles, modele visuel "cahier", lisibles', () => {
  for (const key of CAHIER) {
    const base = FACELESS_PRESETS[key].style;
    assert.equal(normalizeFacelessStyle({ ...base }).template, 'cahier', key);
    assert.equal(base.font, 'intertight');
    assert.ok(ratio(base.palette.text, base.palette.background) >= 7, `${key} : texte`);
    assert.ok(ratio(base.palette.accent, base.palette.background) >= 4.5, `${key} : accent`);
    // Le gris du premier niveau n est utilise qu en grand (>= 80 px) : seuil des grands textes.
    assert.ok(ratio(base.palette.accent2, base.palette.background) >= 3, `${key} : gris`);
  }
});

test('keywordEm : un mot long est reduit pour tenir dans la largeur, un mot court plafonne', () => {
  assert.equal(keywordEm('cache', 88), 2.6);
  const long = keywordEm('anticonstitutionnellement', 88);
  assert.ok(long < 1 && long * 88 * 0.56 * 25 <= 864 + 1);
  // Plusieurs mots : c est le plus long qui compte.
  assert.equal(keywordEm('4 secondes', 96), keywordEm('secondes', 96));
});

test('stepHeights : marches proportionnelles aux valeurs, sinon escalier regulier', () => {
  assert.deepEqual(stepHeights([{ value: '27,9 ms' }, { value: '1,9 ms' }, { value: '0 ms' }]), [620, 146, 130]);
  assert.deepEqual(stepHeights([{ value: 'beaucoup' }, { value: 'peu' }]), [620, 110]);
});

test('buildFacelessHtml cahier : phrase a deux niveaux, encre calee sur la voix, quadrillage, marches, aucun debordement possible', () => {
  const html = buildFacelessHtml(timelineOf([
    { say: 'Ton site met quatre secondes a charger.', layout: 'hook', text: 'Ton site met **4 secondes** à charger.' },
    { say: 'Trois couches de cache.', layout: 'list', title: 'Trois couches de **cache**', items: [{ text: 'Navigateur', at: 'Trois' }, { text: 'CDN', at: 'cache.' }] },
    { say: 'Chaque couche divise l attente.', layout: 'stat', word: '×15', text: 'Chaque couche **divise**', compare: [{ label: 'Disque', value: '27,9 ms' }, { label: 'RAM', value: '1,9 ms' }, { label: 'Local', value: '0 ms' }] },
  ]), { style: defaultFacelessStyle('cahier-vert', 'MALE') });
  assert.match(html, /font-family:"Inter Tight"/);
  assert.match(html, /\["Inter Tight","IBM Plex Mono"\]/);
  assert.match(html, /class="wd kw" data-enter="blur-big"[^>]*data-ink-a="#8b8d86" data-ink-b="#111111"/);
  assert.match(html, /data-fit-w="864"/);
  assert.match(html, /class="stmt" data-fit-h=/);
  assert.match(html, /calc\(var\(--t, 0\) \* -12px\)/);
  assert.match(html, /data-hl-prop="borderColor"/);
  assert.equal((html.match(/data-grow-h=/g) || []).length, 3);
  assert.match(html, /data-enter="flag"/);
  assert.match(html, /"captionTop":190/);
  assert.match(html, /"capWrap":false/);
  assert.doesNotMatch(html, /class="win"/);
});

test('describeStyleForPrompt cahier : explique la phrase a deux niveaux', () => {
  const text = describeStyleForPrompt(defaultFacelessStyle('cahier-bleu', 'MALE'));
  assert.match(text, /modèle CAHIER/);
  assert.match(text, /UN groupe entre \*\*/);
  assert.doesNotMatch(text, /FENÊTRE/);
});

test('cahier : avatar seulement sur la derniere scene (phrase seule), jamais sur l accroche', () => {
  const html = buildFacelessHtml(timelineOf([
    { say: 'Ton site met quatre secondes.', layout: 'hook', text: 'Ton site met **4 secondes**' },
    { say: 'Au milieu, une phrase seule.', layout: 'avatar', text: 'Une **phrase** seule' },
    { say: 'Abonne-toi pour la suite.', layout: 'avatar', text: '**Abonne-toi**' },
  ]), { style: defaultFacelessStyle('cahier-vert', 'MALE') });
  const scenes = html.split('<section class="scene').slice(1);
  assert.equal(scenes.length, 3);
  assert.doesNotMatch(scenes[0], /class="avatar/);
  assert.doesNotMatch(scenes[1], /class="avatar/);
  assert.doesNotMatch(scenes[2], /plinth/);
  assert.match(scenes[2], /class="avatar m-/);
});
