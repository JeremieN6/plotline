import { MAX_SOURCE_IMAGES, normalizeSourceRole, parseSources } from '../../../utils/referenceAssets.js';
import {
  deleteAssetFile,
  getPrisma,
  readImagePart,
  readTextField,
  serializeAsset,
  storeAssetImage,
  toErrorResponse,
} from '../../../utils/referenceAssetStorage.js';

/** Ajoute une photo source (1 par requete) a un asset existant. */
export default defineEventHandler(async (event) => {
  let storedUrl = '';
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
    if (sources.length >= MAX_SOURCE_IMAGES) {
      return sendError(event, createError({ statusCode: 409, statusMessage: `${MAX_SOURCE_IMAGES} photos maximum par asset` }));
    }

    const formData = await readMultipartFormData(event);
    const role = normalizeSourceRole(asset.type, readTextField(formData, 'role'));
    const image = readImagePart(formData);

    storedUrl = await storeAssetImage(user.id, image.buffer, image);

    const updated = await prisma.referenceAsset.update({
      where: { id: asset.id },
      data: {
        sources: [...sources, { url: storedUrl, role }],
        ...(asset.sheetUrl ? { sheetOutdated: true } : {}),
      },
    });

    return serializeAsset(updated);
  } catch (err) {
    if (storedUrl) await deleteAssetFile(storedUrl);
    return sendError(event, toErrorResponse(err, 'Ajout de la photo impossible'));
  }
});
