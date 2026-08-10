import { processGenerationJob } from '../../../utils/generationWorker.js';
import { resolveVideoModelOrThrow, runVideoGenerationJob } from '../../../utils/videoGeneration.js';

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

function isVideoFormat(format) {
  return String(format || '').trim().toUpperCase() === 'REEL';
}

/**
 * Lance la generation d une idee. Les erreurs sont absorbees: une idee ratee ne
 * doit pas empecher les suivantes d aboutir, et le contenu porte deja son propre
 * statut d echec.
 */
async function generateForItem({ prisma, runtimeConfig, item, profile, withFaceRef }) {
  try {
    if (isVideoFormat(item.format)) {
      const model = resolveVideoModelOrThrow({
        prompt: item.prompt,
        withFaceRef,
        influencer: profile,
        runtimeConfig,
      });

      await runVideoGenerationJob({
        prisma,
        runtimeConfig,
        contentId: item.contentId,
        prompt: item.prompt,
        model,
        withFaceRef,
        influencer: profile,
      });

      return;
    }

    await processGenerationJob({
      influencerId: profile.id,
      workflowType: 'free',
      contentType: String(item.format || 'FEED').toLowerCase(),
      prompt: item.prompt,
      contentId: item.contentId,
      withFaceRef,
    });
  } catch (error) {
    await prisma.generatedContent.updateMany({
      where: { id: item.contentId },
      data: {
        status: 'FAILED',
        errorMessage: String(error?.statusMessage || error?.message || 'Generation impossible'),
      },
    }).catch(() => {});
  }
}

/**
 * Approuve un plan: chaque idee conservee devient un contenu a generer.
 *
 * C est le seul endroit ou le planificateur engage des credits, d ou la revue
 * prealable. La reponse est immediate et la generation se poursuit en tache de
 * fond: attendre dix generations dans une requete HTTP la ferait couper.
 */
export default defineEventHandler(async (event) => {
  try {
    const planId = String(event.context?.params?.id || '').trim();
    if (!planId) {
      return sendError(event, createError({ statusCode: 400, statusMessage: 'Parametre id requis' }));
    }

    const prisma = await getPrisma();
    const authModule = await import('../../../utils/auth.js');
    const user = await authModule.requireAuthUser(event);

    const plan = await prisma.contentPlan.findFirst({
      where: { id: planId, profile: { is: { userId: user.id } } },
      select: {
        id: true,
        status: true,
        campaignId: true,
        profile: {
          select: {
            id: true,
            name: true,
            faceRefPath: true,
            bodyPrompt: true,
            hairPrompt: true,
            identityProfile: true,
            silhouette: true,
            niche: true,
            style: true,
          },
        },
        items: {
          where: { keep: true, contentId: null },
          orderBy: { position: 'asc' },
          select: {
            id: true,
            prompt: true,
            caption: true,
            hashtags: true,
            platform: true,
            format: true,
            scheduledAt: true,
          },
        },
      },
    });

    if (!plan) {
      return sendError(event, createError({ statusCode: 404, statusMessage: 'Plan introuvable' }));
    }

    if (plan.status === 'DISCARDED') {
      return sendError(event, createError({ statusCode: 409, statusMessage: 'Ce plan a ete abandonne' }));
    }

    if (!plan.items.length) {
      return sendError(event, createError({
        statusCode: 409,
        statusMessage: 'Aucune idee a generer: tout a deja ete produit ou ecarte',
      }));
    }

    const profile = plan.profile;
    const withFaceRef = Boolean(String(profile?.faceRefPath || '').trim());

    // On cree d abord tous les contenus et on les relie au plan: si la generation
    // echoue plus loin, on sait deja ce qui a ete engage et on ne le refera pas.
    const prepared = [];
    for (const item of plan.items) {
      const caption = [item.caption, item.hashtags].filter(Boolean).join('\n\n') || null;

      const content = await prisma.generatedContent.create({
        data: {
          influencerId: profile.id,
          campaignId: plan.campaignId || null,
          ambassadorId: withFaceRef ? profile.id : null,
          prompt: item.prompt,
          caption,
          platform: item.platform,
          format: item.format,
          status: 'PROCESSING',
          scheduledAt: item.scheduledAt,
        },
        select: { id: true },
      });

      await prisma.contentPlanItem.update({
        where: { id: item.id },
        data: { contentId: content.id },
      });

      prepared.push({ ...item, contentId: content.id });
    }

    await prisma.contentPlan.update({
      where: { id: plan.id },
      data: { status: 'APPROVED' },
    });

    const runtimeConfig = useRuntimeConfig(event);

    // En serie: dix generations lancees d un coup satureraient les fournisseurs.
    (async () => {
      for (const item of prepared) {
        await generateForItem({ prisma, runtimeConfig, item, profile, withFaceRef });
      }
    })();

    return {
      planId: plan.id,
      status: 'APPROVED',
      launched: prepared.length,
      contentIds: prepared.map((item) => item.contentId),
    };
  } catch (err) {
    if (err?.statusCode) {
      return sendError(event, err);
    }

    return sendError(
      event,
      createError({
        statusCode: 500,
        statusMessage: 'Approbation du plan impossible',
        data: { code: err?.code, message: err?.message },
      }),
    );
  }
});
