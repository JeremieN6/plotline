import test from 'node:test';
import assert from 'node:assert/strict';

import { autoHashtagsEnabled } from '../server/utils/hashtagPolicy.js';
import { buildPlanSystemPrompt } from '../server/utils/planIdeaGenerator.js';

test('hashtags automatiques : desactives par defaut, actives seulement par AUTO_HASHTAGS=true', () => {
  assert.equal(autoHashtagsEnabled({}), false);
  assert.equal(autoHashtagsEnabled({ AUTO_HASHTAGS: '' }), false);
  assert.equal(autoHashtagsEnabled({ AUTO_HASHTAGS: 'false' }), false);
  assert.equal(autoHashtagsEnabled({ AUTO_HASHTAGS: 'oui' }), false);
  assert.equal(autoHashtagsEnabled({ AUTO_HASHTAGS: ' TRUE ' }), true);
  assert.equal(autoHashtagsEnabled(null), false);
});

test('planificateur : sans hashtags, Claude laisse le champ vide et met les mots recherches dans la legende', () => {
  const profile = { name: 'Skinalyze' };
  const off = buildPlanSystemPrompt(profile, { hashtags: false });
  assert.match(off, /"hashtags" reste une chaine vide : aucun hashtag/);
  assert.ok(!off.includes('3 a 6 hashtags'));
  assert.ok(!/ecris seulement la legende et les hashtags/.test(off));
  assert.match(off, /ecris seulement la legende ;/);
  // Le format de reponse reste le meme (le champ existe, vide).
  assert.match(off, /"hashtags": string/);

  const on = buildPlanSystemPrompt(profile, { hashtags: true });
  assert.match(on, /3 a 6 hashtags/);
  assert.match(on, /ecris seulement la legende et les hashtags/);

  // Sans option : suit la politique (desactivee par defaut dans les tests).
  assert.equal(buildPlanSystemPrompt(profile), off);
});
