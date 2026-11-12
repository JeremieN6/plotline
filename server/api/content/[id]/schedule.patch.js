import { canAutoPublish, normalizePlannedPlatforms } from '../../../utils/plannedPlatforms.js';

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

export default defineEventHandler(async (event) => {
  try {
    const id = event.context?.params?.id;
    if (!id) {
      return sendError(event, createError({ statusCode: 400, statusMessage: 'Parametre id requis' }));
    }

    const body = await readBody(event);
    const scheduledAt = String(body?.scheduledAt || '').trim();
    if (!scheduledAt) {
      return sendError(event, createError({ statusCode: 400, statusMessage: 'scheduledAt requis' }));
    }

    const parsedDate = new Date(scheduledAt);
    if (Number.isNaN(parsedDate.getTime())) {
      return sendError(event, createError({ statusCode: 400, statusMessage: 'scheduledAt invalide' }));
    }

    // Publication automatique : seulement si demandee explicitement (true). Absent = on ne change pas le reglage actuel
    // (reprogrammer depuis le calendrier ne doit pas l activer ni le couper).
    let autoPublish = typeof body?.autoPublish === 'boolean' ? body.autoPublish : undefined;

    // Reseaux choisis (repere, sans verification). Absent = on ne change rien. Sans Instagram, pas de publication automatique :
    // le planificateur ne sait publier que sur Instagram.
    const plannedPlatforms = normalizePlannedPlatforms(body?.platforms);
    if (plannedPlatforms && !canAutoPublish(plannedPlatforms)) autoPublish = false;

    const prisma = await getPrisma();

    // Depuis que la date planifiee declenche une publication reelle, cette route
    // ne peut plus rester ouverte: sans ce controle, n importe qui connaissant un
    // identifiant de contenu pourrait provoquer une publication Instagram.
    const authModule = await import('../../../utils/auth.js');
    const user = await authModule.requireAuthUser(event);

    const owned = await prisma.generatedContent.findFirst({
      where: {
        id,
        influencer: {
          is: {
            userId: user.id,
          },
        },
      },
      select: { id: true },
    });

    if (!owned) {
      return sendError(event, createError({ statusCode: 404, statusMessage: 'Contenu introuvable' }));
    }

    const updated = await prisma.generatedContent.update({
      where: { id },
      data: {
        scheduledAt: parsedDate,
        ...(autoPublish === undefined ? {} : { autoPublish }),
        ...(plannedPlatforms ? { plannedPlatforms } : {}),
        // Le planificateur lit `platform` : un contenu destine a TikTok a l origine, planifie sur Instagram avec publication automatique, doit etre publie sur Instagram.
        ...(autoPublish === true && plannedPlatforms && canAutoPublish(plannedPlatforms) ? { platform: 'INSTAGRAM' } : {}),
      },
      select: {
        id: true,
        scheduledAt: true,
        autoPublish: true,
        plannedPlatforms: true,
        status: true,
      },
    });

    return {
      success: true,
      content: updated,
    };
  } catch (err) {
    // Ne pas masquer le 401 de requireAuthUser derriere un 500 generique.
    if (err?.statusCode) {
      return sendError(event, err);
    }

    if (err?.code === 'P2025') {
      return sendError(event, createError({ statusCode: 404, statusMessage: 'Contenu introuvable' }));
    }

    return sendError(
      event,
      createError({
        statusCode: 500,
        statusMessage: 'Planification du contenu impossible',
        data: {
          code: err?.code,
          message: err?.message,
        },
      }),
    );
  }
});
