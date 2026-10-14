import test from 'node:test';
import assert from 'node:assert/strict';

import { getPromptPatternById } from '../server/data/promptPatterns.js';
import { WIDGETS } from '../server/data/widgets.js';
import {
  buildEffectiveWidget,
  getAutomatablePatternForWidget,
  isAutomatablePattern,
  listSelectablePatterns,
  resolvePatternForAccount,
} from '../server/utils/promptPatternSelector.js';
import { resolveWidgetPrompt } from '../server/utils/widgetEngine.js';

const PATTERN_ID = 'PORTRAIT_AVEC_ASSETS';
const widget = WIDGETS.find((item) => item.id === 'PORTRAIT_STUDIO');
const pattern = getPromptPatternById(PATTERN_ID);

test('recette PORTRAIT_AVEC_ASSETS : declaree sur le widget Portrait, image, experimentale', () => {
  assert.ok(pattern, 'la recette existe');
  assert.equal(pattern.widgetId, 'PORTRAIT_STUDIO');
  assert.equal(pattern.type, 'IMAGE');
  assert.equal(pattern.statut, 'experimental');
  assert.ok(pattern.limites && pattern.source);
});

test('recette : n utilise que des variables du widget (aucune {{...}} orpheline)', () => {
  const known = new Set(widget.variables.map((variable) => variable.key));
  const used = [...pattern.template.matchAll(/\{\{([^}]+)\}\}/g)].map((match) => match[1].trim());
  assert.ok(used.length >= 5);
  for (const key of used) assert.ok(known.has(key), `variable inconnue : ${key}`);
  for (const key of Object.keys(pattern.assistHintOverrides)) assert.ok(known.has(key), `consigne sur une variable inconnue : ${key}`);
});

test('recette : selectionnable par tous les comptes, jamais par la cadence', () => {
  for (const accountType of ['INFLUENCER_CREATOR', 'CONTENT_CREATOR', 'BRAND']) {
    assert.ok(listSelectablePatterns({ widgetId: 'PORTRAIT_STUDIO', accountType }).some((item) => item.id === PATTERN_ID), accountType);
    assert.ok(resolvePatternForAccount({ patternId: PATTERN_ID, widgetId: 'PORTRAIT_STUDIO', accountType }));
  }
  assert.equal(pattern.automatable, false);
  assert.equal(isAutomatablePattern(pattern), false);
  // La cadence garde son unique recette automatisable pour ce widget.
  assert.notEqual(getAutomatablePatternForWidget('PORTRAIT_STUDIO')?.id, PATTERN_ID);
  // Les autres widgets ne la voient pas.
  assert.ok(!listSelectablePatterns({ widgetId: 'FOOD_AD', accountType: 'INFLUENCER_CREATOR' }).some((item) => item.id === PATTERN_ID));
});

test('recette : prompt final avec des codes d assets, regles de reference et sans interface d appareil photo', () => {
  const effective = buildEffectiveWidget(widget, pattern);
  const { finalPrompt } = resolveWidgetPrompt(effective, {
    personaDescription: 'Madison, a woman in her late twenties with long blonde hair',
    inputs: {
      cadrage: 'full-length shot',
      tenue: 'a beige cropped jacket and light blue jeans',
      decor: 'walking from CAR_audi_rsq3_noir, parked in the driveway, toward the front door of HOUSE_maison_luxe',
      lumiere: 'warm late-afternoon sunlight',
      style_photo: 'candid lifestyle',
      aspect_ratio: '9:16',
    },
  });

  assert.ok(!finalPrompt.includes('{{'), 'aucune variable non substituee');
  assert.ok(finalPrompt.includes('CAR_audi_rsq3_noir') && finalPrompt.includes('HOUSE_maison_luxe'));
  assert.ok(finalPrompt.includes('face is turned toward the camera'));
  assert.ok(finalPrompt.includes('ONLY reference for its subject'));
  assert.ok(finalPrompt.includes('No camera interface, no UI overlay, no on-screen controls, no text.'));
  assert.ok(finalPrompt.includes('slight grain'));
  assert.ok(finalPrompt.includes('Avoid: ') && finalPrompt.includes('distorted or altered vehicle'));
  // Aucun pronom : la recette sert aussi pour un persona masculin.
  assert.ok(!/\b(she|her|he|his)\b/i.test(pattern.template));
});

test('recette : le widget de base et les autres recettes ne changent pas', () => {
  const before = JSON.stringify(widget);
  buildEffectiveWidget(widget, pattern);
  assert.equal(JSON.stringify(widget), before, 'le widget de base n est jamais modifie');
  const cozy = getPromptPatternById('PORTRAIT_COZY_HOME');
  assert.equal(cozy.automatable, true, 'PORTRAIT_COZY_HOME reste la recette automatisable');
});
