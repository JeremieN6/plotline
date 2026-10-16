import { createError } from 'h3';

import { requireAuthUser } from '../../utils/auth.js';
import { isGalleryUnavailable } from '../../utils/faceRefGallery.js';
import { prisma } from '../../utils/prisma.js';

function toHttpError(error) {
  if (error?.statusCode) return error;
  if (isGalleryUnavailable(error)) {
    return createError({ statusCode: 503, statusMessage: 'La galerie des fiches n\'est pas encore disponible' });
  }
  console.error('[face-ref-sheets] failure', { name: error?.name, code: error?.code, message: error?.message });
  return createError({ statusCode: 500, statusMessage: 'Opération impossible sur la galerie des fiches' });
}

/**
 * Fiches de reference visage generees par le compte connecte, de la plus
 * recente a la plus ancienne. `?profileId=` filtre sur une persona.
 */
export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuthUser(event);
    const profileId = String(getQuery(event).profileId || '').trim();
    const { toGalleryEntry } = await import('../../utils/faceRefGallery.js');

    const rows = await prisma.faceRefSheet.findMany({
      where: { userId: user.id, ...(profileId ? { profileId } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true,
        imageUrl: true,
        method: true,
        profileId: true,
        createdAt: true,
        profile: { select: { name: true } },
      },
    });

    return { sheets: rows.map(toGalleryEntry) };
  } catch (error) {
    throw toHttpError(error);
  }
});
