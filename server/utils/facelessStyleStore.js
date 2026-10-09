import { DEFAULT_PRESET } from '../data/facelessThemes.js';
import { defaultFacelessStyle, normalizeFacelessStyle } from './facelessStyle.js';

/**
 * Lecture / ecriture de la DA faceless d une persona (colonne Profile.facelessStyle).
 *
 * Tant que la colonne n existe pas en base (migration pas encore passee), les
 * lectures retombent sur la DA par defaut au lieu de planter : le format
 * faceless continue de fonctionner sans DA personnalisee.
 */

export const FACELESS_PERSONA_FIELDS = {
  id: true, name: true, niche: true, style: true, gender: true, description: true, targetAudience: true, faceRefPath: true,
};

/** Pur : DA effective d une persona a partir de ce qui est stocke (ou rien). */
export function resolveProfileStyle(persona, stored) {
  if (stored && typeof stored === 'object') return normalizeFacelessStyle(stored, { keepPack: true });
  return defaultFacelessStyle(DEFAULT_PRESET, persona?.gender === 'MALE' ? 'MALE' : 'FEMALE');
}

function isMissingColumnError(error) {
  const message = String(error?.message || '').toLowerCase();
  return error?.code === 'P2022' || message.includes('facelessstyle') || message.includes('unknown field') || message.includes('unknown argument');
}

/**
 * Persona du compte + sa DA. `null` si la persona n existe pas (ou n est pas au compte).
 * @returns {Promise<{ persona: object, style: object, stored: boolean } | null>}
 */
export async function loadPersonaStyle(prisma, profileId, userId) {
  let row;
  try {
    row = await prisma.profile.findFirst({ where: { id: profileId, userId }, select: { ...FACELESS_PERSONA_FIELDS, facelessStyle: true } });
  } catch (error) {
    if (!isMissingColumnError(error)) throw error;
    row = await prisma.profile.findFirst({ where: { id: profileId, userId }, select: FACELESS_PERSONA_FIELDS });
  }
  if (!row) return null;

  const { facelessStyle, ...persona } = row;
  return { persona, style: resolveProfileStyle(persona, facelessStyle), stored: Boolean(facelessStyle) };
}

export async function saveProfileStyle(prisma, profileId, style) {
  await prisma.profile.update({ where: { id: profileId }, data: { facelessStyle: style } });
  return style;
}

// Les ecritures du pack (plusieurs images generees en parallele) sont rangees
// par persona : chacune relit, modifie puis ecrit, jamais deux en meme temps.
const queues = new Map();

/**
 * Modifie la DA stockee de facon sure en concurrence.
 * `mutator(style)` renvoie la nouvelle DA (ou modifie et renvoie la meme).
 */
export function updateProfileStyle(prisma, profileId, userId, mutator) {
  const previous = queues.get(profileId) || Promise.resolve();
  const run = previous.catch(() => {}).then(async () => {
    const loaded = await loadPersonaStyle(prisma, profileId, userId);
    if (!loaded) throw new Error('Profil introuvable');
    const next = await mutator(loaded.style, loaded.persona);
    await saveProfileStyle(prisma, profileId, next);
    return next;
  });
  queues.set(profileId, run);
  return run;
}
