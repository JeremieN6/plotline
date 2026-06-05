const path = require('node:path');

let prismaClient;

async function getMediaStorage() {
  return import('../../../utils/mediaStorage.js');
}

function isTransientDbError(err) {
  const code = err?.code;
  return code === 'ETIMEDOUT' || code === 'P1001' || code === 'P1002';
}

async function updateStoredInfluencerFaceRef(id, faceRefPath) {
  const store = useStorage('data');
  const existing = await store.getItem(`influencer:${id}`);
  if (!existing) return null;

  const updated = { ...existing, faceRefPath };
  await store.setItem(`influencer:${id}`, updated);

  if (updated.userId) {
    const listKey = `influencers:${updated.userId}`;
    const cached = await store.getItem(listKey);
    if (Array.isArray(cached)) {
      const nextCached = cached.map((item) => (item?.id === id ? updated : item));
      await store.setItem(listKey, nextCached);
    }
  }

  return updated;
}

async function getPrisma() {
  if (prismaClient) return prismaClient;

  const module = await import('../../../utils/prisma.js');
  prismaClient = module?.prisma || module?.default?.prisma;

  if (!prismaClient) {
    throw new Error('Unable to resolve prisma client from server/utils/prisma.js');
  }

  return prismaClient;
}

module.exports = defineEventHandler(async (event) => {
  let id;
  let faceRefPath;

  try {
    const prisma = await getPrisma();
    id = event.context?.params?.id;
    const body = await readBody(event);
    faceRefPath = body?.faceRefPath;

    if (!id) {
      return sendError(event, createError({ statusCode: 400, statusMessage: 'Paramètre id requis' }));
    }

    if (!faceRefPath || typeof faceRefPath !== 'string') {
      return sendError(event, createError({ statusCode: 400, statusMessage: 'faceRefPath requis' }));
    }

    const { getStorageRoot } = await getMediaStorage();
    const storageRoot = getStorageRoot();
    const relativeFromStorage = path.relative(storageRoot, faceRefPath);
    if (relativeFromStorage.startsWith('..') || path.isAbsolute(relativeFromStorage)) {
      return sendError(event, createError({ statusCode: 400, statusMessage: 'faceRefPath invalide' }));
    }

    if (String(id).startsWith('local-')) {
      const updatedStored = await updateStoredInfluencerFaceRef(id, faceRefPath);
      if (!updatedStored) {
        return sendError(event, createError({ statusCode: 404, statusMessage: 'Influencer non trouvé' }));
      }
      return updatedStored;
    }

    const influencer = await prisma.influencer.update({
      where: { id },
      data: { faceRefPath }
    });

    const store = useStorage('data');
    await store.setItem(`influencer:${id}`, influencer);

    return influencer;
  } catch (err) {
    if (isTransientDbError(err)) {
      const updatedStored = await updateStoredInfluencerFaceRef(id, faceRefPath);
      if (updatedStored) {
        return updatedStored;
      }
    }

    if (err?.code === 'P2025') {
      return sendError(event, createError({ statusCode: 404, statusMessage: 'Influencer non trouvé' }));
    }

    return sendError(event, createError({ statusCode: 500, statusMessage: 'Erreur serveur', data: err }));
  }
});