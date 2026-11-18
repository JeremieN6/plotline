import { getArtDirection } from '../../utils/artDirections.js';
import { MAX_ART_REQUEST_LENGTH, generateArtDirectionChanges } from '../../utils/artDirectionAssist.js';

/**
 * « Changer quelque chose » d'une DA a parametres : une phrase de l'utilisateur
 * devient un choix d'options (identifiants valides cote serveur). Un appel Claude
 * (~1 centime), session obligatoire.
 */
export default defineEventHandler(async (event) => {
  try {
    const authModule = await import('../../utils/auth.js');
    await authModule.requireAuthUser(event);

    const body = await readBody(event);
    const request = String(body?.request || '').trim();
    const direction = getArtDirection(body?.artDirectionId);

    if (!direction?.parameters?.length) {
      return sendError(event, createError({ statusCode: 400, statusMessage: 'Cette direction artistique n a pas de reglages' }));
    }
    if (!request) {
      return sendError(event, createError({ statusCode: 400, statusMessage: 'Decris ce que tu veux changer' }));
    }
    if (request.length > MAX_ART_REQUEST_LENGTH) {
      return sendError(event, createError({ statusCode: 400, statusMessage: `Demande trop longue (${MAX_ART_REQUEST_LENGTH} caracteres au plus)` }));
    }

    const result = await generateArtDirectionChanges({
      direction,
      request,
      currentParams: body?.currentParams,
    });

    return { params: result.params, changed: result.changed, note: result.note };
  } catch (err) {
    if (err?.statusCode) return sendError(event, err);
    return sendError(event, createError({ statusCode: 500, statusMessage: err?.message || 'Reglage impossible pour le moment' }));
  }
});
