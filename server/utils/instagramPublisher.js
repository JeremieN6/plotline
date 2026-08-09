/**
 * Publication Instagram, extraite de la route HTTP pour etre appelable des deux
 * cotes: l action manuelle de l utilisateur et le publicateur planifie, qui n a
 * pas d event HTTP a sa disposition.
 */

const GRAPH_API_BASE = 'https://graph.facebook.com/v21.0';
const CONTAINER_POLL_ATTEMPTS = 20;
const CONTAINER_POLL_INTERVAL_MS = 3000;

function isHttpUrl(value) {
  return /^https?:\/\//i.test(String(value || '').trim());
}

/** Instagram telecharge le media lui-meme: l URL doit etre publique et absolue. */
export function resolvePublicMediaUrl(mediaUrl, baseUrl) {
  const raw = String(mediaUrl || '').trim();
  const normalizedBase = String(baseUrl || '').replace(/\/$/, '');

  if (!raw) return '';
  if (isHttpUrl(raw)) return raw;
  if (raw.startsWith('/')) return `${normalizedBase}${raw}`;
  return `${normalizedBase}/api/media/${raw}`;
}

function isVideoFormat(format) {
  const normalized = String(format || '').trim().toUpperCase();
  return normalized === 'STORY' || normalized === 'REEL';
}

/**
 * Erreur porteuse d un code metier, pour que l appelant decide du statut HTTP
 * ou, cote planifie, de la pertinence d une nouvelle tentative.
 */
function publishError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

async function waitForContainerReady({ instagramAccountId, containerId, accessToken }) {
  for (let attempt = 1; attempt <= CONTAINER_POLL_ATTEMPTS; attempt += 1) {
    const containerStatus = await $fetch(`${GRAPH_API_BASE}/${instagramAccountId}/${containerId}`, {
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
      throw publishError('Le container video Instagram a echoue au traitement', 'CONTAINER_ERROR');
    }

    if (attempt < CONTAINER_POLL_ATTEMPTS) {
      await new Promise((resolve) => setTimeout(resolve, CONTAINER_POLL_INTERVAL_MS));
    }
  }

  throw publishError('Le container video Instagram n a pas fini d etre traite a temps', 'CONTAINER_TIMEOUT');
}

/**
 * Publie un contenu deja valide. Ne verifie ni l authentification ni la
 * propriete du contenu: c est a l appelant de l avoir fait.
 */
export async function publishContentToInstagram({ prisma, content, baseUrl }) {
  const instagramAccountId = content?.influencer?.instagramAccountId;
  const instagramAccessToken = content?.influencer?.instagramAccessToken;

  if (!instagramAccountId || !instagramAccessToken) {
    throw publishError('Credentials Instagram manquants', 'MISSING_CREDENTIALS');
  }

  if (!content?.imageUrl) {
    throw publishError('Media manquant', 'MISSING_MEDIA');
  }

  const publicMediaUrl = resolvePublicMediaUrl(content.imageUrl, baseUrl);
  const useVideoContainer = isVideoFormat(content.format);

  const createPayload = useVideoContainer
    ? {
        media_type: 'REELS',
        video_url: publicMediaUrl,
        caption: content.caption || '',
        access_token: instagramAccessToken,
      }
    : {
        image_url: publicMediaUrl,
        caption: content.caption || '',
        access_token: instagramAccessToken,
      };

  const createResponse = await $fetch(`${GRAPH_API_BASE}/${instagramAccountId}/media`, {
    method: 'POST',
    body: new URLSearchParams(createPayload),
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
    },
  });

  const creationId = createResponse?.creation_id || createResponse?.id;
  if (!creationId) {
    throw publishError('Impossible de creer le container Instagram', 'CONTAINER_CREATION_FAILED');
  }

  if (useVideoContainer) {
    await waitForContainerReady({
      instagramAccountId,
      containerId: creationId,
      accessToken: instagramAccessToken,
    });
  }

  const publishResponse = await $fetch(`${GRAPH_API_BASE}/${instagramAccountId}/media_publish`, {
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
    where: { id: content.id },
    data: {
      status: 'PUBLISHED',
      publishedAt: new Date(),
      errorMessage: null,
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

  return { creationId, publishResponse, content: updatedContent };
}
