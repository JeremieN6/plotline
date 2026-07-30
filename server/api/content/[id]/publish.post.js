let prismaClient;

function isAbsoluteHttpUrl(value) {
  return /^https?:\/\//i.test(String(value || '').trim());
}

function resolvePublicImageUrl(imageUrl, baseUrl) {
  const raw = String(imageUrl || '').trim();
  const normalizedBase = String(baseUrl || '').replace(/\/$/, '');

  if (!raw) return '';
  if (isAbsoluteHttpUrl(raw)) return raw;
  if (raw.startsWith('/')) return `${normalizedBase}${raw}`;
  return `${normalizedBase}/api/media/${raw}`;
}

async function getPrisma() {
  if (prismaClient) return prismaClient;

  const module = await import('../../../utils/prisma.js');
  prismaClient = module?.prisma || module?.default?.prisma;

  if (!prismaClient) {
    throw new Error('Unable to resolve prisma client from server/utils/prisma.js');
  }

  return prismaClient;
}

function isVideoContent(format) {
  const normalized = String(format || '').trim().toUpperCase();
  return normalized === 'STORY' || normalized === 'REEL';
}

async function waitForInstagramContainerReady({ instagramAccountId, containerId, accessToken }) {
  for (let attempt = 1; attempt <= 20; attempt += 1) {
    const containerStatus = await $fetch(`https://graph.facebook.com/v21.0/${instagramAccountId}/${containerId}`, {
      method: 'GET',
      query: {
        fields: 'status_code',
        access_token: accessToken,
      },
    });

    if (containerStatus?.status_code === 'FINISHED') {
      return containerStatus;
    }

    if (containerStatus?.status_code === 'ERROR') {
      throw new Error('Instagram video container failed to process');
    }

    if (attempt < 20) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }

  throw new Error('Instagram video container did not finish processing in time');
}

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

    const instagramAccountId = content.influencer?.instagramAccountId;
    const instagramAccessToken = content.influencer?.instagramAccessToken;

    if (!instagramAccountId || !instagramAccessToken) {
      return sendError(event, createError({ statusCode: 400, statusMessage: 'Credentials Instagram manquants' }));
    }

    if (!content.imageUrl) {
      return sendError(event, createError({ statusCode: 400, statusMessage: 'Image manquante' }));
    }

    const baseUrl = runtimeConfig.baseUrl || process.env.BASE_URL || 'http://localhost:3000';
    const publicImageUrl = resolvePublicImageUrl(content.imageUrl, baseUrl);
    const useVideoContainer = isVideoContent(content.format);
    const createPayload = useVideoContainer
      ? {
          media_type: 'REELS',
          video_url: publicImageUrl,
          caption: content.caption || '',
          access_token: instagramAccessToken,
        }
      : {
          image_url: publicImageUrl,
          caption: content.caption || '',
          access_token: instagramAccessToken,
        };

    const createResponse = await $fetch(`https://graph.facebook.com/v21.0/${instagramAccountId}/media`, {
      method: 'POST',
      body: new URLSearchParams(createPayload),
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
      },
    });

    const creationId = createResponse?.creation_id || createResponse?.id;
    if (!creationId) {
      return sendError(event, createError({ statusCode: 500, statusMessage: 'Impossible de créer le container Instagram' }));
    }

    if (useVideoContainer) {
      await waitForInstagramContainerReady({
        instagramAccountId,
        containerId: creationId,
        accessToken: instagramAccessToken,
      });
    }

    const publishResponse = await $fetch(`https://graph.facebook.com/v21.0/${instagramAccountId}/media_publish`, {
      method: 'POST',
      body: new URLSearchParams({
        creation_id: creationId,
        access_token: instagramAccessToken,
      }),
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
      },
    });

    const updatedContent = await prisma.generatedContent.update({
      where: { id },
      data: {
        status: 'PUBLISHED',
        publishedAt: new Date(),
      },
      select: {
        id: true,
        status: true,
        publishedAt: true,
        imageUrl: true,
        caption: true,
        platform: true,
        format: true,
      },
    });

    return {
      success: true,
      creationId,
      publishResponse,
      content: updatedContent,
    };
  } catch (err) {
    if (err?.code === 'P2025') {
      return sendError(event, createError({ statusCode: 404, statusMessage: 'Contenu introuvable' }));
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
