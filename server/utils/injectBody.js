import { COMMON_BODY_TEMPLATE, INFLUENCER_IDENTITY_PROFILES } from './promptTemplates.js';

const BODY_CUE_WORDS = [
  'slim',
  'slender',
  'petite',
  'thin',
  'skinny',
  'toned',
  'athletic',
  'lean',
  'small bust',
  'flat chest',
  'flat stomach',
  'curvy',
  'plus size',
  'voluptuous',
  'large frame',
  'small frame',
  'tiny waist',
  'showing off figure',
  'hourglass',
  'silhouette',
  'proportions',
  'measurements',
  'large breast',
  'big breast',
  'huge breast',
  'enormous breast',
  'large chest',
  'big chest',
  'full chest',
  'heavy chest',
  'cleavage',
  'busty',
  'buxom',
  'curvaceous',
  'wide hips',
  'full hips',
  'round hips',
  'big butt',
  'large butt',
  'round butt',
  'big glutes',
  'ample',
  'generously',
];

const BODY_STRIP_SKIP_KEYS = new Set(['body', 'face', 'description']);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function replaceTopGarmentInBody(bodyTemplate, topGarment) {
  const template = JSON.stringify(bodyTemplate);
  return JSON.parse(template.split('{top_garment}').join(topGarment));
}

function normalizeKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function appendUniqueNegativeConstraints(sceneJson, constraints) {
  if (!Array.isArray(constraints) || constraints.length === 0) {
    return;
  }

  if (!Array.isArray(sceneJson.negative_constraints)) {
    sceneJson.negative_constraints = [];
  }

  for (const constraint of constraints) {
    const normalized = String(constraint || '').trim();
    if (!normalized) continue;
    if (!sceneJson.negative_constraints.includes(normalized)) {
      sceneJson.negative_constraints.push(normalized);
    }
  }
}

function buildDefaultBodyInstruction(bodyTemplate) {
  const source = bodyTemplate && typeof bodyTemplate === 'object' ? bodyTemplate : COMMON_BODY_TEMPLATE;
  const fragments = [
    source?.physique,
    source?.anatomy?.waist,
    source?.anatomy?.hips,
    source?.anatomy?.breasts,
    source?.anatomy?.waist_to_hip_ratio,
  ]
    .map((value) => String(value || '').trim())
    .filter(Boolean);

  return fragments.join(' ');
}

function buildHairNegativeConstraints(hairInstruction) {
  const normalized = normalizeKey(hairInstruction);
  if (!normalized) {
    return [];
  }

  const constraints = [];
  const mentionsShortLength = normalized.includes('short')
    || normalized.includes('bob')
    || normalized.includes('shoulder')
    || normalized.includes('above shoulders')
    || normalized.includes('collarbone');

  if (mentionsShortLength) {
    constraints.push('no long hair');
    constraints.push('hair does not extend below the shoulders');
    constraints.push('no waist-length hair');
  }

  return constraints;
}

function stripBodyCues(text) {
  if (typeof text !== 'string') {
    return text;
  }

  let nextText = text;
  let lowered = nextText.toLowerCase();

  for (const word of BODY_CUE_WORDS) {
    if (!lowered.includes(word)) {
      continue;
    }

    nextText = nextText
      .replace(new RegExp(`[^,.]* ${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^,.]*[,.]?`, 'ig'), '')
      .trim()
      .replace(/^[,\s]+|[,\s]+$/g, '');
    lowered = nextText.toLowerCase();
  }

  return nextText.trim();
}

function deepStripBodyCues(value, parentKey = '') {
  if (BODY_STRIP_SKIP_KEYS.has(parentKey)) {
    return value;
  }

  if (typeof value === 'string') {
    return stripBodyCues(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => deepStripBodyCues(item));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [key, deepStripBodyCues(nestedValue, key)]),
    );
  }

  return value;
}

function resolveIdentityProfile(profileKey, influencerName) {
  const explicitKey = normalizeKey(profileKey);
  if (explicitKey && explicitKey !== 'default' && INFLUENCER_IDENTITY_PROFILES[explicitKey]) {
    return INFLUENCER_IDENTITY_PROFILES[explicitKey];
  }

  const normalizedName = normalizeKey(influencerName);
  if (!normalizedName) return null;

  for (const profile of Object.values(INFLUENCER_IDENTITY_PROFILES)) {
    const aliases = Array.isArray(profile?.aliases) ? profile.aliases : [];
    const normalizedAliases = aliases.map(normalizeKey).filter(Boolean);
    if (normalizedAliases.includes(normalizedName)) {
      return profile;
    }
  }

  return null;
}

export function sanitizePromptForSafety(prompt) {
  return String(prompt ?? '');
}

export function injectBody(sceneJson, options = {}) {
  const enriched = deepStripBodyCues(clone(sceneJson ?? {}));

  let topGarment = 'top garment';
  try {
    const subject = enriched.subject && typeof enriched.subject === 'object' ? enriched.subject : {};
    const wardrobe = subject.wardrobe && typeof subject.wardrobe === 'object' ? subject.wardrobe : {};

    let topRaw = wardrobe.top || wardrobe.top_garment || '';
    if (!topRaw) {
      const clothing = subject.clothing && typeof subject.clothing === 'object' ? subject.clothing : {};
      topRaw = clothing.outfit_description || clothing.top || '';
    }

    if (topRaw) {
      const part = String(topRaw).split(',')[0].split('.')[0].trim().toLowerCase();
      topGarment = part.length > 60 ? part.slice(0, 60) : part;
    }
  } catch {
    // Keep fallback topGarment value.
  }

  if (!enriched.subject || typeof enriched.subject !== 'object' || Array.isArray(enriched.subject)) {
    enriched.subject = {};
  }

  const fallbackBody = replaceTopGarmentInBody(COMMON_BODY_TEMPLATE, topGarment);
  const customBodyPrompt = String(options.bodyPrompt || '').trim();
  const finalBodyInstruction = customBodyPrompt || buildDefaultBodyInstruction(fallbackBody);

  enriched.subject.body = {
    ...fallbackBody,
    physique: finalBodyInstruction,
    custom_instruction: finalBodyInstruction,
    fallback_instruction: buildDefaultBodyInstruction(fallbackBody),
  };

  const identityProfile = resolveIdentityProfile(options.identityProfile, options.influencerName);
  if (identityProfile) {
    enriched.subject.description = identityProfile.description;
    enriched.subject.face = clone(identityProfile.face);
  } else {
    if (!enriched.subject.description) {
      enriched.subject.description = 'A woman matching the attached reference image.';
    }
    delete enriched.subject.face;
  }

  const hairPrompt = String(options.hairPrompt || '').trim();
  const hairAutoPrompt = String(options.hairAutoPrompt || '').trim();
  const hairLocked = options.hairLocked !== false;
  const finalHairInstruction = hairLocked ? (hairAutoPrompt || hairPrompt) : (hairPrompt || hairAutoPrompt);

  if (finalHairInstruction) {
    enriched.subject.hair = {
      description: finalHairInstruction,
      custom_instruction: finalHairInstruction,
      auto_instruction: hairAutoPrompt || hairPrompt,
      manual_instruction: hairPrompt,
      final_instruction: finalHairInstruction,
      locked: hairLocked,
    };

    appendUniqueNegativeConstraints(enriched, buildHairNegativeConstraints(finalHairInstruction));
  }

  return enriched;
}

// Python-compatible aliases
export const inject_madison_body = injectBody;
export const _sanitize_prompt_for_safety = sanitizePromptForSafety;
export { buildDefaultBodyInstruction };
