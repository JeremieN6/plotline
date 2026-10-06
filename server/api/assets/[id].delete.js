import { parseSources } from '../../utils/referenceAssets.js';
import { deleteAssetFile, getPrisma, toErrorResponse } from '../../utils/referenceAssetStorage.js';

/** Supprime l'asset, puis toutes ses photos et sa fiche (la suppression de fichier ne leve jamais). */
export default defineEventHandler(async (event) => {
  try {
    const id = String(event.context?.params?.id || '').trim();
    const authModule = await import('../../utils/auth.js');
    const user = await authModule.requireAuthUser(event);
    const prisma = await getPrisma();

    const asset = await prisma.referenceAsset.findFirst({ where: { id, userId: user.id } });
    if (!asset) {
      return sendError(event, createError({ statusCode: 404, statusMessage: 'Asset introuvable' }));
    }

    await prisma.referenceAsset.delete({ where: { id: asset.id } });

    const urls = [...parseSources(asset.sources).map((source) => source.url), asset.sheetUrl].filter(Boolean);
    for (const url of urls) {
      await deleteAssetFile(url);
    }

    return { id: asset.id, deleted: true };
  } catch (err) {
    return sendError(event, toErrorResponse(err, 'Suppression de l\'asset impossible'));
  }
});
