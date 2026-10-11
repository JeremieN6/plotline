import test from 'node:test';
import assert from 'node:assert/strict';

import { PERSONALITY_BLOCKS } from '../server/data/personalityBlocks.js';
import { createSeededRng } from '../server/utils/personality.js';
import { generatePersonality, isPersonalityError } from '../server/utils/personalityGenerator.js';
import {
  addPersonalityUsage,
  emptyPersonalityUsage,
  estimatePersonalityCostUsd,
  getPersonalityModel,
  resolvePersonalityPricing,
  summarizePersonalityUsage,
} from '../server/utils/personalityUsage.js';

function fullResponse(kind = 'PERSONA') {
  const out = {};
  for (const block of PERSONALITY_BLOCKS[kind]) {
    out[block.key] = {};
    for (const field of block.fields) {
      out[block.key][field.key] = field.type === 'list' ? [`${field.key} un`] : field.type === 'number' ? 41 : `valeur ${field.key}`;
    }
  }
  return JSON.stringify(out);
}

/** Client simule renvoyant, pour chaque appel, un texte et une consommation. */
function usageClient(...steps) {
  const calls = [];
  const queue = [...steps];
  return {
    calls,
    messages: {
      async create(params) {
        calls.push(params);
        const next = queue.shift();
        if (next instanceof Error) throw next;
        return { content: [{ type: 'text', text: next.text }], usage: next.usage };
      },
    },
  };
}

// --- Fonctions pures ---------------------------------------------------------

test('addPersonalityUsage : cumule les appels, ignore les valeurs absentes ou invalides', () => {
  let total = emptyPersonalityUsage();
  total = addPersonalityUsage(total, { input_tokens: 3000, output_tokens: 5000 });
  total = addPersonalityUsage(total, { input_tokens: 'abc', output_tokens: -4 });
  total = addPersonalityUsage(total, undefined);
  assert.deepEqual(total, { calls: 3, inputTokens: 3000, outputTokens: 5000 });
});

test('estimation du coût : tarif connu, tarif en variables, ou null sans tarif', () => {
  const usage = { calls: 2, inputTokens: 4000, outputTokens: 6000 };

  // Famille connue : 3 $ / 15 $ par million -> 0,012 + 0,09 = 0,102
  assert.equal(estimatePersonalityCostUsd(usage, resolvePersonalityPricing('claude-sonnet-4-6', {})), 0.102);

  // Variables d environnement : prioritaires, y compris pour un modele inconnu.
  const env = { PERSONALITY_PRICE_INPUT_PER_MTOK: '1', PERSONALITY_PRICE_OUTPUT_PER_MTOK: '5' };
  const pricing = resolvePersonalityPricing('claude-haiku-9', env);
  assert.equal(pricing.source, 'env');
  assert.equal(estimatePersonalityCostUsd(usage, pricing), 0.034);

  // Modele inconnu sans tarif : aucun chiffre invente.
  assert.equal(resolvePersonalityPricing('un-autre-modele', {}), null);
  const summary = summarizePersonalityUsage(usage, 'un-autre-modele', {});
  assert.equal(summary.costUsd, null);
  assert.equal(summary.inputTokens, 4000);
  assert.equal(summary.pricingSource, null);

  // Un seul des deux tarifs fourni : ignore (jamais de moitie de tarif).
  assert.equal(resolvePersonalityPricing('un-autre-modele', { PERSONALITY_PRICE_INPUT_PER_MTOK: '1' }), null);
});

// --- Generateur --------------------------------------------------------------

test('generatePersonality renvoie la consommation exacte de l API et le modèle utilisé', async () => {
  const client = usageClient({ text: fullResponse(), usage: { input_tokens: 3200, output_tokens: 5400 } });
  const result = await generatePersonality({ kind: 'PERSONA' }, { client, rng: createSeededRng(3) });
  assert.equal(result.usage.calls, 1);
  assert.equal(result.usage.inputTokens, 3200);
  assert.equal(result.usage.outputTokens, 5400);
  assert.equal(result.usage.model, client.calls[0].model);
});

test('une relance sur JSON invalide est comptée : deux appels facturés', async () => {
  const client = usageClient(
    { text: 'pas du json', usage: { input_tokens: 3000, output_tokens: 700 } },
    { text: fullResponse(), usage: { input_tokens: 3000, output_tokens: 5000 } },
  );
  const result = await generatePersonality({ kind: 'PERSONA' }, { client, rng: createSeededRng(4) });
  assert.equal(result.usage.calls, 2);
  assert.equal(result.usage.inputTokens, 6000);
  assert.equal(result.usage.outputTokens, 5700);
});

test('un échec définitif garde la consommation déjà facturée sur l erreur', async () => {
  const client = usageClient(
    { text: 'invalide', usage: { input_tokens: 2500, output_tokens: 300 } },
    { text: 'toujours invalide', usage: { input_tokens: 2500, output_tokens: 320 } },
  );
  await assert.rejects(
    () => generatePersonality({ kind: 'PERSONA' }, { client, rng: createSeededRng(5) }),
    (error) => {
      assert.ok(isPersonalityError(error));
      assert.equal(error.usage.calls, 2);
      assert.equal(error.usage.inputTokens, 5000);
      assert.equal(error.usage.outputTokens, 620);
      return true;
    },
  );
});

test('rien à générer : aucun appel, consommation nulle', async () => {
  const full = JSON.parse(fullResponse());
  const filled = { kind: 'PERSONA', blocks: {} };
  for (const [blockKey, fields] of Object.entries(full)) {
    filled.blocks[blockKey] = Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, { value, origin: 'generated' }]));
  }
  const client = usageClient();
  const result = await generatePersonality({ kind: 'PERSONA', existing: filled, onlyEmpty: true }, { client });
  assert.equal(client.calls.length, 0);
  assert.equal(result.usage.calls, 0);
  assert.equal(result.usage.inputTokens, 0);
});

test('getPersonalityModel : variable dédiée, sinon ANTHROPIC_MODEL, sinon le défaut', () => {
  assert.equal(getPersonalityModel({}), 'claude-sonnet-4-6');
  assert.equal(getPersonalityModel({ ANTHROPIC_MODEL: 'modele-global' }), 'modele-global');
  assert.equal(getPersonalityModel({ ANTHROPIC_MODEL: 'modele-global', PERSONALITY_MODEL: 'modele-dedie' }), 'modele-dedie');
  assert.equal(getPersonalityModel({ ANTHROPIC_MODEL: 'modele-global', PERSONALITY_MODEL: '   ' }), 'modele-global');
});
