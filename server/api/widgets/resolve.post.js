import { getWidgetById } from '../../data/widgets.js';
import { resolveWidgetPrompt } from '../../utils/widgetEngine.js';
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
 * Resout un widget en prompt final. Ne declenche AUCUNE generation -- juste
 * la substitution de texte, avant que le client appelle /api/generate/image
 * ou /api/generate/video comme le fait deja le flux "Prompt libre" du Studio.
 */
export default defineEventHandler(async (event) => {
  try {
    const authModule = await import('../../utils/auth.js');
    const user = await authModule.requireAuthUser(event);
    const prisma = await getPrisma();
    const body = await readBody(event);

    const widget = getWidgetById(body?.widgetId);
    if (!widget) {
      return sendError(event, createError({ statusCode: 400, statusMessage: 'widgetId invalide' }));
    }

    const inputs = body?.inputs && typeof body.inputs === 'object' ? body.inputs : {};

    let personaDescription = '';
    let persona = null;

    if (widget.requiresPersona) {
      const profileId = String(body?.profileId || '').trim();
      if (!profileId) {
        return sendError(event, createError({ statusCode: 400, statusMessage: 'profileId requis pour ce widget' }));
      }

      persona = await findPersonaCompatible(prisma, profileId, user.id);
      if (!persona) {
        return sendError(event, createError({ statusCode: 404, statusMessage: 'Persona introuvable' }));
      }

      if (!String(persona.faceRefPath || '').trim()) {
        return sendError(event, createError({ statusCode: 400, statusMessage: 'La persona choisie n a pas de face ref' }));
      }

      personaDescription = buildPersonaDescription(persona);
    }

    const { finalPrompt } = resolveWidgetPrompt(widget, { personaDescription, inputs });

    return {
      finalPrompt,
      widgetId: widget.id,
      typeGeneration: widget.typeGeneration,
      personaFaceRefPath: persona?.faceRefPath || null,
    };
  } catch (err) {
    if (err?.statusCode) throw err;
    return sendError(event, createError({ statusCode: 500, statusMessage: 'Erreur serveur', data: err }));
  }
});
