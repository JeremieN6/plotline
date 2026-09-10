/**
 * Chargement d'un persona (Profile) appartenant a un utilisateur, avec repli
 * de schema si la migration 20260903160000 (eyeColor/ethnicity/particularities)
 * n'est pas encore appliquee sur la base courante. Extrait de
 * server/api/widgets/resolve.post.js pour etre reutilise par les endpoints
 * d'assistance Claude (prompt-assist, fields-assist, carousel-assist).
 */

function isPrismaSchemaDriftError(err) {
  const message = String(err?.message || '').toLowerCase();
  return err?.code === 'P2022'
    || (message.includes('column') && message.includes('does not exist'))
    || message.includes('unknown arg')
    || message.includes('unknown argument')
    || message.includes('unknown field');
}

const FULL_SELECT = {
  id: true,
  userId: true,
  name: true,
  silhouette: true,
  gender: true,
  faceRefPath: true,
  bodyPrompt: true,
  hairPrompt: true,
  identityProfile: true,
  eyeColor: true,
  ethnicity: true,
  particularities: true,
};

const LEGACY_SELECT = {
  id: true,
  userId: true,
  name: true,
  silhouette: true,
  faceRefPath: true,
  bodyPrompt: true,
  hairPrompt: true,
  identityProfile: true,
};

export async function findPersonaCompatible(prisma, id, userId) {
  try {
    return await prisma.profile.findFirst({ where: { id, userId }, select: FULL_SELECT });
  } catch (err) {
    if (!isPrismaSchemaDriftError(err)) throw err;
    return prisma.profile.findFirst({ where: { id, userId }, select: LEGACY_SELECT });
  }
}
