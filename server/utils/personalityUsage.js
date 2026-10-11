/**
 * Consommation de tokens des appels Claude du generateur de personnalite (pur).
 *
 * Les tokens viennent de la reponse de l API (`usage.input_tokens` /
 * `usage.output_tokens`) : ils sont EXACTS. Le cout en dollars n est qu une
 * ESTIMATION : il depend d un tarif par million de tokens qui n est pas lu chez
 * le fournisseur. Il n est donc calcule que si le tarif est connu (variables
 * d environnement, ou tarif indicatif d une famille de modeles connue) ; sinon
 * `costUsd` vaut null plutot qu un chiffre invente.
 */

// Tarifs indicatifs en $ par million de tokens, a verifier sur la console Anthropic.
const KNOWN_PRICES = [
  { prefix: 'claude-sonnet', input: 3, output: 15 },
];

const DEFAULT_MODEL = 'claude-sonnet-4-6';

/**
 * Modele Claude du generateur de personnalite. `PERSONALITY_MODEL` (dediee)
 * permet d en changer sans toucher aux autres fonctions qui lisent la variable
 * partagee `ANTHROPIC_MODEL` (idees de plan, assistants de prompt, faceless...).
 * Sans variable dediee, comportement inchange.
 */
export function getPersonalityModel(env = process.env) {
  const dedicated = String(env?.PERSONALITY_MODEL || '').trim();
  if (dedicated) return dedicated;
  return String(env?.ANTHROPIC_MODEL || '').trim() || DEFAULT_MODEL;
}

export function emptyPersonalityUsage() {
  return { calls: 0, inputTokens: 0, outputTokens: 0 };
}

function toCount(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : 0;
}

/** Ajoute la consommation d UNE reponse de l API au cumul (renvoie un nouvel objet). */
export function addPersonalityUsage(total, responseUsage) {
  const base = total || emptyPersonalityUsage();
  return {
    calls: base.calls + 1,
    inputTokens: base.inputTokens + toCount(responseUsage?.input_tokens),
    outputTokens: base.outputTokens + toCount(responseUsage?.output_tokens),
  };
}

function readPrice(raw) {
  const number = Number(String(raw ?? '').replace(',', '.'));
  return Number.isFinite(number) && number > 0 ? number : null;
}

/**
 * Tarif ($ / million de tokens) pour un modele : variables d environnement en
 * priorite (`PERSONALITY_PRICE_INPUT_PER_MTOK` et `..._OUTPUT_PER_MTOK`), puis
 * tarif indicatif d une famille connue. Renvoie null si inconnu.
 */
export function resolvePersonalityPricing(model, env = process.env) {
  const input = readPrice(env?.PERSONALITY_PRICE_INPUT_PER_MTOK);
  const output = readPrice(env?.PERSONALITY_PRICE_OUTPUT_PER_MTOK);
  if (input !== null && output !== null) return { input, output, source: 'env' };

  const name = String(model || '').toLowerCase();
  const known = KNOWN_PRICES.find((entry) => name.startsWith(entry.prefix));
  return known ? { input: known.input, output: known.output, source: 'indicatif' } : null;
}

export function estimatePersonalityCostUsd(usage, pricing) {
  if (!usage || !pricing) return null;
  const cost = (usage.inputTokens * pricing.input + usage.outputTokens * pricing.output) / 1_000_000;
  return Math.round(cost * 10_000) / 10_000;
}

/** Forme renvoyee au client : tokens exacts, cout estime ou null. */
export function summarizePersonalityUsage(usage, model, env = process.env) {
  const safe = usage || emptyPersonalityUsage();
  const pricing = resolvePersonalityPricing(model, env);
  return {
    model: String(model || ''),
    calls: safe.calls,
    inputTokens: safe.inputTokens,
    outputTokens: safe.outputTokens,
    costUsd: estimatePersonalityCostUsd(safe, pricing),
    pricingSource: pricing ? pricing.source : null,
  };
}
