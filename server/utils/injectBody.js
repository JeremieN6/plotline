import { INFLUENCER_IDENTITY_PROFILES } from './promptTemplates.js';

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

const SILHOUETTE_TYPES = new Set(['SLIM', 'ATHLETIC', 'CURVY', 'VOLUPTUOUS']);

function normalizeKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function normalizeSilhouetteType(value) {
  const normalized = String(value || '').trim().toUpperCase();
  if (SILHOUETTE_TYPES.has(normalized)) {
    return normalized;
  }
  return 'VOLUPTUOUS';
}

export function getBodyBlock(silhouette = 'VOLUPTUOUS', topGarment = 'top garment') {
  const safeTopGarment = String(topGarment || 'top garment').trim() || 'top garment';
  const resolvedSilhouette = normalizeSilhouetteType(silhouette);

  if (resolvedSilhouette === 'SLIM') {
    return {
      physique: 'Slender and lean build, minimal curves, small bust (A-B cup), narrow waist and hips, long slim legs. Editorial and minimalist aesthetic.',
      anatomy: {
        shoulders: 'Slim, proportional shoulders.',
        waist: 'Narrow waist, clean lines.',
        hips: 'Narrow hips, subtle curves.',
        breasts: `Small bust (A-B cup), natural fit in the ${safeTopGarment}.`,
        waist_to_hip_ratio: 'Subtle waist definition.',
      },
    };
  }

  if (resolvedSilhouette === 'ATHLETIC') {
    return {
      physique: 'Athletic and toned build, defined muscles without bulk, moderate bust (B-C cup), narrow waist, firm glutes, long toned legs. Fit and active aesthetic.',
      anatomy: {
        shoulders: 'Athletic shoulders, defined and proportional.',
        waist: 'Narrow athletic waist.',
        hips: 'Balanced hips with firm glutes.',
        breasts: `Moderate bust (B-C cup), natural support in the ${safeTopGarment}.`,
        waist_to_hip_ratio: 'Athletic taper with balanced proportions.',
      },
    };
  }

  if (resolvedSilhouette === 'CURVY') {
    return {
      physique: 'Full figured with natural curves, soft hourglass shape, moderate bust (C-cup), defined waist, rounded hips and glutes. Feminine and natural.',
      anatomy: {
        shoulders: 'Soft, proportional shoulders.',
        waist: 'Defined feminine waist.',
        hips: 'Rounded hips and glutes.',
        breasts: `Moderate bust (C-cup), natural fullness in the ${safeTopGarment}.`,
        waist_to_hip_ratio: 'Soft hourglass.',
      },
    };
  }

  return {
    physique: `Voluptuous hourglass figure, large bust (DD-cup) filling the ${safeTopGarment}, narrow defined waist, wide hips, and rounded glutes.`,
    anatomy: {
      shoulders: 'Defined, proportional.',
      waist: 'Narrow, defined waist.',
      hips: 'Wide hips with rounded glutes.',
      breasts: `Large, very full bust (DD-cup) with visible cleavage shaping the ${safeTopGarment}.`,
      waist_to_hip_ratio: 'Pronounced hourglass.',
    },
  };
}

function buildDefaultBodyInstruction(bodyTemplate) {
  const source = bodyTemplate && typeof bodyTemplate === 'object'
    ? bodyTemplate
    : getBodyBlock('VOLUPTUOUS', 'top garment');
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

function extractHairToneConstraint(hairInstruction) {
  const normalized = normalizeKey(hairInstruction);
  if (!normalized) {
    return '';
  }

  const colorTokens = [
    'black',
    'dark brown',
    'brown',
    'light brown',
    'blonde',
    'dark blonde',
    'platinum blonde',
    'auburn',
    'red',
    'ginger',
    'silver',
    'grey',
    'gray',
    'white',
    'brunette',
  ];

  for (const token of colorTokens) {
    if (normalized.includes(token)) {
      return token;
    }
  }

  return '';
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

export function injectBody(sceneJson, silhouetteOrOptions = {}, maybeOptions = {}) {
  const options = typeof silhouetteOrOptions === 'string'
    ? { ...maybeOptions, silhouette: silhouetteOrOptions }
    : (silhouetteOrOptions && typeof silhouetteOrOptions === 'object' ? silhouetteOrOptions : {});
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

  const fallbackBody = getBodyBlock(options.silhouette, topGarment);
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
  const hairTone = extractHairToneConstraint(hairPrompt);

  if (hairPrompt) {
    const finalHairInstruction = hairTone
      ? `Preserve hair color from reference image (${hairTone}). Haircut, length, and styling must follow the target scene image.`
      : 'Preserve hair color from reference image. Haircut, length, and styling must follow the target scene image.';

    enriched.subject.hair = {
      description: finalHairInstruction,
      custom_instruction: finalHairInstruction,
      final_instruction: finalHairInstruction,
      reference_instruction: hairPrompt,
    };
  }

  return enriched;
}

// Python-compatible aliases
export const inject_madison_body = injectBody;
export const _sanitize_prompt_for_safety = sanitizePromptForSafety;
export { buildDefaultBodyInstruction };
