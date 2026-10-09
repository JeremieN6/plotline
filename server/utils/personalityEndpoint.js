/**
 * Corps commun des endpoints admin de generation de personnalite : garde admin,
 * lecture du corps, profil optionnel (propriete par userId), appel du
 * generateur, traduction des erreurs. Les routes de server/api/admin/personality/
 * restent minces.
 */

import { createError } from 'h3';

import { requireAuthUser } from './auth.js';
import {
  PERSONALITY_MAX_BYTES,
  buildProfileConstraints,
  buildProvidedFromProfile,
  fieldId,
  getAdminGuardStatus,
  getKindBlocks,
  mergePersonality,
  normalizeKind,
  stripColumnFields,
} from './personality.js';
import { generatePersonality, isPersonalityError } from './personalityGenerator.js';

const PROFILE_COLUMNS = {
  id: true,
  name: true,
  niche: true,
  style: true,
  particularities: true,
  description: true,
  targetAudience: true,
  profileType: true,
  // Physique deja fige d un profil existant : transmis a Claude comme contraintes.
  gender: true,
  eyeColor: true,
  ethnicity: true,
  hairPrompt: true,
  faceRefPath: true,
};

export async function requireAdminUser(event) {
  const user = await requireAuthUser(event);
  if (getAdminGuardStatus(user) === 403) {
    throw createError({ statusCode: 403, statusMessage: 'Reserve aux comptes administrateur' });
  }
  return user;
}

function assertSize(value, label) {
  if (value === undefined || value === null) return;
  if (JSON.stringify(value).length > PERSONALITY_MAX_BYTES) {
    throw createError({ statusCode: 413, statusMessage: `${label} trop volumineux (32 Ko maximum)` });
  }
}

async function getPrisma() {
  const module = await import('./prisma.js');
  const client = module?.prisma || module?.default?.prisma;
  if (!client) throw new Error('Unable to resolve prisma client from server/utils/prisma.js');
  return client;
}

/** Valeurs saisies a la main, avec par-dessus les champs relies a une colonne du profil (la colonne fait foi). */
function mergeProvided(typed, fromColumns) {
  const result = {};
  const source = typed && typeof typed === 'object' && !Array.isArray(typed) ? typed : {};
  for (const [blockKey, fields] of Object.entries(source)) {
    if (fields && typeof fields === 'object' && !Array.isArray(fields)) result[blockKey] = { ...fields };
  }
  for (const [blockKey, fields] of Object.entries(fromColumns)) {
    result[blockKey] = { ...(result[blockKey] || {}), ...fields };
  }
  return result;
}

export function toHttpError(error) {
  if (error?.statusCode) return error;
  if (isPersonalityError(error)) {
    return createError({
      statusCode: error.status,
      statusMessage: error.message,
      data: { code: error.code },
    });
  }
  console.error('[personality] failure', { name: error?.name, message: error?.message });
  return createError({ statusCode: 500, statusMessage: 'Generation de la personnalite impossible' });
}

async function findOwnedProfile(event, user) {
  const profileId = String(event.context?.params?.id || '').trim();
  if (!profileId) {
    throw createError({ statusCode: 400, statusMessage: 'Parametre id requis' });
  }
  const prisma = await getPrisma();
  const profile = await prisma.profile.findFirst({
    where: { id: profileId, userId: user.id },
    select: { ...PROFILE_COLUMNS, personality: true },
  });
  if (!profile) {
    throw createError({ statusCode: 404, statusMessage: 'Profil introuvable' });
  }
  return { prisma, profile };
}

/**
 * Personnalite enregistree d un profil, avec par-dessus les champs relies aux
 * colonnes du profil (lecture seule : la colonne fait foi).
 */
export async function handleGetProfilePersonality(event) {
  const user = await requireAdminUser(event);
  const { profile } = await findOwnedProfile(event, user);
  const kind = normalizeKind(profile.profileType) || 'PERSONA';
  const fromColumns = buildProvidedFromProfile(profile, kind);

  return {
    kind,
    hasStored: Boolean(profile.personality),
    personality: mergePersonality(profile.personality || null, null, fromColumns, kind),
    readOnlyFields: Object.entries(fromColumns).flatMap(([blockKey, fields]) =>
      Object.keys(fields).map((fieldKey) => fieldId(blockKey, fieldKey))),
  };
}

/** Enregistre la personnalite (normalisee, sans les champs portes par une colonne). */
export async function handlePutProfilePersonality(event) {
  const user = await requireAdminUser(event);
  const body = await readBody(event);
  if (!body || typeof body !== 'object' || Array.isArray(body) || !body.personality || typeof body.personality !== 'object') {
    throw createError({ statusCode: 400, statusMessage: 'Corps de requete invalide : personality requis' });
  }
  assertSize(body.personality, 'La personnalite');

  const { prisma, profile } = await findOwnedProfile(event, user);
  const kind = normalizeKind(profile.profileType) || 'PERSONA';
  const toStore = stripColumnFields(body.personality, kind);
  toStore.updatedAt = new Date().toISOString();

  await prisma.profile.update({ where: { id: profile.id }, data: { personality: toStore } });
  return { saved: true, updatedAt: toStore.updatedAt };
}

/**
 * @param {import('h3').H3Event} event
 * @param {{ blockOnly?: boolean }} options `blockOnly` : regeneration d un seul bloc
 */
export async function handlePersonalityGeneration(event, { blockOnly = false } = {}) {
  await requireAdminUser(event);
  const body = await readBody(event);
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw createError({ statusCode: 400, statusMessage: 'Corps de requete invalide' });
  }

  assertSize(body.personality, 'La personnalite');
  assertSize(body.provided, 'Les champs saisis');

  let profile = null;
  const profileId = String(body.profileId || '').trim();
  if (profileId) {
    const user = await requireAuthUser(event);
    const prisma = await getPrisma();
    profile = await prisma.profile.findFirst({ where: { id: profileId, userId: user.id }, select: PROFILE_COLUMNS });
    if (!profile) {
      throw createError({ statusCode: 404, statusMessage: 'Profil introuvable' });
    }
  }

  const kind = normalizeKind(body.kind) || normalizeKind(profile?.profileType) || 'PERSONA';
  const fromColumns = profile ? buildProvidedFromProfile(profile, kind) : {};

  let onlyBlocks = Array.isArray(body.onlyBlocks) ? body.onlyBlocks : null;
  if (blockOnly) {
    const blockKey = String(body.blockKey || '').trim();
    if (!getKindBlocks(kind).some((block) => block.key === blockKey)) {
      throw createError({ statusCode: 400, statusMessage: 'blockKey invalide pour ce type de profil' });
    }
    onlyBlocks = [blockKey];
  }

  const result = await generatePersonality({
    kind,
    existing: body.personality,
    provided: mergeProvided(body.provided, fromColumns),
    freeText: body.freeText,
    eccentricity: body.eccentricity,
    platforms: body.platforms,
    language: body.language,
    onlyBlocks,
    onlyEmpty: !blockOnly && body.onlyEmpty === true,
    profileConstraints: buildProfileConstraints(profile),
    seedOverride: body.seedOverride,
  });

  return {
    kind,
    personality: result.personality,
    seeds: result.seeds,
    generated: result.generated,
    // Champs dont la colonne du profil fait foi : a afficher en lecture seule.
    readOnlyFields: Object.entries(fromColumns).flatMap(([blockKey, fields]) =>
      Object.keys(fields).map((fieldKey) => fieldId(blockKey, fieldKey))),
  };
}
