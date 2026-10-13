import { classifyAssetPhotos } from '../../../utils/assetRoleClassifier.js';
import { parseSources } from '../../../utils/referenceAssets.js';
import { getPrisma, loadAssetImages, serializeAsset, toErrorResponse } from '../../../utils/referenceAssetStorage.js';

/**
 * Detecte automatiquement ce que montre chaque photo (un appel Claude, quelques
 * centimes, independant de Gemini). Corps optionnel : { indexes: [0, 2] } pour ne
 * traiter que certaines photos ; sans corps, toutes les photos. Les photos non
 * ciblees gardent leur role. Relit les photos depuis la base, jamais la requete.
 */
export default defineEventHandler(async (event) => {
  try {
    const id = String(event.context?.params?.id || '').trim();
    const authModule = await import('../../../utils/auth.js');
    const user = await authModule.requireAuthUser(event);
    const prisma = await getPrisma();

    const asset = await prisma.referenceAsset.findFirst({ where: { id, userId: user.id } });
    if (!asset) {
      return sendError(event, createError({ statusCode: 404, statusMessage: 'Asset introuvable' }));
    }

    const sources = parseSources(asset.sources);
    const body = await readBody(event).catch(() => null);
    const requested = Array.isArray(body?.indexes)
      ? [...new Set(body.indexes.filter((value) => Number.isInteger(value) && value >= 0 && value < sources.length))]
      : sources.map((_, index) => index);

    if (!requested.length) {
      return serializeAsset(asset);
    }

    const images = await loadAssetImages(requested.map((index) => sources[index]));
    const roles = await classifyAssetPhotos({ type: asset.type, images });

    let changed = false;
    const next = sources.map((source, index) => {
      const position = requested.indexOf(index);
      if (position === -1) return source;
      if (roles[position] !== source.role) changed = true;
      return { ...source, role: roles[position] };
    });

    const updated = await prisma.referenceAsset.update({
      where: { id: asset.id },
      data: {
        sources: next,
        ...(changed && asset.sheetUrl ? { sheetOutdated: true } : {}),
      },
    });

    return serializeAsset(updated);
  } catch (err) {
    return sendError(event, toErrorResponse(err, 'Détection des vues impossible'));
  }
});
