import { normalizeSourceRole, parseSources } from '../../../../utils/referenceAssets.js';
import { getPrisma, serializeAsset, toErrorResponse } from '../../../../utils/referenceAssetStorage.js';

/** Corrige a la main le role d'une photo source (ex. apres une detection automatique). */
export default defineEventHandler(async (event) => {
  try {
    const id = String(event.context?.params?.id || '').trim();
    const rawIndex = String(event.context?.params?.index ?? '').trim();
    const authModule = await import('../../../../utils/auth.js');
    const user = await authModule.requireAuthUser(event);
    const prisma = await getPrisma();

    const asset = await prisma.referenceAsset.findFirst({ where: { id, userId: user.id } });
    if (!asset) {
      return sendError(event, createError({ statusCode: 404, statusMessage: 'Asset introuvable' }));
    }

    const sources = parseSources(asset.sources);
    const index = /^\d+$/.test(rawIndex) ? Number(rawIndex) : -1;
    if (index < 0 || index >= sources.length) {
      return sendError(event, createError({ statusCode: 404, statusMessage: 'Photo introuvable' }));
    }

    const body = await readBody(event).catch(() => null);
    const role = normalizeSourceRole(asset.type, body?.role);
    if (role === sources[index].role) {
      return serializeAsset(asset);
    }

    sources[index] = { ...sources[index], role };
    const updated = await prisma.referenceAsset.update({
      where: { id: asset.id },
      data: {
        sources,
        ...(asset.sheetUrl ? { sheetOutdated: true } : {}),
      },
    });

    return serializeAsset(updated);
  } catch (err) {
    return sendError(event, toErrorResponse(err, 'Modification de la photo impossible'));
  }
});
