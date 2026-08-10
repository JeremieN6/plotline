import {
  buildPlanSlots,
  countSlots,
  normalizePostsPerWeek,
  normalizePublishHour,
  parseFormatRotation,
} from '../../utils/contentPlanner.js';
import { generatePlanIdeas } from '../../utils/planIdeaGenerator.js';

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

const MAX_PLAN_DAYS = 60;

/**
 * Cree un plan editorial a l etat DRAFT.
 *
 * La cadence du profil pose les creneaux, Claude ecrit les idees. Aucun media
 * n est produit ici: le plan doit d abord etre relu.
 */
export default defineEventHandler(async (event) => {
  try {
    const prisma = await getPrisma();
    const authModule = await import('../../utils/auth.js');
    const user = await authModule.requireAuthUser(event);
    const body = await readBody(event);

    const profileId = String(body?.profileId || '').trim();
    if (!profileId) {
      return sendError(event, createError({ statusCode: 400, statusMessage: 'profileId requis' }));
    }

    const profile = await prisma.profile.findFirst({
      where: { id: profileId, userId: user.id },
      select: {
        id: true,
        name: true,
        niche: true,
        style: true,
        description: true,
        targetAudience: true,
        postsPerWeek: true,
        formatRotation: true,
        publishHour: true,
        calendarStep: true,
      },
    });

    if (!profile) {
      return sendError(event, createError({ statusCode: 404, statusMessage: 'Profil introuvable' }));
    }

    const campaignId = String(body?.campaignId || '').trim();
    if (campaignId) {
      const campaign = await prisma.campaign.findFirst({
        where: { id: campaignId, userId: user.id },
        select: { id: true },
      });

      if (!campaign) {
        return sendError(event, createError({ statusCode: 404, statusMessage: 'Campagne introuvable' }));
      }
    }

    const requestedDays = Number(body?.days);
    const days = Number.isFinite(requestedDays) && requestedDays > 0
      ? Math.min(Math.floor(requestedDays), MAX_PLAN_DAYS)
      : 7;

    const requestedStart = body?.startDate ? new Date(body.startDate) : new Date();
    const startDate = Number.isNaN(requestedStart.getTime()) ? new Date() : requestedStart;

    // La cadence du profil fait foi; le corps de requete ne peut que la surcharger
    // ponctuellement pour ce plan, sans la modifier durablement.
    const postsPerWeek = normalizePostsPerWeek(body?.postsPerWeek ?? profile.postsPerWeek);
    const publishHour = normalizePublishHour(body?.publishHour ?? profile.publishHour);
    const formatRotation = parseFormatRotation(body?.formatRotation ?? profile.formatRotation);

    const slots = buildPlanSlots({
      startDate,
      days,
      postsPerWeek,
      formatRotation,
      publishHour,
      // La rotation reprend ou le profil l avait laissee.
      rotationOffset: Math.max(0, Number(profile.calendarStep || 1) - 1),
    });

    const runtimeConfig = useRuntimeConfig(event);
    const { items, usedFallback, reason } = await generatePlanIdeas({
      profile,
      slots,
      apiKey: runtimeConfig.anthropicApiKey,
    });

    const plan = await prisma.contentPlan.create({
      data: {
        profileId: profile.id,
        campaignId: campaignId || null,
        status: 'DRAFT',
        startDate,
        days,
        items: {
          create: items.map((item) => ({
            position: item.position,
            prompt: item.prompt,
            caption: item.caption || null,
            hashtags: item.hashtags || null,
            platform: item.platform,
            format: item.format,
            scheduledAt: item.scheduledAt,
          })),
        },
      },
      select: {
        id: true,
        status: true,
        startDate: true,
        days: true,
        items: {
          orderBy: { position: 'asc' },
          select: {
            id: true,
            position: true,
            prompt: true,
            caption: true,
            hashtags: true,
            platform: true,
            format: true,
            scheduledAt: true,
            keep: true,
            contentId: true,
          },
        },
      },
    });

    // On avance le curseur de rotation pour que le prochain plan ne redemarre
    // pas sur le meme format.
    await prisma.profile.update({
      where: { id: profile.id },
      data: { calendarStep: Number(profile.calendarStep || 1) + slots.length },
    }).catch(() => {});

    return { plan, usedFallback, reason: reason || null };
  } catch (err) {
    if (err?.statusCode) {
      return sendError(event, err);
    }

    const message = String(err?.message || '').toLowerCase();
    if (err?.code === 'P2021' || message.includes('contentplan')) {
      return sendError(event, createError({
        statusCode: 503,
        statusMessage: 'Migration du planificateur non appliquee sur cette base',
      }));
    }

    return sendError(
      event,
      createError({
        statusCode: 500,
        statusMessage: 'Creation du plan impossible',
        data: { code: err?.code, message: err?.message },
      }),
    );
  }
});
