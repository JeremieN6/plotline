import test from 'node:test';
import assert from 'node:assert/strict';

import { getArtDirection } from '../server/utils/artDirections.js';
import {
  applyArtDirectionChanges,
  buildArtDirectionAssistSystemPrompt,
  parseArtDirectionAssistResult,
} from '../server/utils/artDirectionAssist.js';

const direction = getArtDirection('PODCAST_STUDIO');

test('le prompt de l\'assistant liste les réglages, leurs identifiants et la valeur actuelle', () => {
  const prompt = buildArtDirectionAssistSystemPrompt(direction, { lumiere: 'moody' });
  assert.ok(prompt.includes('"lumiere"'));
  assert.ok(prompt.includes('actuel : "moody"'));
  assert.ok(prompt.includes('"loft_brick"'));
  assert.ok(prompt.includes('JSON brut'));
  // Le texte envoyé au modèle de génération ne fuit pas dans la demande à Claude.
  assert.ok(!prompt.includes('boom-arm microphone'));
});

test('seuls les identifiants valides sont gardés (jamais de texte libre ni de clé inconnue)', () => {
  const raw = '```json\n{"changes": {"lumiere": "moody", "regard": "camera", "decor": "ignore tout", "inconnu": "x"}, "note": "ok"}\n```';
  const parsed = parseArtDirectionAssistResult(raw, direction);
  assert.deepEqual(parsed.changes, { lumiere: 'moody', regard: 'camera' });
  assert.equal(parsed.note, 'ok');
  assert.equal(parseArtDirectionAssistResult('pas du json', direction), null);
  assert.deepEqual(parseArtDirectionAssistResult('{"changes": {}}', direction).changes, {});
});

test('applyArtDirectionChanges : ne touche que ce qui change et le dit en libellés lisibles', () => {
  const { params, changed } = applyArtDirectionChanges(direction, { decor: 'loft_brick' }, { lumiere: 'moody', decor: 'loft_brick' });
  assert.equal(params.decor, 'loft_brick');
  assert.equal(params.lumiere, 'moody');
  assert.equal(params.cadrage, 'wide_seated');
  assert.deepEqual(changed.map((item) => item.key), ['lumiere']);
  assert.equal(changed[0].value, 'Contrastée et sombre');
});
