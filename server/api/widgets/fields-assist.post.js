import { getWidgetById } from '../../data/widgets.js';
import { generateWidgetFields } from '../../utils/widgetFieldsAssistGenerator.js';
import { buildPersonaDescription } from '../../utils/personaDescription.js';
import { findPersonaCompatible } from '../../utils/personaLookup.js';

let prismaClient;

async function getPrisma() {
  if (prismaClient) return prismaClient;
  const module = await import('../../utils/prisma.js');
  prismaClient = module?.prisma || module?.default?.prisma;
  if (!prismaClient) {
    throw new Error('Unable to resolve prisma client from server/utils/prisma.js');
  }
  return prismaClient;
}

/**
 * Transforme une idee libre en valeurs pour tous les champs texte d'un
 * widget Studio, quel qu'il soit. Endpoint separe de resolve.post.js : celui-ci
 * fait un vrai appel Claude (cout, latence, echec possible), la ou
 * resolve.post.js reste une pure substitution de texte synchrone.
 */
export default defineEventHandler(async (event) => {
  try {
    const authModule = await import('../../utils/auth.js');
    const user = await authModule.requireAuthUser(event);

    const runtimeConfig = useRuntimeConfig(event);
    const body = await readBody(event);
    const idea = String(body?.idea || '').trim();
    const profileId = String(body?.profileId || '').trim();

    const widget = getWidgetById(body?.widgetId);
    if (!widget) {
      return sendError(event, createError({ statusCode: 400, statusMessage: 'widgetId invalide' }));
    }
    if (!idea) {
      return sendError(event, createError({ statusCode: 400, statusMessage: 'idea requise' }));
    }

    let personaDescription = '';
    if (widget.requiresPersona && profileId) {
      const prisma = await getPrisma();
      const persona = await findPersonaCompatible(prisma, profileId, user.id);
      if (persona) {
        personaDescription = buildPersonaDescription(persona);
      }
    }

    const fields = await generateWidgetFields({
      widget,
      idea,
      personaDescription,
      apiKey: runtimeConfig.anthropicApiKey,
    });

    return { fields };
  } catch (err) {
    if (err?.statusCode) throw err;
    return sendError(event, createError({ statusCode: 500, statusMessage: err?.message || 'Erreur serveur', data: err }));
  }
});
