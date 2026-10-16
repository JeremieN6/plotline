import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createError } from 'h3';

import { requireAuthUser } from '../../../utils/auth.js';
import { isGalleryUnavailable } from '../../../utils/faceRefGallery.js';
import { readImageSourceBuffer } from '../../../utils/faceRefReader.js';
import { prisma } from '../../../utils/prisma.js';

/**
 * Prepare l application d une fiche de la galerie a une persona : recopie le
 * fichier en zone temporaire, au nom reserve a son auteur
 * (`faceref_<userId>_<hex>.jpg`), puis renvoie `tempImagePath`. Le client
 * appelle ensuite POST /api/upload/face-ref, qui fait le reste (Blob, cheveux,
 * verification de propriete) : une seule logique d application, aucune copie.
 * L adresse du fichier vient toujours de la base, jamais du client.
 */
export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuthUser(event);
    const id = String(event.context?.params?.id || '').trim();
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Parametre id requis' });

    const sheet = await prisma.faceRefSheet.findFirst({ where: { id, userId: user.id }, select: { imageUrl: true } });
    if (!sheet) throw createError({ statusCode: 404, statusMessage: 'Fiche introuvable' });

    let buffer;
    try {
      ({ buffer } = await readImageSourceBuffer(sheet.imageUrl));
    } catch {
      throw createError({ statusCode: 404, statusMessage: 'Le fichier de cette fiche est introuvable' });
    }

    const tempDir = path.join(process.cwd(), 'storage', 'temp');
    await fs.mkdir(tempDir, { recursive: true });
    const fileName = `faceref_${user.id}_${crypto.randomBytes(6).toString('hex')}.jpg`;
    const absolutePath = path.join(tempDir, fileName);
    await fs.writeFile(absolutePath, buffer);

    return { tempImagePath: path.relative(process.cwd(), absolutePath).replace(/\\/g, '/') };
  } catch (error) {
    if (error?.statusCode) throw error;
    if (isGalleryUnavailable(error)) {
      throw createError({ statusCode: 503, statusMessage: 'La galerie des fiches n\'est pas encore disponible' });
    }
    console.error('[face-ref-sheets:prepare] failure', { name: error?.name, message: error?.message });
    throw createError({ statusCode: 500, statusMessage: 'Préparation de la fiche impossible' });
  }
});
