import { buildManualPublishData, isManualPublicationInputError, parseManualPublishInput } from '../../../utils/manualPublication.js';

let prismaClient;

async function getPrisma() {
  if (prismaClient) return prismaClient;

  const module = await import('../../../utils/prisma.js');
  prismaClient = module?.prisma || module?.default?.prisma;

  if (!prismaClient) {
    throw new Error('Unable to resolve prisma client from server/utils/prisma.js');
  }

  return prismaClient;
}

// Marque comme « publie » un contenu poste A LA MAIN (hors de l outil) : date reelle + plateformes.
// Un carrousel est marque en entier ; seule sa couverture porte la date (une seule puce au calendrier).
export default defineEventHandler(async (event) => {
  try {
    const id = event.context?.params?.id;
    if (!id) {
      return sendError(event, createError({ statusCode: 400, statusMessage: 'Parametre id requis' }));
    }

    const prisma = await getPrisma();
    const authModule = await import('../../../utils/auth.js');
    const user = await authModule.requireAuthUser(event);

    let input;
    try {
      input = parseManualPublishInput(await readBody(event));
    } catch (error) {
      if (isManualPublicationInputError(error)) {
        return sendError(event, createError({ statusCode: 400, statusMessage: error.userMessage }));
      }
      throw error;
    }

    const content = await prisma.generatedContent.findFirst({
      where: { id, influencer: { is: { userId: user.id } } },
      select: {
        id: true,
        influencerId: true,
        status: true,
        carouselId: true,
        carouselPosition: true,
        publishedAt: true,
        twitterPublishedAt: true,
      },
    });

    if (!content) {
      return sendError(event, createError({ statusCode: 404, statusMessage: 'Contenu introuvable' }));
    }

    if (content.status !== 'VALIDATED') {
      return sendError(event, createError({ statusCode: 409, statusMessage: 'Seul un contenu validé peut être marqué comme publié.' }));
    }

    const slides = content.carouselId
      ? await prisma.generatedContent.findMany({
        where: { carouselId: content.carouselId, influencerId: content.influencerId, status: 'VALIDATED' },
        select: { id: true, carouselPosition: true, publishedAt: true, twitterPublishedAt: true },
      })
      : [content];

    const coverId = [...slides].sort((a, b) => Number(a.carouselPosition || 0) - Number(b.carouselPosition || 0))[0]?.id;

    await prisma.$transaction(slides.map((slide) => prisma.generatedContent.update({
      where: { id: slide.id },
      data: buildManualPublishData(slide, input, { isCover: slide.id === coverId }),
      select: { id: true },
    })));

    return { success: true, publishedAt: input.at.toISOString(), platforms: input.platforms };
  } catch (err) {
    // Ne pas masquer le 401 de requireAuthUser derriere un 500 generique.
    if (err?.statusCode) {
      return sendError(event, err);
    }

    return sendError(
      event,
      createError({
        statusCode: 500,
        statusMessage: 'Enregistrement de la publication impossible',
        data: { code: err?.code, message: err?.message },
      }),
    );
  }
});
