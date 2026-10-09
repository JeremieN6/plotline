/**
 * Direction artistique (DA) du format faceless : polices, preferences de rendu
 * et deux themes de depart. Une DA est un ensemble de REGLAGES lus par un moteur
 * de rendu fixe (jamais du HTML libre ecrit par Claude).
 */

export const FACELESS_FONTS = {
  fredoka: { label: 'Fredoka — ronde, douce', family: 'Fredoka', file: 'fonts/Fredoka.ttf', weights: '300 700', stretch: '75% 125%' },
  archivo: { label: 'Archivo — grotesque, brutaliste', family: 'Archivo', file: 'fonts/Archivo.ttf', weights: '100 900', stretch: '62% 125%' },
  spacegrotesk: { label: 'Space Grotesk — moderne, tech', family: 'Space Grotesk', file: 'fonts/SpaceGrotesk.ttf', weights: '300 700', stretch: '100%' },
  caveat: { label: 'Caveat — écriture à la main', family: 'Caveat', file: 'fonts/Caveat.ttf', weights: '400 700', stretch: '100%' },
};

export const FACELESS_CARD_STYLES = {
  torn: 'Papier déchiré avec scotch',
  flat: 'Aplat avec bordure noire et ombre dure',
  sticker: 'Autocollant arrondi à contour blanc',
};

export const FACELESS_BACKGROUNDS = {
  paper: 'Papier texturé',
  grid: 'Quadrillage',
  notebook: 'Feuille de cahier',
  kraft: 'Papier kraft',
  solid: 'Aplat uni',
};

export const FACELESS_MOTIONS = {
  stopmotion: 'Stop motion (images saccadées, papier qui vibre)',
  smooth: 'Fluide (mouvements continus)',
};

export const FACELESS_ENTERS = ['pop', 'slide-left', 'slide-right', 'drop', 'rise', 'cut'];

export const FACELESS_CAPTION_STYLES = {
  outline: 'Contour blanc',
  plain: 'Texte seul',
  box: 'Dans un cadre',
};

export const FACELESS_DENSITIES = {
  sobre: 'Sobre : un seul élément à la fois',
  normal: 'Normal : un ou deux éléments',
  dense: 'Dense : plusieurs éléments, rythme rapide',
};

export const FACELESS_HAIR_STYLES = { long: 'Longs', short: 'Courts', bun: 'Chignon' };
export const FACELESS_ACCESSORIES = { none: 'Aucun', bow: 'Nœud', glasses: 'Lunettes' };

export const FACELESS_PALETTE_KEYS = {
  background: 'Fond principal',
  backgroundAlt: 'Fond secondaire',
  dark: 'Fond sombre',
  text: 'Texte',
  accent: 'Accent (mots clés)',
  accent2: 'Accent secondaire',
  card: 'Cartes',
  cardText: 'Texte des cartes',
};

export const FACELESS_PRESETS = {
  'papercraft-pastel': {
    label: 'Papercraft pastel',
    description: 'Papier rose, cartes déchirées avec scotch, autocollants, stop motion.',
    style: {
      name: 'Papercraft pastel',
      preset: 'papercraft-pastel',
      palette: {
        background: '#f9dbe5', backgroundAlt: '#fdf1e4', dark: '#3b4a73', text: '#3b2433', accent: '#ff4f8b', accent2: '#ffd166', card: '#fffaf1', cardText: '#3b2433',
      },
      font: 'fredoka',
      card: 'torn',
      background: 'paper',
      decor: 'shapes',
      motion: 'stopmotion',
      enters: ['pop', 'slide-left', 'slide-right', 'drop', 'rise'],
      captions: { enabled: true, position: 'bottom', style: 'outline' },
      density: 'normal',
      rules: 'Peu d éléments à l écran. Petites rotations tout le temps. Emojis et autocollants pour illustrer.',
      avatarPrompt: 'chibi, grosse tête et petit corps, aplats de couleur, contour fin, style sticker mignon',
    },
  },
  brutalisme: {
    label: 'Brutalisme',
    description: 'Fond quadrillé crème, cartes à bordure noire et ombre dure, mots clés en orange.',
    style: {
      name: 'Brutalisme',
      preset: 'brutalisme',
      palette: {
        background: '#f3ecd9', backgroundAlt: '#ffffff', dark: '#1a1a1a', text: '#141414', accent: '#e8542f', accent2: '#ffd23f', card: '#ffffff', cardText: '#141414',
      },
      font: 'archivo',
      card: 'flat',
      background: 'grid',
      decor: 'none',
      motion: 'smooth',
      enters: ['pop', 'slide-left', 'slide-right', 'cut'],
      captions: { enabled: true, position: 'top', style: 'plain' },
      density: 'sobre',
      rules: 'Jamais trop d éléments. Textes courts en capitales. Un mot clé en orange par écran. Transitions franches.',
      avatarPrompt: 'illustration style sticker, personnage expressif, aplats, contour net, proportions réalistes stylisées',
    },
  },
};

export const DEFAULT_PRESET = 'papercraft-pastel';

export const DEFAULT_AVATAR_SVG = {
  papercraft: { hair: 'long', hairColor: '#5b3a2e', skin: '#ffe2cf', accessory: 'bow', top: '#c9b6ff' },
};
