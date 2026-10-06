import {
  MAX_ASSETS_PER_ACCOUNT,
  buildAssetCode,
  normalizeAssetType,
  normalizeSourceRole,
} from '../../utils/referenceAssets.js';
import {
  deleteAssetFile,
  getPrisma,
  readImagePart,
  readTextField,
  serializeAsset,
  storeAssetImage,
  toErrorResponse,
} from '../../utils/referenceAssetStorage.js';

/**
 * Cree un asset avec sa PREMIERE photo source. Ne genere aucune fiche : la
 * generation (payante) est declenchee explicitement via /api/assets/:id/sheet.
 */
export default defineEventHandler(async (event) => {
  let storedUrl = '';
  try {
    const authModule = await import('../../utils/auth.js');
    const user = await authModule.requireAuthUser(event);
    const prisma = await getPrisma();

    const formData = await readMultipartFormData(event);
    const type = normalizeAssetType(readTextField(formData, 'type'));
    const name = readTextField(formData, 'name');
    const description = readTextField(formData, 'description');

    if (!type) {
      return sendError(event, createError({ statusCode: 400, statusMessage: 'Type d\'asset invalide' }));
    }

    const code = buildAssetCode(type, name);
    if (!code) {
      return sendError(event, createError({ statusCode: 400, statusMessage: 'Nom invalide : utilisez des lettres ou des chiffres' }));
    }

    const role = normalizeSourceRole(type, readTextField(formData, 'role'));
    const image = readImagePart(formData);

    const count = await prisma.referenceAsset.count({ where: { userId: user.id } });
    if (count >= MAX_ASSETS_PER_ACCOUNT) {
      return sendError(event, createError({ statusCode: 409, statusMessage: `Plafond de ${MAX_ASSETS_PER_ACCOUNT} assets atteint` }));
    }

    const duplicate = await prisma.referenceAsset.findFirst({ where: { userId: user.id, code }, select: { id: true } });
    if (duplicate) {
      return sendError(event, createError({ statusCode: 409, statusMessage: `Le code ${code} existe déjà : choisissez un autre nom (par exemple ${code}_v2)` }));
    }

    storedUrl = await storeAssetImage(user.id, image.buffer, image);

    try {
      const row = await prisma.referenceAsset.create({
        data: {
          userId: user.id,
          type,
          code,
          name: name.slice(0, 120),
          description: description ? description.slice(0, 1000) : null,
          sources: [{ url: storedUrl, role }],
        },
      });
      return serializeAsset(row);
    } catch (err) {
      await deleteAssetFile(storedUrl);
      if (err?.code === 'P2002') {
        return sendError(event, createError({ statusCode: 409, statusMessage: `Le code ${code} existe déjà : choisissez un autre nom (par exemple ${code}_v2)` }));
      }
      throw err;
    }
  } catch (err) {
    if (storedUrl && !err?.statusCode) await deleteAssetFile(storedUrl);
    return sendError(event, toErrorResponse(err, 'Création de l\'asset impossible'));
  }
});
