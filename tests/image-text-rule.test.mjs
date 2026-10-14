import test from 'node:test';
import assert from 'node:assert/strict';

import { IMAGE_TEXT_RULE_LINES } from '../server/utils/imageTextRule.js';
import { buildCarouselAssistSystemPrompt } from '../server/utils/carouselAssistGenerator.js';
import { buildPromptAssistSystemPrompt } from '../server/utils/promptAssistGenerator.js';

test('regle du texte dans les images : sans texte par defaut, texte seulement sur demande explicite, dans la langue demandee', () => {
  const rule = IMAGE_TEXT_RULE_LINES.join('\n');
  assert.match(rule, /AUCUN texte/);
  assert.match(rule, /UNIQUEMENT si le besoin le demande explicitement/);
  assert.match(rule, /texte EXACT a afficher entre guillemets/);
  assert.match(rule, /langue demandee/);
  assert.match(rule, /ne justifie PAS d en ajouter/, 'une consigne de langue seule n ajoute pas de texte');
});

test('slides de carrousel : la regle remplace l ancien "jamais de texte" et reste coherente d une slide a l autre', () => {
  const prompt = buildCarouselAssistSystemPrompt();
  for (const line of IMAGE_TEXT_RULE_LINES) assert.ok(prompt.includes(line), line.slice(0, 40));
  assert.ok(!prompt.includes('Pas de texte a incruster dans les images, pas de watermark.'));
  assert.match(prompt, /meme langue et le meme style de texte d une slide a l autre/);
  // Le reste du prompt est inchange (nombre de slides, JSON brut, persona).
  assert.match(prompt, /entre 2 et 10/);
  assert.match(prompt, /tableau JSON brut/);
  assert.match(buildCarouselAssistSystemPrompt({ personaDescription: 'Lea, 25 ans' }), /Lea, 25 ans/);
});

test('prompt libre : la regle ne vaut que pour une IMAGE ; la video garde son interdit de texte incruste', () => {
  const image = buildPromptAssistSystemPrompt({ mediaType: 'image' });
  for (const line of IMAGE_TEXT_RULE_LINES) assert.ok(image.includes(line), line.slice(0, 40));
  assert.ok(!image.includes('Pas de texte a incruster dans l image/la video'));
  // La mention "no text" de la photo de telephone devient conditionnelle.
  assert.match(image, /"no text" sauf si du texte est demande/);
  assert.ok(!image.includes('no on-screen controls, no text"'));

  const video = buildPromptAssistSystemPrompt({ mediaType: 'video' });
  assert.match(video, /Pas de texte a incruster dans la video, pas de watermark\./);
  assert.ok(!video.includes('AUCUN texte'));
});
