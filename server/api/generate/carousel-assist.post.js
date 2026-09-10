import { generateCarouselSlides, CAROUSEL_ASSIST_MIN, CAROUSEL_ASSIST_MAX } from '../../utils/carouselAssistGenerator.js';
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
 * Transforme une idee libre en une serie de prompts de slides de carrousel,
 * Claude decidant lui-meme du nombre de slides pertinent (borne 2-10, memes
 * valeurs que CAROUSEL_MIN_PROMPTS/CAROUSEL_MAX_PROMPTS cote client).
 */
export default defineEventHandler(async (event) => {
  try {
    const authModule = await import('../../utils/auth.js');
    const user = await authModule.requireAuthUser(event);

    const runtimeConfig = useRuntimeConfig(event);
    const body = await readBody(event);
    const idea = String(body?.idea || '').trim();
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

    const slides = await generateCarouselSlides({
      idea,
      personaDescription,
      apiKey: runtimeConfig.anthropicApiKey,
      min: CAROUSEL_ASSIST_MIN,
      max: CAROUSEL_ASSIST_MAX,
    });

    return { slides };
  } catch (err) {
    if (err?.statusCode) throw err;
    return sendError(event, createError({ statusCode: 500, statusMessage: err?.message || 'Erreur serveur', data: err }));
  }
});
