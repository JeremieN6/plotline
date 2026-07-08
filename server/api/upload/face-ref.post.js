const fs = require('node:fs');
const path = require('node:path');
const { readMultipartFormData } = require('h3');
const { prisma } = require('../../utils/prisma');

function resolveExtension(filename = '', type = '') {
  const lowerName = filename.toLowerCase();
  if (type === 'image/png' || lowerName.endsWith('.png')) return 'png';
  return 'jpg';
}

function moveFileSync(sourcePath, targetPath) {
  try {
    fs.renameSync(sourcePath, targetPath);
  } catch (err) {
    if (err?.code !== 'EXDEV') {
      throw err;
    }

    fs.copyFileSync(sourcePath, targetPath);
    fs.unlinkSync(sourcePath);
  }
}

function normalizeRelativePath(rawPath = '') {
  return String(rawPath || '').trim().replace(/^\/+/, '').replace(/\\/g, '/');
}

function resolveTempPath(rawPath) {
  const tempRoot = path.resolve(process.cwd(), 'storage', 'temp');
  const relativeRaw = normalizeRelativePath(rawPath);
  const absolute = path.resolve(process.cwd(), relativeRaw);

  const tempRootWithSep = `${tempRoot}${path.sep}`;
  if (absolute !== tempRoot && !absolute.startsWith(tempRootWithSep)) {
    throw createError({ statusCode: 400, statusMessage: 'tempImagePath invalide' });
  }

  return absolute;
}

function isPrismaSchemaDriftError(err) {
  const message = String(err?.message || '').toLowerCase();
  return err?.code === 'P2022'
    || (message.includes('column') && message.includes('does not exist'))
    || message.includes('unknown arg')
    || message.includes('unknown argument')
    || message.includes('unknown field');
}

const LEGACY_FACE_REF_SELECT = {
  id: true,
  faceRefPath: true,
};

async function updateInfluencerFaceRefCompatible(influencerId, data) {
  try {
    return await prisma.influencer.update({
      where: { id: influencerId },
      data,
      select: {
        ...LEGACY_FACE_REF_SELECT,
        hairPrompt: true,
        hairAutoPrompt: true,
        hairLocked: true,
      },
    });
  } catch (err) {
    if (!isPrismaSchemaDriftError(err)) {
      throw err;
    }

    return await prisma.influencer.update({
      where: { id: influencerId },
      data: { faceRefPath: data.faceRefPath },
      select: LEGACY_FACE_REF_SELECT,
    });
  }
}

async function upsertFaceRefOnInfluencer(influencerId, faceRefPath) {
  let currentInfluencer = null;
  try {
    currentInfluencer = await prisma.influencer.findUnique({
      where: { id: influencerId },
      select: {
        hairPrompt: true,
        hairAutoPrompt: true,
        hairLocked: true,
      },
    });
  } catch {
    currentInfluencer = null;
  }

  let hairPayload = {};
  try {
    const { describeHairFromImageSource } = await import('../../utils/hairReference.js');
    const resolveLocalPath = (value) => {
      const rawPath = String(value || '').trim();
      if (path.isAbsolute(rawPath)) return rawPath;
      if (rawPath.startsWith('/uploads/')) {
        return path.join(process.cwd(), 'public', rawPath.replace(/^\/+/, ''));
      }
      return path.resolve(process.cwd(), rawPath.replace(/^\/+/, ''));
    };

    const hairPrompt = await describeHairFromImageSource(faceRefPath, resolveLocalPath);
    if (hairPrompt) {
      hairPayload = {
        hairAutoPrompt: hairPrompt,
        hairPrompt: currentInfluencer?.hairLocked === false && String(currentInfluencer?.hairPrompt || '').trim()
          ? currentInfluencer.hairPrompt
          : hairPrompt,
        hairLocked: typeof currentInfluencer?.hairLocked === 'boolean' ? currentInfluencer.hairLocked : true,
      };
    }
  } catch {
    hairPayload = {};
  }

  try {
    await updateInfluencerFaceRefCompatible(influencerId, {
      faceRefPath,
      ...hairPayload,
    });
  } catch (err) {
    if (!isPrismaSchemaDriftError(err)) {
      throw err;
    }

    await updateInfluencerFaceRefCompatible(influencerId, { faceRefPath });
  }
}

module.exports = defineEventHandler(async (event) => {
  try {
    const contentType = String(getHeader(event, 'content-type') || '').toLowerCase();

    if (contentType.includes('application/json')) {
      const body = await readBody(event);
      const influencerId = String(body?.influencerId || '').trim();
      const tempImagePath = String(body?.tempImagePath || '').trim();

      if (!influencerId || !tempImagePath) {
        return sendError(event, createError({ statusCode: 400, statusMessage: 'influencerId et tempImagePath requis' }));
      }

      const influencer = await prisma.influencer.findUnique({
        where: { id: influencerId },
        select: { id: true },
      });

      if (!influencer) {
        return sendError(event, createError({ statusCode: 404, statusMessage: 'Influencer non trouvé' }));
      }

      const absoluteTempPath = resolveTempPath(tempImagePath);
      if (!fs.existsSync(absoluteTempPath)) {
        return sendError(event, createError({ statusCode: 404, statusMessage: 'Image temporaire introuvable' }));
      }

      const uploadDir = path.join(process.cwd(), 'storage', 'uploads', 'face-refs');
      fs.mkdirSync(uploadDir, { recursive: true });

      const finalFileName = `${influencerId}.jpg`;
      const absoluteTargetPath = path.join(uploadDir, finalFileName);
      moveFileSync(absoluteTempPath, absoluteTargetPath);

      const storedPath = path.relative(process.cwd(), absoluteTargetPath).replace(/\\/g, '/');
      await upsertFaceRefOnInfluencer(influencerId, storedPath);

      return { path: storedPath, url: storedPath };
    }

    const { isBlobStorageEnabled, uploadPublicMediaBuffer } = await import('../../utils/blobStorage.js');

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

    const extension = resolveExtension(filePart.filename, filePart.type);
    const fileBuffer = Buffer.from(filePart.data);

    let publicPath = '';

    let localFilePath = '';

    if (isBlobStorageEnabled()) {
      const uploaded = await uploadPublicMediaBuffer(
        `face-refs/${influencerId}`,
        extension,
        fileBuffer,
        filePart.type,
      );
      publicPath = uploaded.url;
    } else {
      const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'face-refs');
      fs.mkdirSync(uploadDir, { recursive: true });

      const filename = `${influencerId}-face.${extension}`;
      localFilePath = path.join(uploadDir, filename);
      fs.writeFileSync(localFilePath, fileBuffer);

      publicPath = `/uploads/face-refs/${filename}`;
    }

    if (!isTemporary) {
      await upsertFaceRefOnInfluencer(influencerId, publicPath);
    }

    return { path: publicPath, url: publicPath };
  } catch (err) {
    console.error('[upload:face-ref] failure', {
      name: err?.name,
      code: err?.code,
      message: err?.message,
      stack: err?.stack,
    });

    return sendError(event, createError({
      statusCode: 500,
      statusMessage: `Erreur upload face ref: ${err?.message || 'erreur inconnue'}`,
      data: {
        name: err?.name,
        code: err?.code,
        message: err?.message,
      },
    }));
  }
});
