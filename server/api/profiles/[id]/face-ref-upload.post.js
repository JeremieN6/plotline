import fs from 'node:fs';
import path from 'node:path';

let prismaClient;

async function getPrisma() {
  if (prismaClient) return prismaClient;

  const module = await import('../../../utils/prisma.js');
  prismaClient = module?.prisma || module?.default?.prisma;

  if (!prismaClient) {
    throw new Error('Unable to resolve prisma client from server/utils/prisma.js');
  }

  return prismaClient;
}

const MAX_FILE_BYTES = 10 * 1024 * 1024;

function detectImageType(buffer) {
  if (buffer.length > 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { mime: 'image/png', extension: 'png' };
  }

  if (buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mime: 'image/jpeg', extension: 'jpg' };
  }

  return null;
}

/**
 * Remplace la face ref d un profil par une fiche fournie telle quelle, sans
 * passer par la generation payante des 3 panneaux. Reserve aux comptes admin
 * (voir ADMIN_ACCOUNTS): ouvert a tous, cet endpoint contournerait tout futur
 * plafond de generation de fiches.
 */
export default defineEventHandler(async (event) => {
  try {
    const profileId = String(event.context?.params?.id || '').trim();
    if (!profileId) {
      return sendError(event, createError({ statusCode: 400, statusMessage: 'Parametre id requis' }));
    }

    const authModule = await import('../../../utils/auth.js');
    const user = await authModule.requireAuthUser(event);

    if (!user.isAdmin) {
      return sendError(event, createError({ statusCode: 403, statusMessage: 'Reserve aux comptes administrateur' }));
    }

    const prisma = await getPrisma();
    const profile = await prisma.profile.findFirst({
      where: { id: profileId, userId: user.id },
      select: { id: true },
    });

    if (!profile) {
      return sendError(event, createError({ statusCode: 404, statusMessage: 'Profil introuvable' }));
    }

    const formData = await readMultipartFormData(event);
    const filePart = formData?.find((part) => part.name === 'file');

    if (!filePart?.data?.length) {
      return sendError(event, createError({ statusCode: 400, statusMessage: 'Fichier requis' }));
    }

    const buffer = Buffer.from(filePart.data);

    if (buffer.length > MAX_FILE_BYTES) {
      return sendError(event, createError({ statusCode: 413, statusMessage: 'Fichier trop lourd (10 Mo maximum)' }));
    }

    // Le type declare par le client ne prouve rien: on lit la signature du fichier.
    const detected = detectImageType(buffer);
    if (!detected) {
      return sendError(event, createError({ statusCode: 400, statusMessage: 'Seuls les fichiers JPG/PNG sont acceptes' }));
    }

    const blobModule = await import('../../../utils/blobStorage.js');
    let faceRefPath;

    if (blobModule.isBlobStorageEnabled()) {
      const uploaded = await blobModule.uploadPublicMediaBuffer(
        `face-refs/${profile.id}`,
        detected.extension,
        buffer,
        detected.mime,
      );
      faceRefPath = uploaded.url;
    } else {
      const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'face-refs');
      fs.mkdirSync(uploadDir, { recursive: true });
      const filename = `${profile.id}-face-${Date.now()}.${detected.extension}`;
      fs.writeFileSync(path.join(uploadDir, filename), buffer);
      faceRefPath = `/uploads/face-refs/${filename}`;
    }

    // Meme derivation que le flux existant: la couleur de cheveux est lue sur la fiche.
    let hairPayload = {};
    try {
      const { describeHairFromImageSource } = await import('../../../utils/hairReference.js');
      const resolveLocalPath = (value) => path.join(process.cwd(), 'public', String(value || '').replace(/^\/+/, ''));
      const hairPrompt = await describeHairFromImageSource(faceRefPath, resolveLocalPath);
      if (hairPrompt) {
        hairPayload = { hairPrompt };
      }
    } catch {
      hairPayload = {};
    }

    await prisma.profile.update({
      where: { id: profile.id },
      data: { faceRefPath, ...hairPayload },
    });

    return { path: faceRefPath, url: faceRefPath };
  } catch (err) {
    if (err?.statusCode) {
      return sendError(event, err);
    }

    return sendError(event, createError({
      statusCode: 500,
      statusMessage: `Import de la fiche impossible: ${err?.message || 'erreur inconnue'}`,
    }));
  }
});
