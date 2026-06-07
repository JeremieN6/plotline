import { startGenerationWorker } from '../utils/generationWorker.js';

export default defineNitroPlugin(() => {
  try {
    const useQueue = String(process.env.USE_QUEUE || '').trim().toLowerCase();
    if (!['true', '1', 'yes'].includes(useQueue)) {
      return;
    }

    startGenerationWorker();
  } catch (error) {
    console.error('[worker-plugin] Failed to start generation worker:', error);
  }
});
