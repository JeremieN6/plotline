import { generateScenarioScript } from '../../utils/scenarioScriptGenerator.js';

/**
 * Transforme une idee libre en scene + script exploitables, pour le widget
 * Studio "Video Scenario". Endpoint separe de resolve.post.js : celui-ci fait
 * un vrai appel Claude (cout, latence, echec possible), la ou resolve.post.js
 * reste une pure substitution de texte synchrone.
 */
export default defineEventHandler(async (event) => {
  try {
    const authModule = await import('../../utils/auth.js');
    await authModule.requireAuthUser(event);

    const runtimeConfig = useRuntimeConfig(event);
    const body = await readBody(event);
    const idee = String(body?.idee || '').trim();

    if (!idee) {
      return sendError(event, createError({ statusCode: 400, statusMessage: 'idee requise' }));
    }

    const { scenePrompt, scriptText } = await generateScenarioScript({
      idee,
      apiKey: runtimeConfig.anthropicApiKey,
    });

    return { scenePrompt, scriptText };
  } catch (err) {
    if (err?.statusCode) throw err;
    return sendError(event, createError({ statusCode: 500, statusMessage: err?.message || 'Erreur serveur', data: err }));
  }
});
