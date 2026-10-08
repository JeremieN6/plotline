/**
 * Generation de la personnalite d un profil par Claude. Meme patron que
 * widgetFieldsAssistGenerator.js : sortie JSON brute parsee defensivement, un
 * seul appel, UNE nouvelle tentative si le JSON est inexploitable, jamais de
 * repli deterministe (un echec se relance simplement).
 *
 * Tout ce que l admin a saisi (ou qui vient d une colonne du profil) est une
 * contrainte non negociable ; les champs 'user' ou verrouilles ne sont jamais
 * redemandes ni ecrases.
 */

import Anthropic from '@anthropic-ai/sdk';

import { PERSONALITY_ANTI_PATTERNS } from '../data/personalityBlocks.js';
import {
  PLATFORM_BIO_FIELDS,
  collectProtectedFields,
  drawSeeds,
  fieldId,
  getKindBlocks,
  mergePersonality,
  normalizeEccentricity,
  normalizeFieldValue,
  normalizeKind,
  normalizePersonality,
  normalizeProvided,
} from './personality.js';

const DEFAULT_MODEL = 'claude-sonnet-4-6';
const REQUEST_TIMEOUT_MS = 90000;
const MAX_FREE_TEXT = 1500;
const ALL_PLATFORMS = Object.keys(PLATFORM_BIO_FIELDS);

const ECCENTRICITY_GUIDES = {
  1: 'crédible et proche de la niche demandée : un profil que l on croise vraiment, sans extravagance.',
  2: 'plutôt crédible, avec un ou deux détails inattendus.',
  3: 'équilibré : un profil crédible mais clairement atypique dans son parcours ou ses obsessions.',
  4: 'très atypique : parcours, obsessions et voix inhabituels, tout en restant plausibles.',
  5: 'franchement décalé : combinaisons improbables mais cohérentes, humour et singularité assumés.',
};

const KIND_LABELS = {
  PERSONA: 'persona (personnage fictif adulte)',
  BRAND: 'marque',
  ACTIVITY: 'activité',
};

export function createPersonalityError(message, { code = 'invalid', status = 502 } = {}) {
  const error = new Error(message);
  error.name = 'PersonalityGenerationError';
  error.code = code;
  error.status = status;
  return error;
}

export function isPersonalityError(error) {
  return error?.name === 'PersonalityGenerationError';
}

const AGE_RANGES = ['18 à 25 ans', '26 à 35 ans', '36 à 50 ans', '51 à 70 ans'];

export function drawAgeRange(rng = Math.random) {
  return AGE_RANGES[Math.min(AGE_RANGES.length - 1, Math.floor(rng() * AGE_RANGES.length))];
}

function getAnthropicModel() {
  return String(process.env.ANTHROPIC_MODEL || DEFAULT_MODEL).trim() || DEFAULT_MODEL;
}

function formatValue(value) {
  return Array.isArray(value) ? value.join(' | ') : String(value);
}

/** Champs a produire : non proteges, dans les blocs demandes, bios limitees aux plateformes choisies. */
export function selectTargetFields(kind, { onlyBlocks, platforms, protectedFields }) {
  const wantedPlatforms = (Array.isArray(platforms) && platforms.length ? platforms : ALL_PLATFORMS)
    .map((item) => String(item).toLowerCase());
  const skippedBios = new Set(
    Object.entries(PLATFORM_BIO_FIELDS)
      .filter(([platform]) => !wantedPlatforms.includes(platform))
      .map(([, fieldKey]) => fieldKey),
  );

  const targets = [];
  for (const block of getKindBlocks(kind)) {
    if (Array.isArray(onlyBlocks) && onlyBlocks.length && !onlyBlocks.includes(block.key)) continue;
    for (const field of block.fields) {
      if (protectedFields.has(fieldId(block.key, field.key))) continue;
      if (block.key === 'platforms' && skippedBios.has(field.key)) continue;
      targets.push({ block, field });
    }
  }
  return targets;
}

function describeField(field) {
  const limit = field.type === 'list'
    ? `liste de ${field.max} éléments maximum, ${field.itemMax} caractères maximum chacun`
    : field.type === 'number'
      ? `nombre${Number.isFinite(field.min) ? ` entre ${field.min} et ${field.max}` : ''}`
      : `${field.max} caractères maximum`;
  return `${field.label} [${field.type}, ${limit}${field.optional ? ', optionnel : chaîne vide autorisée' : ''}]`;
}

