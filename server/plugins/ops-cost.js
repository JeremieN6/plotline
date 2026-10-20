import { installOpsCostTracking } from '../utils/opsCost.js';

// Branche une fois la telemetrie de couts LLM (Anthropic + Gemini) vers Sassify Ops.
// Sans effet si OPS_URL / OPS_INGEST_KEY sont absents. Ne doit jamais empecher le serveur de demarrer.
export default defineNitroPlugin(() => {
  try {
    installOpsCostTracking('plotline');
  } catch (error) {
    console.error('[ops-cost] telemetrie desactivee :', error?.message || error);
  }
});
