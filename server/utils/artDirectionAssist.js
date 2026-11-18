/**
 * Assistant « changer quelque chose » d'une direction artistique a parametres :
 * l'utilisateur ecrit une phrase (« lumiere plus sombre, il regarde la camera »),
 * Claude choisit les bonnes options parmi celles que la DA propose. Claude ne
 * renvoie QUE des identifiants d'options : le serveur les valide, jamais de texte
 * libre dans le prompt de generation video.
 */

import Anthropic from '@anthropic-ai/sdk';

import { normalizeArtDirectionParams } from './artDirections.js';

const DEFAULT_MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 512;
export const MAX_ART_REQUEST_LENGTH = 400;

function getAnthropicModel() {
  return String(process.env.ANTHROPIC_MODEL || DEFAULT_MODEL).trim() || DEFAULT_MODEL;
}

export function buildArtDirectionAssistSystemPrompt(direction, currentParams) {
  const current = normalizeArtDirectionParams(direction, currentParams);
  const lines = [
    `Tu regles la direction artistique "${direction.label}" d'une video parlee pour Plotline.`,
    "L'utilisateur decrit en une phrase ce qu'il veut changer. Tu choisis, parmi les options proposees, celles qui correspondent.",
    '',
    'Reglages disponibles (identifiant : libelle), avec la valeur actuelle :',
  ];
  for (const parameter of direction.parameters) {
    lines.push(`- "${parameter.key}" (${parameter.label}), actuel : "${current[parameter.key]}"`);
    for (const option of parameter.options) lines.push(`    "${option.id}" : ${option.label}`);
  }
  lines.push(
    '',
    "Regles : ne change QUE ce que la phrase demande, laisse tout le reste tel quel. N'invente jamais d'identifiant : utilise exactement ceux de la liste.",
    "Si une demande ne correspond a aucune option, ne change rien pour cet element et dis-le dans \"note\" (une phrase courte, en francais).",
    '',
    'Reponds uniquement avec un objet JSON brut, sans markdown ni commentaire.',
    'Forme exacte : {"changes": {"<cle du reglage>": "<identifiant de l\'option>"}, "note": string}',
  );
  return lines.join('\n');
}

/** Garde seulement les changements valides (cle connue ET identifiant d'option de cette cle). */
export function parseArtDirectionAssistResult(rawText, direction) {
  const text = String(rawText || '').trim();
  const withoutFence = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const start = withoutFence.indexOf('{');
  const end = withoutFence.lastIndexOf('}');
  const candidate = start !== -1 && end > start ? withoutFence.slice(start, end + 1) : withoutFence;

  let parsed;
  try {
    parsed = JSON.parse(candidate);
  } catch {
    return null;
  }

  const changes = {};
  for (const parameter of direction.parameters) {
    const wanted = String(parsed?.changes?.[parameter.key] || '').trim();
    if (wanted && parameter.options.some((option) => option.id === wanted)) {
      changes[parameter.key] = wanted;
    }
  }
  return { changes, note: String(parsed?.note || '').trim().slice(0, 240) };
}

/** Applique les changements sur les valeurs actuelles et dit ce qui a bouge (libelles lisibles). */
export function applyArtDirectionChanges(direction, currentParams, changes) {
  const before = normalizeArtDirectionParams(direction, currentParams);
  const params = { ...before };
  const changed = [];
  for (const parameter of direction.parameters) {
    const next = changes?.[parameter.key];
    if (next && next !== before[parameter.key]) {
      params[parameter.key] = next;
      changed.push({
        key: parameter.key,
        label: parameter.label,
        value: parameter.options.find((option) => option.id === next)?.label || next,
      });
    }
  }
  return { params, changed };
}

export async function generateArtDirectionChanges({ direction, request, currentParams, apiKey }) {
  const key = String(apiKey || process.env.ANTHROPIC_API_KEY || '').trim();
  const text = String(request || '').trim();
  if (!key) throw new Error('ANTHROPIC_API_KEY non configuree');
  if (!text) throw new Error('demande requise');
  if (!direction?.parameters?.length) throw new Error('Cette direction artistique n a aucun reglage');

  const anthropic = new Anthropic({ apiKey: key });
  const response = await anthropic.messages.create({
    model: getAnthropicModel(),
    max_tokens: MAX_TOKENS,
    system: buildArtDirectionAssistSystemPrompt(direction, currentParams),
    messages: [{ role: 'user', content: `Demande : ${text.slice(0, MAX_ART_REQUEST_LENGTH)}` }],
  });

  const output = (response?.content || [])
    .filter((block) => block?.type === 'text')
    .map((block) => block.text)
    .join('\n');

  const result = parseArtDirectionAssistResult(output, direction);
  if (!result) throw new Error('Claude n a pas renvoye de reglages exploitables');

  return { ...applyArtDirectionChanges(direction, currentParams, result.changes), note: result.note };
}
