import { parseSources } from '../../../../utils/referenceAssets.js';
import { deleteAssetFile, getPrisma, serializeAsset, toErrorResponse } from '../../../../utils/referenceAssetStorage.js';

/** Retire la photo source a cet index (et son fichier). La derniere photo ne peut pas etre retiree. */
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

    if (sources.length <= 1) {
      return sendError(event, createError({ statusCode: 409, statusMessage: 'Impossible de retirer la dernière photo : supprimez l\'asset' }));
    }

    const [removed] = sources.splice(index, 1);

    const updated = await prisma.referenceAsset.update({
      where: { id: asset.id },
      data: {
        sources,
        ...(asset.sheetUrl ? { sheetOutdated: true } : {}),
      },
    });

    await deleteAssetFile(removed.url);
    return serializeAsset(updated);
  } catch (err) {
    return sendError(event, toErrorResponse(err, 'Retrait de la photo impossible'));
  }
});
