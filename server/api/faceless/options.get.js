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
  FACELESS_TEMPLATES,
} from '../../data/facelessThemes.js';
import { FACELESS_DURATIONS } from '../../utils/facelessPlanGenerator.js';
import { defaultFacelessStyle, MAX_ALTERNATES } from '../../utils/facelessStyle.js';
import { listCloneVoices } from '../../utils/elevenLabsTts.js';
import { AUDIO_TAGS } from '../../utils/audioTags.js';

const labelled = (obj) => Object.entries(obj).map(([value, label]) => ({ value, label }));

// Options du formulaire "Video faceless" et de la page "Direction artistique".
export default defineEventHandler(async (event) => {
  const authModule = await import('../../utils/auth.js');
  const user = await authModule.requireAuthUser(event);
  // Les voix clonees sont celles du compte ElevenLabs de Plotline : seul le proprietaire les voit.
  const cloneVoices = user?.isAdmin ? await listCloneVoices() : [];

  return {
    cloneVoices,
    audioTags: Object.entries(AUDIO_TAGS).map(([tag, description]) => ({ tag, description })),
    voices: FACELESS_VOICES,
    defaultVoiceId: DEFAULT_FACELESS_VOICE_ID,
    durations: FACELESS_DURATIONS,
    maxAlternates: MAX_ALTERNATES,
    // Deux categories : les premiers modeles (cartes et autocollants reglables, template "classic")
    // et les modeles anime, ranges par famille (un moteur de mise en page par famille).
    presetCategories: [
      { key: 'classic', label: 'Classiques', description: 'Cartes, fonds et decors reglables : papercraft, brutalisme, cahier, neon, kraft, luxe, pop, Atelier, Terminal.' },
      { key: 'animated', label: 'Animés', description: 'Mises en page animées avec leur propre structure : Fenêtre, Cahier, Éditeur, Brutal, Dashboard, Herbier, Hanko, Journal.' },
    ],
    presets: Object.entries(FACELESS_PRESETS).map(([key, preset]) => {
      const style = defaultFacelessStyle(key, 'FEMALE');
      return {
        key,
        label: preset.label,
        description: preset.description,
        category: style.template === 'classic' ? 'classic' : 'animated',
        family: style.template,
        familyLabel: FACELESS_TEMPLATES[style.template] || style.template,
        style,
      };
    }),
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
