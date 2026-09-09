import Anthropic from '@anthropic-ai/sdk';

/**
 * Transforme une idee libre (widget Studio "Video Scenario") en un couple
 * scene/script exploitable par le pipeline video. Contrairement au
 * planificateur editorial (planIdeaGenerator.js), il n y a pas de repli
 * deterministe sensible ici: sans article ni decor fixe a consulter, la scene
 * ET le texte parle sortent tous les deux de Claude. Un echec remonte donc
 * une erreur claire plutot qu un contenu invente localement.
 */

const DEFAULT_MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 1024;

function getAnthropicModel() {
  return String(process.env.ANTHROPIC_MODEL || DEFAULT_MODEL).trim() || DEFAULT_MODEL;
}

export function buildScenarioSystemPrompt() {
  return [
    'Tu transformes une idee de video en deux elements exploitables par un',
    'pipeline de generation video.',
    '',
    'Contraintes :',
    '- Le champ "scenePrompt" decrit la scene a generer : decor, cadrage,',
    '  ambiance. Concret et visuel, en anglais (les modeles video suivent',
    "  mieux l'anglais). Pas de texte a incruster, pas de dialogue dedans.",
    '- Le champ "scriptText" est le texte parle par le personnage a l ecran,',
    '  en francais, 15 a 25 mots, une seule phrase percutante, tutoiement,',
    '  adresse directe a la camera. Pas de guillemets, pas de didascalie.',
    '',
    'Reponds uniquement avec un objet JSON brut, sans markdown ni commentaire.',
    'Forme exacte : {"scenePrompt": string, "scriptText": string}',
  ].join('\n');
}

export function buildScenarioUserPrompt(idee) {
  return `Idee de video :\n${String(idee || '').trim()}`;
}

/**
 * Claude renvoie parfois le JSON entoure de texte ou d une cloture markdown,
 * malgre la consigne. On isole l objet plutot que d echouer sur un detail de
 * mise en forme (meme logique que parsePlanIdeas).
 */
export function parseScenarioScript(rawText) {
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

  const scenePrompt = String(parsed?.scenePrompt || '').trim();
  const scriptText = String(parsed?.scriptText || '').trim();

  return scenePrompt && scriptText ? { scenePrompt, scriptText } : null;
}

export async function generateScenarioScript({ idee, apiKey }) {
  const key = String(apiKey || process.env.ANTHROPIC_API_KEY || '').trim();
  const idea = String(idee || '').trim();

  if (!key) {
    throw new Error('ANTHROPIC_API_KEY non configuree');
  }

  if (!idea) {
    throw new Error('idee requise');
  }

  const anthropic = new Anthropic({ apiKey: key });
  const response = await anthropic.messages.create({
    model: getAnthropicModel(),
    max_tokens: MAX_TOKENS,
    system: buildScenarioSystemPrompt(),
    messages: [{ role: 'user', content: buildScenarioUserPrompt(idea) }],
  });

  const text = (response?.content || [])
    .filter((block) => block?.type === 'text')
    .map((block) => block.text)
    .join('\n');

  const result = parseScenarioScript(text);
  if (!result) {
    throw new Error('Claude n a pas renvoye de script exploitable');
  }

  return result;
}
