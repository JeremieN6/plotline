const fs = require('node:fs');
const path = require('node:path');
const { readMultipartFormData } = require('h3');
const { prisma } = require('../../utils/prisma');

function resolveExtension(filename = '', type = '') {
  const lowerName = filename.toLowerCase();
  if (type === 'image/png' || lowerName.endsWith('.png')) return 'png';
  return 'jpg';
}

module.exports = defineEventHandler(async (event) => {
  try {
    const { isBlobStorageEnabled, uploadPublicMediaBuffer } = await import('../../utils/blobStorage.js');

    const formData = await readMultipartFormData(event);
    const filePart = formData?.find((part) => part.name === 'file');
    const influencerIdPart = formData?.find((part) => part.name === 'influencerId');
    const influencerId = influencerIdPart?.data?.toString('utf8').trim();

    if (!filePart || !filePart.data || !influencerId) {
      return sendError(event, createError({ statusCode: 400, statusMessage: 'file et influencerId requis' }));
    }

    if (!['image/jpeg', 'image/png'].includes(filePart.type)) {
      return sendError(event, createError({ statusCode: 400, statusMessage: 'Seuls les fichiers JPG/PNG sont acceptes' }));
    }

    const isTemporary = influencerId.startsWith('temp-');

    if (!isTemporary) {
      const influencer = await prisma.influencer.findUnique({
        where: { id: influencerId },
        select: { id: true },
      });

      if (!influencer) {
        return sendError(event, createError({ statusCode: 404, statusMessage: 'Influencer non trouve' }));
      }
    }

    const extension = resolveExtension(filePart.filename, filePart.type);
    const fileBuffer = Buffer.from(filePart.data);

    let publicPath = '';

    if (isBlobStorageEnabled()) {
      const uploaded = await uploadPublicMediaBuffer(
        `body-refs/${influencerId}`,
        extension,
        fileBuffer,
        filePart.type,
      );
      publicPath = uploaded.url;
    } else {
      const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'body-refs');
      fs.mkdirSync(uploadDir, { recursive: true });

      const filename = `${influencerId}-body.${extension}`;
      const filePath = path.join(uploadDir, filename);
      fs.writeFileSync(filePath, fileBuffer);

      publicPath = `/uploads/body-refs/${filename}`;
    }

    if (!isTemporary) {
      await prisma.influencer.update({
        where: { id: influencerId },
        data: { bodyRefPath: publicPath },
      });
    }

    return { path: publicPath, url: publicPath };
  } catch (err) {
    return sendError(event, createError({ statusCode: 500, statusMessage: 'Erreur serveur', data: err }));
  }
});
