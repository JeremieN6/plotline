import { createError } from 'h3';

import { requireAuthUser } from '../../../utils/auth.js';
import { buildDownloadName, isGalleryUnavailable, toGalleryEntry } from '../../../utils/faceRefGallery.js';
import { readImageSourceBuffer } from '../../../utils/faceRefReader.js';
import { prisma } from '../../../utils/prisma.js';

/** Telecharge le fichier d une fiche (passe par le serveur : un lien Blob d un autre domaine ne se telecharge pas avec l attribut download). */
export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuthUser(event);
    const id = String(event.context?.params?.id || '').trim();
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Parametre id requis' });

    const row = await prisma.faceRefSheet.findFirst({
      where: { id, userId: user.id },
      select: { id: true, imageUrl: true, method: true, profileId: true, createdAt: true, profile: { select: { name: true } } },
    });
    if (!row) throw createError({ statusCode: 404, statusMessage: 'Fiche introuvable' });

    let image;
    try {
      image = await readImageSourceBuffer(row.imageUrl);
    } catch {
      throw createError({ statusCode: 404, statusMessage: 'Le fichier de cette fiche est introuvable' });
    }

    const isPng = image.mimeType === 'image/png';
    setHeader(event, 'Content-Type', isPng ? 'image/png' : 'image/jpeg');
    setHeader(event, 'Content-Disposition', `attachment; filename="${buildDownloadName(toGalleryEntry(row), isPng ? 'png' : 'jpg')}"`);
    return image.buffer;
  } catch (error) {
    if (error?.statusCode) throw error;
    if (isGalleryUnavailable(error)) {
      throw createError({ statusCode: 503, statusMessage: 'La galerie des fiches n\'est pas encore disponible' });
    }
    console.error('[face-ref-sheets:download] failure', { name: error?.name, message: error?.message });
    throw createError({ statusCode: 500, statusMessage: 'Téléchargement impossible' });
  }
});
