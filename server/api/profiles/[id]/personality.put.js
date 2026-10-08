import { handlePutProfilePersonality, toHttpError } from '../../../utils/personalityEndpoint.js';

/**
 * Enregistre la personnalite du profil. Admin uniquement ; profil du compte
 * uniquement ; 32 Ko maximum ; le contenu est normalise avant ecriture et ne
 * touche jamais aux colonnes du profil.
 */
export default defineEventHandler(async (event) => {
  try {
    return await handlePutProfilePersonality(event);
  } catch (error) {
    return sendError(event, toHttpError(error));
  }
});
