// « Changer de DA » sur une video deja faite : meme plan, meme voix, seul le montage est refait
// (aucun appel Claude ni ElevenLabs). Fonctions pures.
import { FACELESS_PRESETS, FACELESS_SCREENS } from '../data/facelessThemes.js';
import { resolveScreen } from './facelessDevice.js';
import { defaultFacelessStyle, normalizeFacelessStyle, pickStyleSlot } from './facelessStyle.js';

const SLOT_NAMES = ['principale', 'option 2', 'option 3'];

/** Pur : les DA proposees, les DA du profil d abord (`slot:N`), puis tous les modeles (`preset:cle`). */
export function listRestyleChoices(profileStyle) {
  const profile = profileStyle
    ? [profileStyle, ...(profileStyle.alternates || [])].map((da, index) => ({
      value: `slot:${index}`,
      label: `DA ${SLOT_NAMES[index] || index + 1} du profil : ${da.name}`,
    }))
    : [];
  const presets = Object.entries(FACELESS_PRESETS).map(([key, preset]) => ({ value: `preset:${key}`, label: `Modèle : ${preset.label}` }));
  return [...profile, ...presets];
}

/** Pur : la DA avec son propre ecran, ou celui demande a sa place. */
function withScreen(style, requested) {
  const screen = Object.hasOwn(FACELESS_SCREENS, requested) ? requested : resolveScreen(style);
  return { ...style, screen, screenFrame: screen === 'computer' && style.template === 'dashboard' };
}

const describe = (name, style) => `${name}, écran : ${FACELESS_SCREENS[style.screen].toLowerCase()}`;

/**
 * Pur : la DA choisie, prete pour le rendu, ou `null` si le choix n existe pas. C est la DA choisie qui decide de
 * l ecran, comme dans son apercu, sauf si un autre est demande pour cette video. Un modele essaye garde l avatar de la
 * DA principale du profil (a defaut, celui de la video).
 */
export function resolveRestyle(choice, { profileStyle = null, spec = null, gender = 'FEMALE', screen = '' } = {}) {
  const match = /^(slot|preset):([\w-]{1,60})$/.exec(String(choice || ''));
  if (!match) return null;
  const [, kind, key] = match;

  if (kind === 'slot') {
    const slot = Number(key);
    if (!profileStyle || !Number.isInteger(slot) || slot < 0 || slot > (profileStyle.alternates || []).length) return null;
    const picked = pickStyleSlot(profileStyle, slot);
    const style = withScreen(picked, screen);
    return { style, label: describe(`DA ${SLOT_NAMES[slot]} du profil (${picked.name})`, style) };
  }

  if (!Object.hasOwn(FACELESS_PRESETS, key)) return null;
  const avatar = profileStyle?.avatar || normalizeFacelessStyle(spec?.style || {}).avatar;
  const style = withScreen({ ...defaultFacelessStyle(key, gender), avatar }, screen);
  return { style, label: describe(`modèle ${FACELESS_PRESETS[key].label}`, style) };
}
