// Contenus restes en PROCESSING parce que le process qui les generait est mort
// (deploiement, crash) : une mort de process n est pas une exception JS, le
// `catch` qui consigne l echec ne s execute jamais.
//
// Prudence : la base Neon est partagee entre le poste de dev et la production,
// donc on ne touche qu aux contenus PROCESSING depuis longtemps ET sans aucun
// media (une regeneration d un contenu existant garde son ancien media, et son
// statut precedent est inconnu ici : on ne la modifie pas).

export const ORPHAN_MAX_AGE_MS = 45 * 60_000;

export const ORPHAN_ERROR_MESSAGE =
  'La generation a ete interrompue (redemarrage du serveur). Relance la video.';

export function orphanCutoff(now = new Date(), maxAgeMs = ORPHAN_MAX_AGE_MS) {
  return new Date(now.getTime() - maxAgeMs);
}

/** Marque FAILED les contenus bloques ; renvoie le nombre de contenus corriges. */
export async function sweepOrphanedGenerations(prisma, { now = new Date(), maxAgeMs = ORPHAN_MAX_AGE_MS } = {}) {
  const result = await prisma.generatedContent.updateMany({
    where: {
      status: 'PROCESSING',
      createdAt: { lt: orphanCutoff(now, maxAgeMs) },
      OR: [{ imageUrl: null }, { imageUrl: '' }],
    },
    data: { status: 'FAILED', errorMessage: ORPHAN_ERROR_MESSAGE },
  });
  return result.count;
}
