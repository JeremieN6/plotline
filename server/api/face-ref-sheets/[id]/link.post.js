import { createError } from 'h3';

import { requireAuthUser } from '../../../utils/auth.js';
import { isGalleryUnavailable } from '../../../utils/faceRefGallery.js';
import { prisma } from '../../../utils/prisma.js';

/**
 * Rattache une fiche de la galerie a une persona une fois qu elle lui a ete appliquee
 * (la galerie affiche alors son nom au lieu de « Sans persona »). La fiche et la persona
 * doivent appartenir au compte connecte ; rien d autre n est modifie.
 */
export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuthUser(event);
    const id = String(event.context?.params?.id || '').trim();
    const body = await readBody(event);
    const profileId = String(body?.profileId || '').trim();
    if (!id || !profileId) throw createError({ statusCode: 400, statusMessage: 'Fiche et persona requises' });

    const [sheet, profile] = await Promise.all([
      prisma.faceRefSheet.findFirst({ where: { id, userId: user.id }, select: { id: true } }),
      prisma.profile.findFirst({ where: { id: profileId, userId: user.id }, select: { id: true, name: true } }),
    ]);
    if (!sheet) throw createError({ statusCode: 404, statusMessage: 'Fiche introuvable' });
    if (!profile) throw createError({ statusCode: 404, statusMessage: 'Persona introuvable' });

    await prisma.faceRefSheet.update({ where: { id }, data: { profileId: profile.id } });
    return { linked: true, profileId: profile.id, profileName: profile.name };
  } catch (error) {
    if (error?.statusCode) throw error;
    if (isGalleryUnavailable(error)) {
      throw createError({ statusCode: 503, statusMessage: 'La galerie des fiches n\'est pas encore disponible' });
    }
    console.error('[face-ref-sheets:link] failure', { name: error?.name, message: error?.message });
    throw createError({ statusCode: 500, statusMessage: 'Rattachement de la fiche impossible' });
  }
});
