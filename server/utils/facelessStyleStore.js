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
 * Personnalite (facultative) d une persona du compte, lue dans une requete A PART.
 *
 * Volontairement separee de la lecture de la DA : si cette lecture echoue (colonne
 * absente, client Prisma plus ancien...), la DA n est ni lue differemment ni perdue,
 * et surtout jamais reecrite a partir d une lecture degradee (`updateProfileStyle`
 * relit puis REECRIT la DA entiere). L echec est journalise, jamais silencieux.
 * @returns {Promise<object|null>}
 */
async function loadPersonality(prisma, profileId, userId) {
  try {
    const row = await prisma.profile.findFirst({ where: { id: profileId, userId }, select: { personality: true } });
    return row?.personality || null;
  } catch (error) {
    console.warn('[faceless] personnalite indisponible : la persona sera traitee sans sa voix', {
      reason: String(error?.message || error).split('\n')[0].slice(0, 160),
    });
    return null;
  }
}

/**
 * Persona du compte + sa DA (+ sa personnalite, voir `loadPersonality`).
 * `null` si la persona n existe pas (ou n est pas au compte).
 *
 * La lecture de la DA est INCHANGEE. `withPersonality: false` saute la lecture de la
 * personnalite : obligatoire pour toute lecture suivie d une ecriture.
 * @returns {Promise<{ persona: object, style: object, stored: boolean } | null>}
 */
export async function loadPersonaStyle(prisma, profileId, userId, { withPersonality = true } = {}) {
  let row;
  try {
    row = await prisma.profile.findFirst({ where: { id: profileId, userId }, select: { ...FACELESS_PERSONA_FIELDS, facelessStyle: true } });
  } catch (error) {
    if (!isMissingColumnError(error)) throw error;
    row = await prisma.profile.findFirst({ where: { id: profileId, userId }, select: FACELESS_PERSONA_FIELDS });
  }
  if (!row) return null;

  const { facelessStyle, ...persona } = row;
  if (withPersonality) {
    const personality = await loadPersonality(prisma, profileId, userId);
    if (personality) persona.personality = personality;
  }
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
    // Lecture suivie d une ECRITURE de la DA : aucune lecture annexe (personnalite) ici.
    const loaded = await loadPersonaStyle(prisma, profileId, userId, { withPersonality: false });
    if (!loaded) throw new Error('Profil introuvable');
    const next = await mutator(loaded.style, loaded.persona);
    await saveProfileStyle(prisma, profileId, next);
    return next;
  });
  queues.set(profileId, run);
  return run;
}

/**
 * Toutes les personas du compte avec leur DA (pour la liste des dossiers).
 * Meme repli que `loadPersonaStyle` si la colonne n existe pas encore.
 */
export async function listPersonaStyles(prisma, userId) {
  let rows;
  try {
    rows = await prisma.profile.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      select: { ...FACELESS_PERSONA_FIELDS, profileType: true, facelessStyle: true },
    });
  } catch (error) {
    if (!isMissingColumnError(error)) throw error;
    rows = await prisma.profile.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      select: { ...FACELESS_PERSONA_FIELDS, profileType: true },
    });
  }
  return rows.map(({ facelessStyle, ...persona }) => ({ persona, style: resolveProfileStyle(persona, facelessStyle), stored: Boolean(facelessStyle) }));
}
