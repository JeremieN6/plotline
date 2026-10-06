import { generateAssetSheet } from '../../../utils/assetSheetGeneration.js';
import {
  deleteAssetFile,
  detectImageType,
  getPrisma,
  loadAssetImages,
  serializeAsset,
  storeAssetImage,
  toErrorResponse,
} from '../../../utils/referenceAssetStorage.js';

/**
 * Genere (ou regenere) la fiche de reference d'un asset : UN appel Gemini
 * payant, declenche explicitement par l'utilisateur. Relit toutes les photos
 * dans l'ordre depuis les URLs enregistrees en base (jamais depuis la requete).
 */
export default defineEventHandler(async (event) => {
  let newSheetUrl = '';
  try {
    const id = String(event.context?.params?.id || '').trim();
    const authModule = await import('../../../utils/auth.js');
    const user = await authModule.requireAuthUser(event);
    const prisma = await getPrisma();

    const asset = await prisma.referenceAsset.findFirst({ where: { id, userId: user.id } });
    if (!asset) {
      return sendError(event, createError({ statusCode: 404, statusMessage: 'Asset introuvable' }));
    }

    const images = await loadAssetImages(asset.sources);
    if (!images.length) {
      return sendError(event, createError({ statusCode: 409, statusMessage: 'Cet asset n\'a aucune photo source lisible' }));
    }

    let generated;
    try {
      generated = await generateAssetSheet({ type: asset.type, images });
    } catch (err) {
      if (err?.name === 'GeminiNoPartsError') {
        return sendError(event, createError({
          statusCode: 422,
          statusMessage: 'Gemini n\'a renvoyé aucune image pour ces photos. Essayez avec d\'autres photos ou réessayez plus tard.',
        }));
      }
      if (String(err?.message || '').includes('GEMINI_API_KEY')) {
        return sendError(event, createError({ statusCode: 500, statusMessage: 'GEMINI_API_KEY non configurée' }));
      }
      throw err;
    }

    const sheetType = detectImageType(generated.buffer) || { extension: 'png', mime: 'image/png' };
    newSheetUrl = await storeAssetImage(user.id, generated.buffer, sheetType, { sheet: true });

    const previousSheetUrl = asset.sheetUrl;
    const updated = await prisma.referenceAsset.update({
      where: { id: asset.id },
      data: { sheetUrl: newSheetUrl, sheetOutdated: false },
    });

    if (previousSheetUrl) await deleteAssetFile(previousSheetUrl);
    return serializeAsset(updated);
  } catch (err) {
    if (newSheetUrl) await deleteAssetFile(newSheetUrl);
    return sendError(event, toErrorResponse(err, 'Génération de la fiche impossible'));
  }
});
