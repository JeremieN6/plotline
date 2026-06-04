import { startGenerationWorker } from '../utils/generationWorker.js';

export default defineNitroPlugin(() => {
  try {
    startGenerationWorker();
  } catch (error) {
    console.error('[worker-plugin] Failed to start generation worker:', error);
  }
});
