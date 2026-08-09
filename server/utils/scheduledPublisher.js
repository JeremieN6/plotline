import { publishContentToInstagram } from './instagramPublisher.js';

/**
 * Publication des contenus arrives a leur date planifiee.
 *
 * Jusqu ici `scheduledAt` etait ecrit par la route de planification et affiche
 * dans le calendrier, mais personne ne le relisait: planifier ne publiait rien.
 */

// Nombre de contenus traites par passage. Les publier en serie (et non en
// parallele) evite de saturer l API Graph, et un container video peut prendre
// jusqu a une minute a lui seul.
const MAX_PUBLICATIONS_PER_RUN = 5;

// Au dela, on cesse de reessayer automatiquement et on marque le contenu en
// echec: mieux vaut un echec visible qu une boucle silencieuse sur l API Graph.
const MAX_ATTEMPTS_PER_CONTENT = 3;

// Compteur en memoire du process: volontairement non persiste, un redemarrage
// redonne donc sa chance a un contenu. On veut seulement eviter de marteler
// l API tant que le process tourne.
const attemptsByContentId = new Map();

const CONTENT_SELECT = {
  id: true,
  caption: true,
  imageUrl: true,
  format: true,
  platform: true,
  scheduledAt: true,
  influencer: {
    select: {
      instagramAccountId: true,
      instagramAccessToken: true,
    },
  },
};

/**
 * TikTok est une valeur de plateforme valide en base mais n a aucune route de
 * publication: on le dit explicitement plutot que de laisser le contenu attendre
 * indefiniment une publication qui n arrivera jamais.
 */
export function resolvePublishTarget(platform) {
  const normalized = String(platform || '').trim().toUpperCase();

  if (normalized === 'INSTAGRAM' || normalized === 'BOTH') {
    return { supported: true, target: 'instagram' };
  }

  if (normalized === 'TIKTOK') {
    return {
      supported: false,
      reason: 'La publication automatique TikTok n est pas disponible: publiez depuis l application TikTok.',
    };
  }

  return { supported: false, reason: `Plateforme de publication inconnue: ${platform}` };
}

/** Une panne reseau merite une nouvelle tentative, pas une config manquante. */
export function isRetryableFailure(error) {
  const permanentCodes = new Set([
    'MISSING_CREDENTIALS',
    'MISSING_MEDIA',
    'CONTAINER_ERROR',
    'CONTAINER_CREATION_FAILED',
  ]);

  return !permanentCodes.has(String(error?.code || ''));
}

export function describePublishFailure(error) {
  const message = String(error?.message || '').trim();
  return message || 'Publication planifiee impossible';
}

/** Contenus valides dont l heure de publication est passee. */
export async function findDuePublications(prisma, now = new Date()) {
  return await prisma.generatedContent.findMany({
    where: {
      status: 'VALIDATED',
      publishedAt: null,
      scheduledAt: { not: null, lte: now },
    },
    orderBy: { scheduledAt: 'asc' },
    take: MAX_PUBLICATIONS_PER_RUN,
    select: CONTENT_SELECT,
  });
}

/**
 * Prend la main sur un contenu de facon atomique en vidant `scheduledAt`.
 * Deux processus qui tournent en meme temps ne peuvent pas le publier deux fois:
 * le second verra `count === 0`. La date est restauree juste apres la tentative,
 * car le calendrier positionne les contenus dessus, y compris une fois publies.
 */
async function claimScheduledContent(prisma, content) {
  const claim = await prisma.generatedContent.updateMany({
    where: {
      id: content.id,
      status: 'VALIDATED',
      publishedAt: null,
      scheduledAt: { not: null },
    },
    data: { scheduledAt: null },
  });

  return claim.count === 1;
}

/**
 * Restaure la date planifiee prise en snapshot AVANT la prise de main. On ne
 * relit jamais `content.scheduledAt` ici: la prise de main vient justement de le
 * vider, et s y fier reviendrait a effacer la planification pour de bon.
 */
async function releaseScheduledContent(prisma, contentId, scheduledAt, data = {}) {
  await prisma.generatedContent.update({
    where: { id: contentId },
    data: { scheduledAt, ...data },
  }).catch(() => {});
}

async function publishOne(prisma, content, baseUrl, scheduledAt) {
  const target = resolvePublishTarget(content.platform);

  if (!target.supported) {
    await releaseScheduledContent(prisma, content.id, scheduledAt, {
      status: 'FAILED',
      errorMessage: target.reason,
    });
    return { id: content.id, outcome: 'unsupported', reason: target.reason };
  }

  try {
    await publishContentToInstagram({ prisma, content, baseUrl });
    attemptsByContentId.delete(content.id);

    // Le contenu est deja passe en PUBLISHED: on ne remet que la date planifiee.
    await releaseScheduledContent(prisma, content.id, scheduledAt);
    return { id: content.id, outcome: 'published' };
  } catch (error) {
    const attempts = (attemptsByContentId.get(content.id) || 0) + 1;
    attemptsByContentId.set(content.id, attempts);

    const errorMessage = describePublishFailure(error);
    const giveUp = !isRetryableFailure(error) || attempts >= MAX_ATTEMPTS_PER_CONTENT;

    await releaseScheduledContent(prisma, content.id, scheduledAt, {
      errorMessage,
      ...(giveUp ? { status: 'FAILED' } : {}),
    });

    if (giveUp) {
      attemptsByContentId.delete(content.id);
    }

    return { id: content.id, outcome: giveUp ? 'failed' : 'retry', reason: errorMessage };
  }
}

/**
 * Un seul passage. Ne leve jamais: l appelant est une boucle de fond ou un cron,
 * qui ne doivent pas s arreter parce qu une publication a echoue.
 */
export async function runScheduledPublications({ prisma, baseUrl, now = new Date() }) {
  const results = [];

  try {
    const dueContents = await findDuePublications(prisma, now);

    for (const content of dueContents) {
      // Snapshot avant la prise de main, qui vide `scheduledAt` en base.
      const scheduledAt = content.scheduledAt;

      const claimed = await claimScheduledContent(prisma, content);
      if (!claimed) {
        continue;
      }

      results.push(await publishOne(prisma, content, baseUrl, scheduledAt));
    }
  } catch (error) {
    return {
      checked: results.length,
      results,
      error: describePublishFailure(error),
    };
  }

  return { checked: results.length, results };
}