export function buildPersonalitySystemPrompt({
  kind,
  targets,
  fixed,
  context,
  seeds,
  eccentricity,
  language,
  freeText,
  ageRange = '',
}) {
  const lines = [
    `Tu construis l identité éditoriale d un profil Plotline de type ${KIND_LABELS[kind] || kind}.`,
    '',
    'Règles :',
    '- Du concret et du spécifique : un nom, un lieu, un détail vérifiable, jamais un adjectif générique ("passionné", "authentique", "inspirant").',
    '- Cohérence interne : le métier, l histoire, les goûts, les convictions et la voix doivent se tenir ensemble.',
    '- La personnalité vient d abord, le visage ensuite : l apparence est DÉDUITE de l histoire et du mode de vie, jamais l inverse. Ne déduis jamais l identité, le caractère ou les opinions d une apparence.',
    '- Personnages fictifs et adultes. Aucune personne réelle, aucune marque ni célébrité réelle. Aucun stéréotype sur un groupe de personnes ; les opinions restent hors politique et religion.',
    `- Évite ces profils saturés, sauf si une contrainte ci-dessous les impose : ${PERSONALITY_ANTI_PATTERNS.join(' ; ')}.`,
    `- Excentricité ${eccentricity}/5 : ${ECCENTRICITY_GUIDES[eccentricity]}`,
    `- Écris toutes les valeurs dans cette langue : ${language}. Les noms propres, lieux et pseudos restent plausibles pour le personnage.`,
    '- Évite les formules répétitives : pas de tournure type "Parle comme quelqu un qui…", pas de surnom suivi d une explication entre parenthèses, pas de bio construite sur "Métier. Lieu. Chiffre. Emoji". Un nombre précis n apparaît que s il est naturel, jamais un chiffre rond, jamais le même d un champ à l autre.',
    '- Ce que le personnage aime n est pas toujours un classement, une collection ou un inventaire chiffré : cherche aussi un rituel, une peur, un conflit, un talent inutile, un projet jamais fini.',
  ];

  if (ageRange) {
    lines.push(`- Âge : reste dans cette tranche indicative (${ageRange}), sauf si la description libre ou un champ imposé dit autre chose.`);
  }

  if (freeText) {
    lines.push('', `Description libre de l admin (contrainte forte) : ${freeText}`);
  }

  if (fixed.length) {
    lines.push('', 'Champs imposés (NON NÉGOCIABLES, ne les modifie pas, appuie-toi dessus) :');
    lines.push(...fixed.map((item) => `- ${item}`));
  }

  if (context.length) {
    lines.push('', 'Champs déjà écrits, à respecter pour rester cohérent :');
    lines.push(...context.map((item) => `- ${item}`));
  }

  const seedLines = Object.entries(seeds).map(([key, value]) => `- ${key} : ${value}`);
  if (seedLines.length) {
    lines.push(
      '',
      'Graines tirées (la direction est imposée, habille-la de façon cohérente, sans la contredire ni la citer mot pour mot si ce n est pas naturel) :',
      ...seedLines,
    );
  }

  lines.push('', 'Champs à produire, par bloc :');
  const byBlock = new Map();
  for (const { block, field } of targets) {
    if (!byBlock.has(block.key)) byBlock.set(block.key, { block, fields: [] });
    byBlock.get(block.key).fields.push(field);
  }
  for (const { block, fields } of byBlock.values()) {
    lines.push(`Bloc "${block.key}" (${block.label}) :`);
    for (const field of fields) {
      lines.push(`  - "${field.key}" — ${describeField(field)} : ${field.assistHint}`);
    }
  }

  const shape = [...byBlock.values()]
    .map(({ block, fields }) => `"${block.key}": {${fields.map((field) => `"${field.key}": ${field.type === 'list' ? 'string[]' : field.type === 'number' ? 'number' : 'string'}`).join(', ')}}`)
    .join(', ');

  lines.push(
    '',
    'Respecte STRICTEMENT les longueurs maximales (les bios de plateformes sont tronquées si elles dépassent).',
    'Réponds uniquement avec un objet JSON brut, sans markdown ni commentaire.',
    `Forme exacte : {${shape}}`,
  );

  return lines.join('\n');
}

/**
 * Extrait le JSON de la reponse et le valide contre les champs attendus.
 * Renvoie { blocks } au format de normalizePersonality (origin 'generated'), ou
 * null si la reponse est inexploitable.
 */
export function parsePersonalityResult(rawText, kind, targets) {
  const text = String(rawText || '').trim();
  if (!text || !targets.length) return null;

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
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;

  const blocks = {};
  let found = 0;
  let required = 0;

  for (const { block, field } of targets) {
    if (!field.optional) required += 1;
    const value = normalizeFieldValue(field, parsed?.[block.key]?.[field.key]);
    if (value === null) continue;
    blocks[block.key] = { ...(blocks[block.key] || {}), [field.key]: { value, origin: 'generated' } };
    found += 1;
  }

  // Une reponse qui ne couvre pas l essentiel des champs attendus est rejetee (nouvelle tentative).
  if (!found || found < Math.ceil(required * 0.6)) return null;
  return { blocks };
}

function mapAnthropicError(error) {
  if (isPersonalityError(error)) return error;
  const status = Number(error?.status);
  const message = String(error?.message || 'erreur inconnue');
  if (!status || status === 408 || status === 409 || status === 429 || status >= 500 || /timeout|connection|network/i.test(message)) {
    return createPersonalityError(`Anthropic est indisponible : ${message}`, { code: 'unavailable', status: 503 });
  }
  return createPersonalityError(`Appel Anthropic refusé (${status}) : ${message}`, { code: 'unavailable', status: 503 });
}

