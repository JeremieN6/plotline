const fs = require('node:fs');
const path = require('node:path');
const { readMultipartFormData } = require('h3');

/**
 * Upload generique d'un asset widget (packshot produit, image de reference
 * FOOD_AD): contrairement a /api/upload/face-ref, aucun couplage a un Profile
 * -- c'est une reference ponctuelle a une seule generation, pas un attribut
 * persistant de persona. Meme mecanisme de stockage (Blob si actif, repli
 * local sinon) que le reste du projet.
 */
function resolveExtension(filename = '', type = '') {
  const lowerName = String(filename || '').toLowerCase();
  if (type === 'image/png' || lowerName.endsWith('.png')) return 'png';
  return 'jpg';
}

module.exports = defineEventHandler(async (event) => {
  try {
    const authModule = await import('../../utils/auth.js');
    const user = await authModule.requireAuthUser(event);

    const { isBlobStorageEnabled, uploadPublicMediaBuffer } = await import('../../utils/blobStorage.js');

    const formData = await readMultipartFormData(event);
    const filePart = formData?.find((part) => part.name === 'file');

    if (!filePart || !filePart.data) {
      return sendError(event, createError({ statusCode: 400, statusMessage: 'file requis' }));
    }

    if (!['image/jpeg', 'image/png'].includes(filePart.type)) {
      return sendError(event, createError({ statusCode: 400, statusMessage: 'Seuls les fichiers JPG/PNG sont acceptés' }));
    }

    const extension = resolveExtension(filePart.filename, filePart.type);
    const fileBuffer = Buffer.from(filePart.data);
    const prefix = `widget-assets/${user.id}-${Date.now()}`;

    if (isBlobStorageEnabled()) {
      const uploaded = await uploadPublicMediaBuffer(prefix, extension, fileBuffer, filePart.type);
      return { url: uploaded.url };
    }

    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'widget-assets');
    fs.mkdirSync(uploadDir, { recursive: true });

    const filename = `${user.id}-${Date.now()}.${extension}`;
    fs.writeFileSync(path.join(uploadDir, filename), fileBuffer);

    return { url: `/uploads/widget-assets/${filename}` };
  } catch (err) {
    if (err?.statusCode) throw err;
    console.error('[upload:widget-asset] failure', { name: err?.name, code: err?.code, message: err?.message });
    return sendError(event, createError({
      statusCode: 500,
      statusMessage: `Erreur upload asset widget: ${err?.message || 'erreur inconnue'}`,
    }));
  }
});
