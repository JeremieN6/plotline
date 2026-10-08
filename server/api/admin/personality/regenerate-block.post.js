import { handlePersonalityGeneration, toHttpError } from '../../../utils/personalityEndpoint.js';

/**
 * Regenere UN bloc en respectant les champs saisis ou verrouilles et la
 * coherence avec les autres blocs. Ne sauvegarde rien. Reserve aux admins.
 */
export default defineEventHandler(async (event) => {
  try {
    return await handlePersonalityGeneration(event, { blockOnly: true });
  } catch (error) {
    return sendError(event, toHttpError(error));
  }
});
