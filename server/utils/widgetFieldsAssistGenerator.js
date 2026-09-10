/**
 * Transforme une idee libre en valeurs pour les champs texte d'un widget
 * Studio, quel qu'il soit. Chaque champ (variable source: 'input') porte son
 * propre assistHint (server/data/widgets.js) : la consigne de contenu reste
 * propre a ce widget, seul le mecanisme de generation est generique. Meme
 * pattern que scenarioScriptGenerator.js : pas de repli deterministe, un
 * echec Claude remonte une erreur claire.
 */

import Anthropic from '@anthropic-ai/sdk';

const DEFAULT_MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 1536;

function getAnthropicModel() {
  return String(process.env.ANTHROPIC_MODEL || DEFAULT_MODEL).trim() || DEFAULT_MODEL;
}

function inputVariablesOf(widget) {
  return (widget?.variables || []).filter((item) => item?.source === 'input');
}

export function buildWidgetFieldsSystemPrompt({ widget, personaDescription } = {}) {
  const variables = inputVariablesOf(widget);

  const fieldLines = variables.map((variable) => {
    const label = variable.label || variable.key;
    const hint = variable.assistHint || 'contenu libre, coherent avec le champ.';
    return `- "${variable.key}" (${label}) : ${hint}`;
  });

  const lines = [
    `Tu remplis les champs du widget de generation "${widget?.nom || widget?.id}" pour`,
    "Plotline, a partir d'une idee ou d'un besoin exprime par l'utilisateur.",
    '',
    'Champs a remplir :',
    ...fieldLines,
    '',
    'Les champs doivent rester coherents entre eux (par exemple, un champ qui',
    'nomme une langue et un champ de texte parle doivent s accorder).',
  ];

  if (widget?.requiresPersona && personaDescription) {
    lines.push('', `Persona concerne, doit rester reconnaissable : ${personaDescription}.`);
  }

  if (widget?.negativePrompt) {
    lines.push('', `A eviter : ${widget.negativePrompt}.`);
  }

  lines.push(
    '',
    'Reponds uniquement avec un objet JSON brut, sans markdown ni commentaire.',
    `Forme exacte : {${variables.map((v) => `"${v.key}": string`).join(', ')}}`,
  );

  return lines.join('\n');
}

export function buildWidgetFieldsUserPrompt(idea) {
  return `Idee / besoin :\n${String(idea || '').trim()}`;
}

export function parseWidgetFieldsResult(rawText, expectedKeys) {
  const text = String(rawText || '').trim();
  if (!text || !Array.isArray(expectedKeys) || expectedKeys.length === 0) return null;

  const withoutFence = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  const start = withoutFence.indexOf('{');
  const end = withoutFence.lastIndexOf('}');
  const candidate = start !== -1 && end > start ? withoutFence.slice(start, end + 1) : withoutFence;

  let parsed;
  try {
    parsed = JSON.parse(candidate);
  } catch {
    return null;
  }

  const result = {};
  for (const key of expectedKeys) {
    const value = String(parsed?.[key] || '').trim();
    if (!value) return null;
    result[key] = value;
  }

  return result;
}

export async function generateWidgetFields({ widget, idea, personaDescription, apiKey }) {
  const key = String(apiKey || process.env.ANTHROPIC_API_KEY || '').trim();
  const trimmedIdea = String(idea || '').trim();
  const variables = inputVariablesOf(widget);

  if (!key) {
    throw new Error('ANTHROPIC_API_KEY non configuree');
  }
  if (!trimmedIdea) {
    throw new Error('idee requise');
  }
  if (variables.length === 0) {
    throw new Error('Ce widget n a aucun champ a remplir');
  }

  const anthropic = new Anthropic({ apiKey: key });
  const response = await anthropic.messages.create({
    model: getAnthropicModel(),
    max_tokens: MAX_TOKENS,
    system: buildWidgetFieldsSystemPrompt({ widget, personaDescription }),
    messages: [{ role: 'user', content: buildWidgetFieldsUserPrompt(trimmedIdea) }],
  });

  const text = (response?.content || [])
    .filter((block) => block?.type === 'text')
    .map((block) => block.text)
    .join('\n');

  const result = parseWidgetFieldsResult(text, variables.map((v) => v.key));
  if (!result) {
    throw new Error('Claude n a pas renvoye de champs exploitables');
  }

  return result;
}
