import test from 'node:test';
import assert from 'node:assert/strict';

import { MAX_SOURCE_TEXT, buildFacelessPlanUserPrompt, normalizeSourceText } from '../server/utils/facelessPlanGenerator.js';

test('sans texte source : le message a Claude est strictement celui d avant', () => {
  assert.equal(buildFacelessPlanUserPrompt('3 idees de business'), 'Idee de la video :\n3 idees de business');
  assert.equal(buildFacelessPlanUserPrompt('x', ''), 'Idee de la video :\nx');
  assert.equal(buildFacelessPlanUserPrompt('x', '   \n  '), 'Idee de la video :\nx');
});

test('avec texte source : l article est fourni comme matiere, avec les consignes "une idee tranchee, pas un resume"', () => {
  const prompt = buildFacelessPlanUserPrompt('Angle : provocateur', 'Je ne laisse jamais une IA deployer.\n\nPas de prod sans relecture.');
  assert.ok(prompt.startsWith('Consigne de la video :\nAngle : provocateur'));
  assert.ok(prompt.includes('Je ne laisse jamais une IA deployer.'));
  assert.ok(prompt.includes('Ne fais PAS un resume fidele'));
  assert.ok(prompt.includes('UNE seule idee'));
  assert.ok(prompt.includes('sans precaution'));
  assert.ok(prompt.includes('n invente aucun fait'));
  assert.ok(prompt.includes('invitation a lire la suite'));
});

test('texte source sans consigne : Claude choisit l angle', () => {
  const prompt = buildFacelessPlanUserPrompt('', 'Un texte.');
  assert.ok(prompt.includes('aucune consigne : choisis toi-meme l angle le plus fort du texte'));
});

test('normalizeSourceText : retire le frontmatter, les images et les lignes vides en trop', () => {
  const article = '\uFEFF---\r\ntitle: "T"\r\nslug: t\r\n---\r\nPremier paragraphe.\r\n\r\n\r\n\r\n![schema](/img/a.png)\r\n\r\n## Titre\r\nSuite.';
  assert.equal(normalizeSourceText(article), 'Premier paragraphe.\n\n## Titre\nSuite.');
  assert.equal(normalizeSourceText(undefined), '');
  assert.equal(normalizeSourceText(null), '');
});

test('normalizeSourceText : ne tronque jamais (la route refuse un texte trop long au lieu de couper la conclusion)', () => {
  const long = 'Ж'.repeat(MAX_SOURCE_TEXT + 500);
  assert.equal(normalizeSourceText(long).length, MAX_SOURCE_TEXT + 500);
  // Le message a Claude, lui, ne depasse jamais le plafond.
  assert.ok(buildFacelessPlanUserPrompt('x', long).split('Ж').length - 1 === MAX_SOURCE_TEXT);
});

test('un article du blog tient dans la limite avec de la marge', () => {
  assert.ok(MAX_SOURCE_TEXT >= 10000);
});
