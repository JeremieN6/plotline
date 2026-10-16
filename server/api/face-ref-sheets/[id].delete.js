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

/** Supprime une fiche de la galerie (fichier et ligne). Les fiches deja appliquees a une persona sont des copies : rien ne casse. */
export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuthUser(event);
    const id = String(event.context?.params?.id || '').trim();
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Parametre id requis' });

    const sheet = await prisma.faceRefSheet.findFirst({ where: { id, userId: user.id }, select: { id: true, imageUrl: true } });
    if (!sheet) throw createError({ statusCode: 404, statusMessage: 'Fiche introuvable' });

    const { deleteGalleryImage } = await import('../../utils/faceRefGallery.js');
    await deleteGalleryImage(sheet.imageUrl);
    await prisma.faceRefSheet.delete({ where: { id: sheet.id } });
    return { success: true, id: sheet.id };
  } catch (error) {
    throw toHttpError(error);
  }
});
