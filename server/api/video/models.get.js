/**
 * Modeles video actuellement proposes par le studio (session obligatoire).
 * Evalue A CHAQUE REQUETE : Veo disparait tout seul le 22 octobre 2026 sans
 * redeploiement (voir server/utils/veoAvailability.js), ce qu une valeur figee
 * au build dans la config publique de Nuxt ne ferait pas.
 */
export default defineEventHandler(async (event) => {
  const authModule = await import('../../utils/auth.js');
  await authModule.requireAuthUser(event);
  const { isVeoEnabled } = await import('../../utils/veoAvailability.js');
  return { veoEnabled: isVeoEnabled() };
});
