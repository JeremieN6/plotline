import { publishContentToInstagram } from '../../../utils/instagramPublisher.js';

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

// Les echecs previsibles de la publication portent un code metier: on le traduit
// en statut HTTP plutot que de tout remonter en 500.
const ERROR_STATUS_BY_CODE = {
  MISSING_CREDENTIALS: 400,
  MISSING_MEDIA: 400,
};

export default defineEventHandler(async (event) => {
  try {
    const id = event.context?.params?.id;
    if (!id) {
      return sendError(event, createError({ statusCode: 400, statusMessage: 'Parametre id requis' }));
    }

    const prisma = await getPrisma();
    const authModule = await import('../../../utils/auth.js');
    const user = await authModule.requireAuthUser(event);
    const runtimeConfig = useRuntimeConfig();

    const content = await prisma.generatedContent.findFirst({
      where: {
        id,
        influencer: {
          is: {
            userId: user.id,
          },
        },
      },
      select: {
        id: true,
        imageUrl: true,
        caption: true,
        status: true,
        format: true,
        influencer: {
          select: {
            instagramAccountId: true,
            instagramAccessToken: true,
          },
        },
      },
    });

    if (!content) {
      return sendError(event, createError({ statusCode: 404, statusMessage: 'Contenu introuvable' }));
    }

    if (content.status !== 'VALIDATED') {
      return sendError(event, createError({ statusCode: 403, statusMessage: 'Le contenu doit être validé avant publication' }));
    }

    const baseUrl = runtimeConfig.baseUrl || process.env.BASE_URL || 'http://localhost:3000';
    const result = await publishContentToInstagram({ prisma, content, baseUrl });

    return {
      success: true,
      creationId: result.creationId,
      publishResponse: result.publishResponse,
      content: result.content,
    };
  } catch (err) {
    if (err?.code === 'P2025') {
      return sendError(event, createError({ statusCode: 404, statusMessage: 'Contenu introuvable' }));
    }

    const mappedStatus = ERROR_STATUS_BY_CODE[String(err?.code || '')];
    if (mappedStatus) {
      return sendError(event, createError({ statusCode: mappedStatus, statusMessage: err.message }));
    }

    return sendError(
      event,
      createError({
        statusCode: 500,
        statusMessage: 'Publication Instagram impossible',
        data: {
          code: err?.code,
          message: err?.message,
        },
      }),
    );
  }
});
