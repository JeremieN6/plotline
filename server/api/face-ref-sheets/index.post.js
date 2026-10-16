import { createError, readMultipartFormData } from 'h3';

import { requireAuthUser } from '../../utils/auth.js';
import { isGalleryUnavailable, storeGalleryImage, deleteGalleryImage, toGalleryEntry } from '../../utils/faceRefGallery.js';
import { prisma } from '../../utils/prisma.js';
import { readImagePart, readTextField } from '../../utils/referenceAssetStorage.js';

/**
 * Importe une fiche existante dans la galerie (gratuit) : une fiche generee
 * ailleurs, ou retrouvee. Multipart : `file` (JPG/PNG verifie par signature,
 * 10 Mo max), `profileId` optionnel (persona du compte).
 */
export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuthUser(event);
    const formData = await readMultipartFormData(event);
    const image = readImagePart(formData);

    let profileId = readTextField(formData, 'profileId');
    let profileName = null;
    if (profileId) {
      const owned = await prisma.profile.findFirst({ where: { id: profileId, userId: user.id }, select: { id: true, name: true } });
      if (!owned) throw createError({ statusCode: 404, statusMessage: 'Profil introuvable' });
      profileId = owned.id;
      profileName = owned.name;
    }

    const imageUrl = await storeGalleryImage(user.id, image.buffer, { extension: image.extension, mime: image.mime });
    try {
      const row = await prisma.faceRefSheet.create({
        data: { userId: user.id, profileId: profileId || null, imageUrl, method: 'default' },
        select: { id: true, imageUrl: true, method: true, profileId: true, createdAt: true },
      });
      return { sheet: toGalleryEntry({ ...row, profile: profileName ? { name: profileName } : null }) };
    } catch (error) {
      await deleteGalleryImage(imageUrl);
      throw error;
    }
  } catch (error) {
    if (error?.statusCode) throw error;
    if (isGalleryUnavailable(error)) {
      throw createError({ statusCode: 503, statusMessage: 'La galerie des fiches n\'est pas encore disponible' });
    }
    console.error('[face-ref-sheets:import] failure', { name: error?.name, code: error?.code, message: error?.message });
    throw createError({ statusCode: 500, statusMessage: 'Import de la fiche impossible' });
  }
});
