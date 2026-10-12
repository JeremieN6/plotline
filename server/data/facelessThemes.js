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
  'cahier-ecolier': {
    label: 'Cahier d\'écolier',
    description: 'Feuille de cahier, écriture manuscrite, cartes arrondies à contour blanc, bleu stylo.',
    style: {
      name: 'Cahier d\'écolier',
      preset: 'cahier-ecolier',
      palette: {
        background: '#fdfaf0', backgroundAlt: '#e8f1fb', dark: '#27408b', text: '#1d2b5a', accent: '#2f6fdc', accent2: '#ffcf4a', card: '#ffffff', cardText: '#1d2b5a',
      },
      font: 'caveat',
      card: 'sticker',
      background: 'notebook',
      decor: 'none',
      motion: 'stopmotion',
      enters: ['pop', 'slide-left', 'rise'],
      captions: { enabled: true, position: 'bottom', style: 'box' },
      density: 'normal',
      rules: 'Ton doux et scolaire. Mots clés soulignés au stylo bleu. Peu d éléments à la fois.',
      avatarPrompt: 'personnage dessiné au stylo, traits fins, aplats légers façon carnet, proportions rondes',
    },
  },
  'neon-nuit': {
    label: 'Néon nuit',
    description: 'Fond bleu nuit, accents magenta et cyan, cartes plates, mouvement sec.',
    style: {
      name: 'Néon nuit',
      preset: 'neon-nuit',
      palette: {
        background: '#0b0b24', backgroundAlt: '#14143a', dark: '#05050f', text: '#f4f0ff', accent: '#ff2bd6', accent2: '#22e6ff', card: '#17174a', cardText: '#f4f0ff',
      },
      font: 'spacegrotesk',
      card: 'flat',
      background: 'solid',
      decor: 'none',
      motion: 'smooth',
      enters: ['slide-left', 'slide-right', 'cut'],
      captions: { enabled: true, position: 'top', style: 'box' },
      density: 'sobre',
      rules: 'Phrases très courtes. Un seul mot clé en magenta par écran. Transitions franches.',
      avatarPrompt: 'illustration style néon, aplats saturés, contour net, lueur colorée discrète',
    },
  },
  'kraft-carnet': {
    label: 'Kraft carnet',
    description: 'Papier kraft, cartes déchirées avec scotch, rouge brique, stop motion.',
    style: {
      name: 'Kraft carnet',
      preset: 'kraft-carnet',
      palette: {
        background: '#cfa87a', backgroundAlt: '#f3e6d0', dark: '#4a3322', text: '#3a2616', accent: '#c4472b', accent2: '#f2c14e', card: '#fbf3e4', cardText: '#3a2616',
      },
      font: 'fredoka',
      card: 'torn',
      background: 'kraft',
      decor: 'shapes',
      motion: 'stopmotion',
      enters: ['pop', 'drop', 'rise', 'slide-left'],
      captions: { enabled: false, position: 'bottom', style: 'outline' },
      density: 'normal',
      rules: 'Look artisanal : collages, scotch, petites rotations. Un élément principal par écran.',
      avatarPrompt: 'personnage découpé façon collage papier, aplats chauds, contour irrégulier',
    },
  },
  'luxe-minimal': {
    label: 'Luxe minimal',
    description: 'Fond écru, noir et doré, beaucoup d\'espace, mouvement lent et fluide.',
    style: {
      name: 'Luxe minimal',
      preset: 'luxe-minimal',
      palette: {
        background: '#f6f3ee', backgroundAlt: '#ece7de', dark: '#1b1b1b', text: '#1b1b1b', accent: '#b8893b', accent2: '#1b1b1b', card: '#ffffff', cardText: '#1b1b1b',
      },
      font: 'spacegrotesk',
      card: 'sticker',
      background: 'solid',
      decor: 'none',
      motion: 'smooth',
      enters: ['rise', 'cut'],
      captions: { enabled: true, position: 'bottom', style: 'plain' },
      density: 'sobre',
      rules: 'Beaucoup d espace vide. Un seul élément à la fois. Aucun emoji. Transitions lentes.',
      avatarPrompt: 'portrait élégant, aplats sobres noir et ivoire, contour très fin',
    },
  },
  'pop-jaune': {
    label: 'Pop jaune',
    description: 'Fond jaune quadrillé, cartes à bordure noire, orange vif, rythme rapide.',
    style: {
      name: 'Pop jaune',
      preset: 'pop-jaune',
      palette: {
        background: '#ffe14d', backgroundAlt: '#ffffff', dark: '#111111', text: '#111111', accent: '#ff3d00', accent2: '#00c2a8', card: '#ffffff', cardText: '#111111',
      },
      font: 'archivo',
      card: 'flat',
      background: 'grid',
      decor: 'shapes',
      motion: 'stopmotion',
      enters: ['pop', 'slide-left', 'slide-right', 'drop', 'rise'],
      captions: { enabled: true, position: 'bottom', style: 'outline' },
      density: 'dense',
      rules: 'Rythme rapide, beaucoup d énergie. Textes en capitales. Couleurs franches.',
      avatarPrompt: 'illustration pop, aplats vifs, contour noir épais, expressions exagérées',
    },
  },
  // Famille "Atelier" (premium sobre) : crème + une couleur, avec fond secondaire et fond
  // profond TEINTES pour que la couleur couvre une bonne part de la video, pas seulement les
  // mots cles. Texte teinte (jamais noir pur). Le fond profond est reserve a l appel a l action :
  // l accent n y serait pas assez lisible pour un mot cle.
  'atelier-vert': {
    label: 'Atelier vert',
    description: 'Crème, sauge et vert sapin : sobre et posé, une seule idée par écran.',
    style: {
      name: 'Atelier vert',
      preset: 'atelier-vert',
      palette: {
        background: '#f4efe6', backgroundAlt: '#c9e2d0', dark: '#0e3a29', text: '#10241a', accent: '#1d6b47', accent2: '#e0a93b', card: '#ffffff', cardText: '#10241a',
      },
      font: 'spacegrotesk',
      card: 'sticker',
      background: 'solid',
      decor: 'none',
      motion: 'smooth',
      enters: ['rise', 'cut'],
      captions: { enabled: true, position: 'bottom', style: 'plain' },
      density: 'sobre',
      rules: 'Alterner les fonds : crème, teinte douce, puis fond profond réservé à l\'appel à l\'action, pour que la couleur soit présente dans toute la vidéo. Beaucoup d\'espace. Un seul élément à la fois. Phrases courtes, ton posé et direct. Un mot clé en couleur d\'accent par écran. Aucun emoji. Transitions lentes.',
      avatarPrompt: 'fidèle à l\'image de base du personnage, expressions marquées, rendu net et propre, contour très fin',
    },
  },
  'atelier-bleu': {
    label: 'Atelier bleu',
    description: 'Crème, bleu clair et bleu nuit : la même ambiance posée, plus corporate.',
    style: {
      name: 'Atelier bleu',
      preset: 'atelier-bleu',
      palette: {
        background: '#f4efe6', backgroundAlt: '#cbdcf3', dark: '#13294b', text: '#13233f', accent: '#2f4b7c', accent2: '#e07a2f', card: '#ffffff', cardText: '#13233f',
      },
      font: 'spacegrotesk',
      card: 'sticker',
      background: 'solid',
      decor: 'none',
      motion: 'smooth',
      enters: ['rise', 'cut'],
      captions: { enabled: true, position: 'bottom', style: 'plain' },
      density: 'sobre',
      rules: 'Alterner les fonds : crème, teinte douce, puis fond profond réservé à l\'appel à l\'action, pour que la couleur soit présente dans toute la vidéo. Beaucoup d\'espace. Un seul élément à la fois. Phrases courtes, ton posé et direct. Un mot clé en couleur d\'accent par écran. Aucun emoji. Transitions lentes.',
      avatarPrompt: 'fidèle à l\'image de base du personnage, expressions marquées, rendu net et propre, contour très fin',
    },
  },
  'atelier-bordeaux': {
    label: 'Atelier bordeaux',
    description: 'Crème, rose poudré et aubergine : plus éditorial, très « Parisien chic ».',
    style: {
      name: 'Atelier bordeaux',
      preset: 'atelier-bordeaux',
      palette: {
        background: '#f4efe6', backgroundAlt: '#f1cfd4', dark: '#3a0f19', text: '#2a0f16', accent: '#8c2434', accent2: '#d4a24c', card: '#ffffff', cardText: '#2a0f16',
      },
      font: 'spacegrotesk',
      card: 'sticker',
      background: 'solid',
      decor: 'none',
      motion: 'smooth',
      enters: ['rise', 'cut'],
      captions: { enabled: true, position: 'bottom', style: 'plain' },
      density: 'sobre',
      rules: 'Alterner les fonds : crème, teinte douce, puis fond profond réservé à l\'appel à l\'action, pour que la couleur soit présente dans toute la vidéo. Beaucoup d\'espace. Un seul élément à la fois. Phrases courtes, ton posé et direct. Un mot clé en couleur d\'accent par écran. Aucun emoji. Transitions lentes.',
      avatarPrompt: 'fidèle à l\'image de base du personnage, expressions marquées, rendu net et propre, contour très fin',
    },
  },
  // Brut / tech : fond nuit, vert menthe, coupes franches, mockups de code.
  terminal: {
    label: 'Terminal',
    description: 'Fond nuit quadrillé, vert menthe, cartes plates, coupes franches : l\'esprit développeur.',
    style: {
      name: 'Terminal',
      preset: 'terminal',
      palette: {
        background: '#0d1117', backgroundAlt: '#161b22', dark: '#010409', text: '#e6edf3', accent: '#3ef0b4', accent2: '#ff8a3d', card: '#161b22', cardText: '#e6edf3',
      },
      font: 'spacegrotesk',
      card: 'flat',
      background: 'grid',
      decor: 'none',
      motion: 'smooth',
      enters: ['cut', 'slide-left', 'slide-right'],
      captions: { enabled: true, position: 'top', style: 'box' },
      density: 'normal',
      rules: 'Esthétique terminal. Mots clés et chiffres en vert menthe, un par écran. Coupes franches. Mockups de code et de commandes bienvenus.',
      avatarPrompt: 'fidèle à l\'image de base du personnage, expressions marquées, rendu net, lueur verte discrète sur le contour',
    },
  },
};

export const DEFAULT_PRESET = 'papercraft-pastel';

export const DEFAULT_AVATAR_SVG = {
  papercraft: { hair: 'long', hairColor: '#5b3a2e', skin: '#ffe2cf', accessory: 'bow', top: '#c9b6ff' },
};
