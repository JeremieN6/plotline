const fs = require('node:fs');
const path = require('node:path');
const { readMultipartFormData } = require('h3');

let prismaClient;

async function getPrisma() {
  if (prismaClient) return prismaClient;

  const module = await import('../../utils/prisma.js');
  prismaClient = module?.prisma || module?.default?.prisma;

  if (!prismaClient) {
    throw new Error('Unable to resolve prisma client from server/utils/prisma.js');
  }

  return prismaClient;
}

function resolveExtension(filename = '', type = '') {
  const lowerName = filename.toLowerCase();
  if (type === 'image/png' || lowerName.endsWith('.png')) return 'png';
  return 'jpg';
}

function sanitizeId(rawId = '') {
  return String(rawId).replace(/[^a-zA-Z0-9_-]/g, '_');
}

async function getMediaStorage() {
  return import('../../utils/mediaStorage.js');
}

module.exports = defineEventHandler(async (event) => {
  try {
    const prisma = await getPrisma();
    const { getFaceRefsDir, toMediaUrl } = await getMediaStorage();
    const formData = await readMultipartFormData(event);
    const filePart = formData?.find((part) => part.name === 'file');
    const influencerIdPart = formData?.find((part) => part.name === 'influencerId');
    const influencerId = influencerIdPart?.data?.toString('utf8').trim();

    if (!filePart || !filePart.data || !influencerId) {
      return sendError(event, createError({ statusCode: 400, statusMessage: 'file et influencerId requis' }));
    }

    if (!['image/jpeg', 'image/png'].includes(filePart.type)) {
      return sendError(event, createError({ statusCode: 400, statusMessage: 'Seuls les fichiers JPG/PNG sont acceptés' }));
    }

    const isTemporary = influencerId.startsWith('temp-');

    if (!isTemporary) {
      const influencer = await prisma.influencer.findUnique({
        where: { id: influencerId },
        select: { id: true }
      });

      if (!influencer) {
        return sendError(event, createError({ statusCode: 404, statusMessage: 'Influencer non trouvé' }));
      }
    }

    const uploadDir = getFaceRefsDir();

    const extension = resolveExtension(filePart.filename, filePart.type);
    const safeInfluencerId = sanitizeId(influencerId);
    const filename = `${safeInfluencerId}-face.${extension}`;
    const filePath = path.join(uploadDir, filename);
    fs.writeFileSync(filePath, Buffer.from(filePart.data));

    const storedPath = filePath;
    const mediaUrl = toMediaUrl('face-refs', filename);

    if (!isTemporary) {
      await prisma.influencer.update({
        where: { id: influencerId },
        data: { faceRefPath: storedPath }
      });
    }

    return { path: storedPath, url: mediaUrl };
  } catch (err) {
    return sendError(event, createError({ statusCode: 500, statusMessage: 'Erreur serveur', data: err }));
  }
});
