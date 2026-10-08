import { handleGetProfilePersonality, toHttpError } from '../../../utils/personalityEndpoint.js';

/**
 * Personnalite enregistree du profil (champs des colonnes en lecture seule).
 * Admin uniquement ; profil du compte uniquement.
 */
export default defineEventHandler(async (event) => {
  try {
    return await handleGetProfilePersonality(event);
  } catch (error) {
    return sendError(event, toHttpError(error));
  }
});
