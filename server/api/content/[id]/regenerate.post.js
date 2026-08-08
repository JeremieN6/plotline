import { processGenerationJob } from '../../../utils/generationWorker.js';
import { isSupportedVideoModel, resolveVideoModelOrThrow, runVideoGenerationJob } from '../../../utils/videoGeneration.js';

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

function shouldUseQueue() {
  const rawValue = String(process.env.USE_QUEUE || '').trim().toLowerCase();
  return rawValue === 'true' || rawValue === '1' || rawValue === 'yes';
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
    const body = await readBody(event);

    const content = await prisma.generatedContent.findUnique({
      where: { id },
      select: {
        id: true,
        influencerId: true,
        ambassadorId: true,
        format: true,
        status: true,
        prompt: true,
        influencer: {
          select: {
            id: true,
            userId: true,
            faceRefPath: true,
          },
        },
      },
    });

    if (!content) {
      return sendError(event, createError({ statusCode: 404, statusMessage: 'Contenu introuvable' }));
    }

    if (String(content.influencer?.userId || '') !== String(user.id || '')) {
      return sendError(event, createError({ statusCode: 403, statusMessage: 'Accès refusé' }));
    }

    if (content.status !== 'PENDING') {
      return sendError(event, createError({ statusCode: 409, statusMessage: 'Seul un contenu en attente peut être modifié' }));
    }

    const nextPrompt = typeof body?.prompt === 'string' && body.prompt.trim()
      ? body.prompt.trim()
      : String(content.prompt || '').trim();

    if (!nextPrompt) {
      return sendError(event, createError({ statusCode: 400, statusMessage: 'prompt requis' }));
    }

    // Modele impose depuis "Modifier". Vide ou "auto" = detection automatique.
    const requestedModel = String(body?.model || '').trim().toLowerCase();
    if (requestedModel && requestedModel !== 'auto' && !isSupportedVideoModel(requestedModel)) {
      return sendError(event, createError({ statusCode: 400, statusMessage: 'Modele video invalide' }));
    }

    // On conserve imageUrl/caption jusqu a ce que le nouveau rendu aboutisse:
    // en cas d echec, l ancien visuel reste affiche au lieu de disparaitre.
    // La generation ecrasera ces champs elle-meme en cas de succes.
    await prisma.generatedContent.update({
      where: { id },
      data: {
        status: 'PROCESSING',
        errorMessage: null,
        prompt: nextPrompt,
      },
    });

    const withFaceRef = Boolean(content.ambassadorId);
    const isVideo = String(content.format || '').trim().toUpperCase() === 'REEL';

    try {
      if (isVideo) {
        const runtimeConfig = useRuntimeConfig(event);
        const model = resolveVideoModelOrThrow({
          prompt: nextPrompt,
          withFaceRef,
          influencer: content.influencer,
          runtimeConfig,
          forcedModel: requestedModel,
        });

        const result = await runVideoGenerationJob({
          prisma,
          runtimeConfig,
          contentId: id,
          prompt: nextPrompt,
          model,
          influencerId: content.influencerId,
          withFaceRef,
          influencer: content.influencer,
        });

        return { contentId: id, status: result.status === 'completed' ? 'completed' : 'processing' };
      }

      const jobPayload = {
        influencerId: content.influencerId,
        workflowType: 'free',
        contentType: 'feed',
        prompt: nextPrompt,
        contentId: id,
        withFaceRef,
      };

      if (!shouldUseQueue()) {
        await processGenerationJob(jobPayload);
        return { contentId: id, status: 'completed' };
      }

      const { getGenerationQueue } = await import('../../../utils/queue.js');
      const queue = getGenerationQueue();
      await queue.add('generate-image', jobPayload, {
        removeOnComplete: 100,
        removeOnFail: 100,
      });

      return { contentId: id, status: 'processing' };
    } catch (err) {
      const errorMessage = err?.statusMessage || err?.message || 'Régénération impossible';
      await prisma.generatedContent.update({
        where: { id },
        data: { status: 'FAILED', errorMessage },
      }).catch(() => {});

      throw err;
    }
  } catch (err) {
    if (err?.statusCode) {
      return sendError(event, err);
    }

    return sendError(
      event,
      createError({
        statusCode: 500,
        statusMessage: 'Régénération impossible',
        data: {
          code: err?.code,
          message: err?.message,
        },
      }),
    );
  }
});
