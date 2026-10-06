import { ASSET_SOURCE_ROLES, ASSET_TYPES, MAX_SOURCE_IMAGES, normalizeAssetType } from '../../utils/referenceAssets.js';
import { getPrisma, serializeAsset, toErrorResponse } from '../../utils/referenceAssetStorage.js';

export default defineEventHandler(async (event) => {
  try {
    const authModule = await import('../../utils/auth.js');
    const user = await authModule.requireAuthUser(event);
    const prisma = await getPrisma();

    const rawType = String(getQuery(event)?.type || '').trim();
    const type = rawType ? normalizeAssetType(rawType) : null;
    if (rawType && !type) {
      return sendError(event, createError({ statusCode: 400, statusMessage: 'Type d\'asset invalide' }));
    }

    const rows = await prisma.referenceAsset.findMany({
      where: { userId: user.id, ...(type ? { type } : {}) },
      orderBy: { createdAt: 'desc' },
    });

    // `meta` evite de dupliquer les listes de types et de roles cote interface.
    return {
      assets: rows.map(serializeAsset),
      meta: { types: ASSET_TYPES, roles: ASSET_SOURCE_ROLES, maxSources: MAX_SOURCE_IMAGES },
    };
  } catch (err) {
    return sendError(event, toErrorResponse(err, 'Lecture de la bibliothèque impossible'));
  }
});