/**
 * Genere (ou complete) une personnalite et la renvoie fusionnee, SANS la sauvegarder.
 *
 * @param {object} input voir le brief, section 5.1
 * @param {{ client?: object, rng?: () => number }} deps injection pour les tests
 */
export async function generatePersonality(input = {}, deps = {}) {
  const kind = normalizeKind(input.kind) || 'PERSONA';
  const eccentricity = normalizeEccentricity(input.eccentricity);
  const language = String(input.language || 'fr').trim().slice(0, 40) || 'fr';
  const freeText = String(input.freeText || '').trim().slice(0, MAX_FREE_TEXT);
  const onlyBlocks = Array.isArray(input.onlyBlocks) ? input.onlyBlocks.map(String) : null;

  const known = new Set(getKindBlocks(kind).map((block) => block.key));
  if (onlyBlocks && onlyBlocks.some((key) => !known.has(key))) {
    throw createPersonalityError('Bloc inconnu pour ce type de profil', { code: 'bad_request', status: 400 });
  }

  const existing = normalizePersonality(input.existing, kind);
  const provided = normalizeProvided(input.provided, kind);
  const withProvided = mergePersonality(existing, null, provided, kind);
  const protectedFields = collectProtectedFields(withProvided);

  const targets = selectTargetFields(kind, { onlyBlocks, platforms: input.platforms, protectedFields });
  const targetIds = new Set(targets.map(({ block, field }) => fieldId(block.key, field.key)));

  const seeds = input.seedOverride && typeof input.seedOverride === 'object'
    ? normalizePersonality({ seeds: input.seedOverride }, kind).seeds
    : drawSeeds(kind, eccentricity, deps.rng || Math.random, { protectedFields, only: onlyBlocks });
  const allSeeds = { ...existing.seeds, ...seeds };

  if (!targets.length) {
    return { personality: { ...withProvided, eccentricity, seeds: allSeeds }, seeds: allSeeds, generated: 0 };
  }

  const apiKey = String(deps.apiKey || process.env.ANTHROPIC_API_KEY || '').trim();
  if (!deps.client && !apiKey) {
    throw createPersonalityError('ANTHROPIC_API_KEY non configurée', { code: 'config', status: 503 });
  }

  const fixed = [];
  const context = [];
  for (const block of getKindBlocks(kind)) {
    for (const field of block.fields) {
      const entry = withProvided.blocks[block.key]?.[field.key];
      if (!entry) continue;
      const line = `${block.key}.${field.key} (${field.label}) : ${formatValue(entry.value)}`;
      if (protectedFields.has(fieldId(block.key, field.key))) fixed.push(line);
      else if (!targetIds.has(fieldId(block.key, field.key))) context.push(line);
    }
  }

  const relevantSeeds = {};
  for (const [key, value] of Object.entries(allSeeds)) {
    const isTargetSeed = targets.some(({ field }) => field.key === key);
    const isContext = !onlyBlocks || onlyBlocks.includes('backstory');
    if (isTargetSeed || (isContext && ['lifeConstraints'].includes(key))) relevantSeeds[key] = value;
  }

  // Sans cette nudge, Claude retombe sur 40-50 ans : une tranche tiree au hasard
  // (adultes uniquement) casse ce biais. Indicative, jamais enregistree, jamais
  // appliquee si l age est deja saisi ou verrouille.
  const needsAge = targets.some(({ block, field }) => block.key === 'identity' && field.key === 'age');
  const ageRange = needsAge ? drawAgeRange(deps.rng || Math.random) : '';

  const system = buildPersonalitySystemPrompt({
    kind,
    targets,
    fixed,
    context,
    seeds: relevantSeeds,
    eccentricity,
    language,
    freeText,
    ageRange,
  });

  const client = deps.client || new Anthropic({ apiKey, timeout: REQUEST_TIMEOUT_MS, maxRetries: 1 });
  // Un bloc seul : court ; une moitie de personnalite (plusieurs blocs) : moyen ; tout : long.
  const maxTokens = !onlyBlocks ? 7000 : onlyBlocks.length > 1 ? 4500 : 2500;

  let result = null;
  for (let attempt = 0; attempt < 2 && !result; attempt += 1) {
    let response;
    try {
      response = await client.messages.create({
        model: getAnthropicModel(),
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content: 'Génère les champs demandés maintenant.' }],
      });
    } catch (error) {
      throw mapAnthropicError(error);
    }

    const text = (response?.content || [])
      .filter((block) => block?.type === 'text')
      .map((block) => block.text)
      .join('\n');
    result = parsePersonalityResult(text, kind, targets);
  }

  if (!result) {
    throw createPersonalityError('Claude n a pas renvoyé une personnalité exploitable. Réessaie.', { code: 'invalid', status: 502 });
  }

  const merged = mergePersonality(
    withProvided,
    { eccentricity, seeds: allSeeds, blocks: result.blocks },
    null,
    kind,
  );

  return {
    personality: merged,
    seeds: allSeeds,
    generated: Object.values(result.blocks).reduce((sum, fields) => sum + Object.keys(fields).length, 0),
  };
}
