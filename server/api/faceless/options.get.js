import { DEFAULT_FACELESS_VOICE_ID, FACELESS_VOICES } from '../../data/facelessCatalog.js';
import { FACELESS_DURATIONS } from '../../utils/facelessPlanGenerator.js';

// Options du formulaire "Video faceless" (voix proposees, durees).
export default defineEventHandler(async (event) => {
  const authModule = await import('../../utils/auth.js');
  await authModule.requireAuthUser(event);

  return {
    voices: FACELESS_VOICES,
    defaultVoiceId: DEFAULT_FACELESS_VOICE_ID,
    durations: FACELESS_DURATIONS,
  };
});
