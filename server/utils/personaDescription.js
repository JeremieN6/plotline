import { getBodyBlock } from './injectBody.js';
import { INFLUENCER_IDENTITY_PROFILES } from './promptTemplates.js';

/**
 * Construit la variable `persona.description` des widgets Studio a partir des
 * champs structures du Profile: aucune generation ici, juste une phrase en
 * anglais assemblee depuis ce qui est reellement stocke en base.
 *
 * `identityProfile` ne couvre qu'une seule persona connue ("madison") via
 * INFLUENCER_IDENTITY_PROFILES: c'est un enrichissement optionnel, jamais une
 * dependance -- toute autre persona doit fonctionner sans lui, uniquement a
 * partir de ses propres champs (silhouette, bodyPrompt, hairPrompt, eyeColor,
 * ethnicity, particularities).
 */

function normalizeKey(value) {
  return String(value || '').trim().toLowerCase();
}

function matchIdentityProfile(identityProfile, name) {
  const explicitKey = normalizeKey(identityProfile);
  if (explicitKey && explicitKey !== 'default' && INFLUENCER_IDENTITY_PROFILES[explicitKey]) {
    return INFLUENCER_IDENTITY_PROFILES[explicitKey];
  }

  const normalizedName = normalizeKey(name);
  if (!normalizedName) return null;

  for (const profile of Object.values(INFLUENCER_IDENTITY_PROFILES)) {
    const aliases = Array.isArray(profile?.aliases) ? profile.aliases : [];
    if (aliases.map(normalizeKey).includes(normalizedName)) {
      return profile;
    }
  }

  return null;
}

export function buildPersonaDescription(profile = {}) {
  const name = String(profile?.name || '').trim();
  const chunks = [];

  const knownProfile = matchIdentityProfile(profile?.identityProfile, name);
  if (knownProfile?.description) {
    chunks.push(knownProfile.description);
  } else {
    chunks.push(name || 'the persona');
  }

  const eyeColor = String(profile?.eyeColor || '').trim();
  if (eyeColor) chunks.push(`${eyeColor} eyes`);

  const ethnicity = String(profile?.ethnicity || '').trim();
  if (ethnicity) chunks.push(`${ethnicity} ethnicity`);

  const bodyPrompt = String(profile?.bodyPrompt || '').trim();
  if (bodyPrompt) {
    chunks.push(bodyPrompt);
  } else {
    const bodyBlock = getBodyBlock(profile?.silhouette, profile?.gender);
    if (bodyBlock?.physique) chunks.push(bodyBlock.physique);
  }

  const hairPrompt = String(profile?.hairPrompt || '').trim();
  if (hairPrompt) chunks.push(hairPrompt);

  const particularities = String(profile?.particularities || '').trim();
  if (particularities) chunks.push(`distinguishing features: ${particularities}`);

  return chunks.filter(Boolean).join(', ');
}
