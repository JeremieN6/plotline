import test from 'node:test';
import assert from 'node:assert/strict';

import { TEXT_STYLE_PROMPT_LINES, stripDashPunctuation } from '../server/utils/textStyleRules.js';
import { buildFacelessPlanSystemPrompt, sanitizeFacelessPlan, sanitizeFacelessScene } from '../server/utils/facelessPlanGenerator.js';
import { buildOutlineSystemPrompt } from '../server/utils/facelessOutline.js';
import { parseBrandCaption } from '../server/utils/brandCaption.js';

test('stripDashPunctuation : tirets de ponctuation remplaces par une virgule, mots composes intacts', () => {
  assert.equal(stripDashPunctuation('T\'as optimisé ton message — et ta prospection a foiré.'), 'T\'as optimisé ton message, et ta prospection a foiré.');
  assert.equal(stripDashPunctuation('SPF, DKIM, DMARC — pas configurés'), 'SPF, DKIM, DMARC, pas configurés');
  assert.equal(stripDashPunctuation('un test - puis un autre'), 'un test, puis un autre');
  assert.equal(stripDashPunctuation('de 5 – 10 minutes'), 'de 5, 10 minutes');
  assert.equal(stripDashPunctuation('vingt-deux leads, c\'est-à-dire abonne-toi'), 'vingt-deux leads, c\'est-à-dire abonne-toi');
  assert.equal(stripDashPunctuation('Fin. — Début'), 'Fin. Début');
  assert.equal(stripDashPunctuation('Attention —'), 'Attention');
  assert.equal(stripDashPunctuation('— Salut'), 'Salut');
  assert.equal(stripDashPunctuation('- une puce\n- une autre'), 'une puce\nune autre');
  assert.equal(stripDashPunctuation('a —— b'), 'a, b');
  assert.equal(stripDashPunctuation(''), '');
  assert.equal(stripDashPunctuation(null), '');
});

test('prompts : chiffres en chiffres et pas de tiret, dans le plan faceless, la trame et les legendes', () => {
  const rule = TEXT_STYLE_PROMPT_LINES.join('\n');
  assert.match(rule, /TOUJOURS en chiffres/);
  assert.match(rule, /JAMAIS de tiret/);
  assert.ok(buildFacelessPlanSystemPrompt({}).includes(TEXT_STYLE_PROMPT_LINES[0]));
  assert.ok(buildFacelessPlanSystemPrompt({}).includes(TEXT_STYLE_PROMPT_LINES[1]));
  assert.equal(buildFacelessPlanSystemPrompt({}).includes('comme on les prononce'), false);
  assert.ok(buildOutlineSystemPrompt({}).includes(TEXT_STYLE_PROMPT_LINES[1]));
});

test('plan faceless : les tirets de ponctuation sont retires du script, des cartes, du titre et de la legende', () => {
  const scene = sanitizeFacelessScene({
    say: 'Ma première vague — 22 leads, 11 % d\'ouverture.',
    layout: 'title',
    title: 'Le vrai — problème',
    text: '22 leads — 11 %',
    items: [],
  });
  assert.equal(scene.say, 'Ma première vague, 22 leads, 11 % d\'ouverture.');
  assert.equal(scene.title, 'Le vrai, problème');
  assert.equal(scene.text, '22 leads, 11 %');

  const plan = sanitizeFacelessPlan({
    title: 'Un titre — long',
    caption: 'Une idée — et une autre.',
    scenes: [{ say: 'Une phrase — deux.', layout: 'avatar', text: 'a' }, { say: 'Autre phrase.', layout: 'avatar', text: 'b' }],
  });
  assert.equal(plan.title, 'Un titre, long');
  assert.equal(plan.caption, 'Une idée, et une autre.');
  assert.equal(plan.scenes[0].say, 'Une phrase, deux.');
});

test('legende de marque : tiret de ponctuation retire', () => {
  const parsed = parseBrandCaption('{"caption": "Analysez la peau — en 2 minutes."}');
  assert.equal(parsed.caption, 'Analysez la peau, en 2 minutes.');
});
