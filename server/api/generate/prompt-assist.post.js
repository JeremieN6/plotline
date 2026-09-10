import { generateAssistedPrompt } from '../../utils/promptAssistGenerator.js';
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
 * Transforme une idee libre en prompt de generation detaille, pour le flux
 * "Prompt libre" (image ou video) du Studio. Le persona n'est decrit a
 * Claude que si l'identite doit rester verrouillee (profileId fourni) --
 * sinon le modele doit rester libre d'inventer qui apparait a l'ecran.
 */
export default defineEventHandler(async (event) => {
  try {
    const authModule = await import('../../utils/auth.js');
    const user = await authModule.requireAuthUser(event);

    const runtimeConfig = useRuntimeConfig(event);
    const body = await readBody(event);
    const idea = String(body?.idea || '').trim();
    const mediaType = body?.mediaType === 'video' ? 'video' : 'image';
    const profileId = String(body?.profileId || '').trim();

    if (!idea) {
      return sendError(event, createError({ statusCode: 400, statusMessage: 'idea requise' }));
    }

    let personaDescription = '';
    if (profileId) {
      const prisma = await getPrisma();
      const persona = await findPersonaCompatible(prisma, profileId, user.id);
      if (persona) {
        personaDescription = buildPersonaDescription(persona);
      }
    }

    const { prompt } = await generateAssistedPrompt({
      idea,
      mediaType,
      personaDescription,
      identityLocked: Boolean(profileId && personaDescription),
      apiKey: runtimeConfig.anthropicApiKey,
    });

    return { prompt };
  } catch (err) {
    if (err?.statusCode) throw err;
    return sendError(event, createError({ statusCode: 500, statusMessage: err?.message || 'Erreur serveur', data: err }));
  }
});
