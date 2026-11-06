import { buildManualUnpublishData } from '../../../utils/manualPublication.js';

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

// Annule une publication marquee a la main : le contenu redevient « Valide » (sauf s il a aussi ete publie par
// l outil), sa date et sa plateforme sont effacees. Un carrousel est annule en entier.
export default defineEventHandler(async (event) => {
  try {
    const id = event.context?.params?.id;
    if (!id) {
      return sendError(event, createError({ statusCode: 400, statusMessage: 'Parametre id requis' }));
    }

    const prisma = await getPrisma();
    const authModule = await import('../../../utils/auth.js');
    const user = await authModule.requireAuthUser(event);

    const select = { id: true, influencerId: true, carouselId: true, publishedAt: true, twitterPublishedAt: true, manualPublication: true };
    const content = await prisma.generatedContent.findFirst({
      where: { id, influencer: { is: { userId: user.id } } },
      select,
    });

    if (!content) {
      return sendError(event, createError({ statusCode: 404, statusMessage: 'Contenu introuvable' }));
    }

    if (!buildManualUnpublishData(content)) {
      return sendError(event, createError({ statusCode: 409, statusMessage: 'Ce contenu n’a pas été marqué comme publié à la main.' }));
    }

    const slides = content.carouselId
      ? await prisma.generatedContent.findMany({
        where: { carouselId: content.carouselId, influencerId: content.influencerId },
        select,
      })
      : [content];

    await prisma.$transaction(slides
      .map((slide) => ({ slide, data: buildManualUnpublishData(slide) }))
      .filter((entry) => entry.data)
      .map(({ slide, data }) => prisma.generatedContent.update({ where: { id: slide.id }, data, select: { id: true } })));

    return { success: true };
  } catch (err) {
    if (err?.statusCode) {
      return sendError(event, err);
    }

    return sendError(
      event,
      createError({
        statusCode: 500,
        statusMessage: 'Annulation de la publication impossible',
        data: { code: err?.code, message: err?.message },
      }),
    );
  }
});
