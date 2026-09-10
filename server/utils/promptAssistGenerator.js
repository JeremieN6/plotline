/**
 * Transforme une idee libre en prompt de generation detaille, pour le flux
 * "Prompt libre" (image ou video) du Studio. Meme pattern que
 * scenarioScriptGenerator.js : pas de repli deterministe, un echec Claude
 * remonte une erreur claire plutot qu'un contenu invente localement.
 */

import Anthropic from '@anthropic-ai/sdk';

const DEFAULT_MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 1024;

function getAnthropicModel() {
  return String(process.env.ANTHROPIC_MODEL || DEFAULT_MODEL).trim() || DEFAULT_MODEL;
}

export function buildPromptAssistSystemPrompt({ mediaType, personaDescription, identityLocked } = {}) {
  const kind = mediaType === 'video' ? 'video' : 'image';
  const lines = [
    `Tu ecris un prompt de generation ${kind} photorealiste pour Plotline, a`,
    "partir d'une idee ou d'un besoin exprime par l'utilisateur.",
    '',
    'Contraintes :',
    '- Reponse en anglais, concrete et visuelle : sujet, cadrage, decor,',
    '  lumiere, ambiance. Les modeles de generation suivent mieux l anglais.',
    '- Pas de texte a incruster dans l image/la video, pas de watermark.',
  ];

  if (kind === 'video') {
    lines.push('- Decris le mouvement de camera et l enchainement des plans si pertinent.');
  }

  if (identityLocked && personaDescription) {
    lines.push(
      `- Le persona suivant doit rester reconnaissable, aucun changement d identite : ${personaDescription}.`,
    );
  } else {
    lines.push('- Aucune contrainte d identite : invente librement qui apparait a l ecran si besoin.');
  }

  lines.push(
    '',
    'Reponds uniquement avec un objet JSON brut, sans markdown ni commentaire.',
    'Forme exacte : {"prompt": string}',
  );

  return lines.join('\n');
}

export function buildPromptAssistUserPrompt(idea) {
  return `Idee / besoin :\n${String(idea || '').trim()}`;
}

export function parsePromptAssistResult(rawText) {
  const text = String(rawText || '').trim();
  if (!text) return null;

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

  const prompt = String(parsed?.prompt || '').trim();
  return prompt ? { prompt } : null;
}

export async function generateAssistedPrompt({ idea, mediaType, personaDescription, identityLocked, apiKey }) {
  const key = String(apiKey || process.env.ANTHROPIC_API_KEY || '').trim();
  const trimmedIdea = String(idea || '').trim();

  if (!key) {
    throw new Error('ANTHROPIC_API_KEY non configuree');
  }
  if (!trimmedIdea) {
    throw new Error('idee requise');
  }

  const anthropic = new Anthropic({ apiKey: key });
  const response = await anthropic.messages.create({
    model: getAnthropicModel(),
    max_tokens: MAX_TOKENS,
    system: buildPromptAssistSystemPrompt({ mediaType, personaDescription, identityLocked }),
    messages: [{ role: 'user', content: buildPromptAssistUserPrompt(trimmedIdea) }],
  });

  const text = (response?.content || [])
    .filter((block) => block?.type === 'text')
    .map((block) => block.text)
    .join('\n');

  const result = parsePromptAssistResult(text);
  if (!result) {
    throw new Error('Claude n a pas renvoye de prompt exploitable');
  }

  return result;
}
