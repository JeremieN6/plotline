const path = require('node:path');
const { prisma } = require('../../../utils/prisma');

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

async function updateInfluencerFaceRefCompatible(id, data) {
  try {
    return await prisma.influencer.update({
      where: { id },
      data,
      select: {
        ...LEGACY_FACE_REF_SELECT,
        hairPrompt: true,
        hairAutoPrompt: true,
        hairLocked: true,
      }
    });
  } catch (err) {
    if (!isPrismaSchemaDriftError(err)) {
      throw err;
    }

    return await prisma.influencer.update({
      where: { id },
      data: { faceRefPath: data.faceRefPath },
      select: LEGACY_FACE_REF_SELECT,
    });
  }
}

module.exports = defineEventHandler(async (event) => {
  try {
    const { describeHairFromImageSource } = await import('../../../utils/hairReference.js');
    const id = event.context?.params?.id;
    const body = await readBody(event);
    const faceRefPath = body?.faceRefPath;

    if (!id) {
      return sendError(event, createError({ statusCode: 400, statusMessage: 'Paramètre id requis' }));
    }

    if (!faceRefPath || typeof faceRefPath !== 'string') {
      return sendError(event, createError({ statusCode: 400, statusMessage: 'faceRefPath requis' }));
    }

    let currentInfluencer = null;
    try {
      currentInfluencer = await prisma.influencer.findUnique({
        where: { id },
        select: {
          hairPrompt: true,
          hairAutoPrompt: true,
          hairLocked: true,
        },
      });
    } catch {
      currentInfluencer = null;
    }

    const resolveLocalPath = (value) => {
      const rawPath = String(value || '').trim();
      if (path.isAbsolute(rawPath)) return rawPath;
      if (rawPath.startsWith('/uploads/')) {
        return path.join(process.cwd(), 'public', rawPath.replace(/^\/+/, ''));
      }
      return path.resolve(process.cwd(), rawPath.replace(/^\/+/, ''));
    };

    let hairPayload = {};
    try {
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

    let influencer;
    try {
      influencer = await updateInfluencerFaceRefCompatible(id, { faceRefPath, ...hairPayload });
    } catch (err) {
      if (!isPrismaSchemaDriftError(err)) {
        throw err;
      }

      influencer = await updateInfluencerFaceRefCompatible(id, { faceRefPath });
    }

    return influencer;
  } catch (err) {
    console.error('[influencer:face-ref-patch] failure', {
      name: err?.name,
      code: err?.code,
      message: err?.message,
      stack: err?.stack,
    });

    return sendError(event, createError({
      statusCode: 500,
      statusMessage: `Erreur patch face ref: ${err?.message || 'erreur inconnue'}`,
      data: {
        name: err?.name,
        code: err?.code,
        message: err?.message,
      },
    }));
  }
});