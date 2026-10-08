import { handlePersonalityGeneration, toHttpError } from '../../../utils/personalityEndpoint.js';

/**
 * Genere (ou complete) une personnalite, SANS la sauvegarder. Utilisable sans
 * profil existant (laboratoire). Reserve aux comptes admin.
 */
export default defineEventHandler(async (event) => {
  try {
    return await handlePersonalityGeneration(event);
  } catch (error) {
    return sendError(event, toHttpError(error));
  }
});
