const fs = require('node:fs');
const path = require('node:path');
const { readMultipartFormData } = require('h3');
const { prisma } = require('../../utils/prisma');

module.exports = defineEventHandler(async (event) => {
  try {
    const formData = await readMultipartFormData(event);
    const filePart = formData?.find((part) => part.name === 'file');
    const influencerIdPart = formData?.find((part) => part.name === 'influencerId');
    const influencerId = influencerIdPart?.data?.toString('utf8').trim();

    if (!filePart || !filePart.data || !influencerId) {
      return sendError(event, createError({ statusCode: 400, statusMessage: 'file et influencerId requis' }));
    }

    const influencer = await prisma.influencer.findUnique({
      where: { id: influencerId },
      select: { id: true }
    });

    if (!influencer) {
      return sendError(event, createError({ statusCode: 404, statusMessage: 'Influencer non trouvé' }));
    }

    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'face-refs');
    fs.mkdirSync(uploadDir, { recursive: true });

    const filePath = path.join(uploadDir, `${influencerId}-face.jpg`);
    fs.writeFileSync(filePath, Buffer.from(filePart.data));

    const publicPath = `/uploads/face-refs/${influencerId}-face.jpg`;

    await prisma.influencer.update({
      where: { id: influencerId },
      data: { faceRefPath: publicPath }
    });

    return { path: publicPath };
  } catch (err) {
    return sendError(event, createError({ statusCode: 500, statusMessage: 'Erreur serveur', data: err }));
  }
});
