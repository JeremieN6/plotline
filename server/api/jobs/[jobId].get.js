import { shouldUseQueue } from '../../utils/queueMode.js';

function mapJobStatus(state) {
  if (state === 'completed') return 'completed';
  if (state === 'failed') return 'failed';
  return 'processing';
}

export default defineEventHandler(async (event) => {
  try {
    if (!shouldUseQueue()) {
      return sendError(
        event,
        createError({
          statusCode: 400,
          statusMessage: 'USE_QUEUE est desactive, aucun job BullMQ a consulter',
        }),
      );
    }

    const jobId = event.context?.params?.jobId;
    if (!jobId) {
      return sendError(event, createError({ statusCode: 400, statusMessage: 'Parametre jobId requis' }));
    }

    const { getGenerationQueue } = await import('../../utils/queue.js');
    const queue = getGenerationQueue();
    const job = await queue.getJob(jobId);
    if (!job) {
      return sendError(event, createError({ statusCode: 404, statusMessage: 'Job introuvable' }));
    }

    const state = await job.getState();

    return {
      status: mapJobStatus(state),
      contentId: job.returnvalue?.contentId || job.data?.contentId || null,
      progress: job.progress || 0,
      errorMessage: state === 'failed' ? job.failedReason || 'Generation echouee' : null,
    };
  } catch (err) {
    return sendError(
      event,
      createError({
        statusCode: 500,
        statusMessage: 'Recuperation du job impossible',
        data: {
          code: err?.code,
          message: err?.message,
        },
      }),
    );
  }
});
