import { COMMON_BODY_TEMPLATE, INFLUENCER_IDENTITY_PROFILES } from './promptTemplates.js';

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
  const enriched = clone(sceneJson ?? {});

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

  enriched.subject.body = customBodyPrompt
    ? {
      ...fallbackBody,
      custom_instruction: customBodyPrompt,
      physique: customBodyPrompt,
    }
    : fallbackBody;

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

  return enriched;
}

// Python-compatible aliases
export const inject_madison_body = injectBody;
export const _sanitize_prompt_for_safety = sanitizePromptForSafety;
