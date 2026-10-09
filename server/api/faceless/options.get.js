import { DEFAULT_FACELESS_VOICE_ID, FACELESS_VOICES } from '../../data/facelessCatalog.js';
import { AVATAR_PACK_CATALOG, IMAGE_COST_USD } from '../../data/facelessAvatarCatalog.js';
import {
  FACELESS_ACCESSORIES,
  FACELESS_BACKGROUNDS,
  FACELESS_CAPTION_STYLES,
  FACELESS_CARD_STYLES,
  FACELESS_DENSITIES,
  FACELESS_ENTERS,
  FACELESS_FONTS,
  FACELESS_HAIR_STYLES,
  FACELESS_MOTIONS,
  FACELESS_PALETTE_KEYS,
  FACELESS_PRESETS,
} from '../../data/facelessThemes.js';
import { FACELESS_DURATIONS } from '../../utils/facelessPlanGenerator.js';
import { defaultFacelessStyle } from '../../utils/facelessStyle.js';

const labelled = (obj) => Object.entries(obj).map(([value, label]) => ({ value, label }));

// Options du formulaire "Video faceless" et de la page "Direction artistique".
export default defineEventHandler(async (event) => {
  const authModule = await import('../../utils/auth.js');
  await authModule.requireAuthUser(event);

  return {
    voices: FACELESS_VOICES,
    defaultVoiceId: DEFAULT_FACELESS_VOICE_ID,
    durations: FACELESS_DURATIONS,
    presets: Object.entries(FACELESS_PRESETS).map(([key, preset]) => ({
      key,
      label: preset.label,
      description: preset.description,
      style: defaultFacelessStyle(key, 'FEMALE'),
    })),
    fonts: Object.entries(FACELESS_FONTS).map(([value, font]) => ({ value, label: font.label })),
    cardStyles: labelled(FACELESS_CARD_STYLES),
    backgrounds: labelled(FACELESS_BACKGROUNDS),
    motions: labelled(FACELESS_MOTIONS),
    captionStyles: labelled(FACELESS_CAPTION_STYLES),
    densities: labelled(FACELESS_DENSITIES),
    hairStyles: labelled(FACELESS_HAIR_STYLES),
    accessories: labelled(FACELESS_ACCESSORIES),
    paletteKeys: labelled(FACELESS_PALETTE_KEYS),
    enters: FACELESS_ENTERS,
    avatarCatalog: AVATAR_PACK_CATALOG.map(({ id, mode, label }) => ({ id, mode, label })),
    imageCostUsd: IMAGE_COST_USD,
  };
});
