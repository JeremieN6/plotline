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
  bricolage: { label: 'Bricolage Grotesque — grotesque expressive', family: 'Bricolage Grotesque', file: 'fonts/BricolageGrotesque.ttf', weights: '200 800', stretch: '75% 100%' },
  jetbrainsmono: { label: 'JetBrains Mono — code, chiffres', family: 'JetBrains Mono', file: 'fonts/JetBrainsMono.ttf', weights: '100 800', stretch: '100%' },
  intertight: { label: 'Inter Tight — éditoriale, serrée', family: 'Inter Tight', file: 'fonts/InterTight.ttf', weights: '100 900', stretch: '100%' },
  ibmplexmono: { label: 'IBM Plex Mono — libellés, chiffres', family: 'IBM Plex Mono', file: 'fonts/IBMPlexMono.ttf', weights: '500', stretch: '100%' },
  sora: { label: 'Sora — géométrique, tech', family: 'Sora', file: 'fonts/Sora.ttf', weights: '100 800', stretch: '100%' },
  dmserif: { label: 'DM Serif Display — serif doux', family: 'DM Serif Display', file: 'fonts/DMSerifDisplay.ttf', weights: '400', stretch: '100%' },
  dmsans: { label: 'DM Sans — sans-serif douce', family: 'DM Sans', file: 'fonts/DMSans.ttf', weights: '100 1000', stretch: '100%' },
  dmmono: { label: 'DM Mono — libellés', family: 'DM Mono', file: 'fonts/DMMono.ttf', weights: '500', stretch: '100%' },
  anton: { label: 'Anton — condensée, affiche', family: 'Anton', file: 'fonts/Anton.ttf', weights: '400', stretch: '100%' },
  geist: { label: 'Geist — interface produit', family: 'Geist', file: 'fonts/Geist.ttf', weights: '100 900', stretch: '100%' },
  geistmono: { label: 'Geist Mono — libellés', family: 'Geist Mono', file: 'fonts/GeistMono.ttf', weights: '100 900', stretch: '100%' },
  spacemono: { label: 'Space Mono — légendes', family: 'Space Mono', file: 'fonts/SpaceMono.ttf', weights: '700', stretch: '100%' },
};

/**
 * Modele visuel (moteur de mise en page). "classic" = cartes, fonds et decors reglables ;
 * les autres modeles ont leur propre structure (cadre, animations) et n utilisent de la DA
 * que la palette, la police, le mouvement et les sous-titres.
 */
export const FACELESS_TEMPLATES = {
  classic: 'Classique (cartes et autocollants)',
  fenetre: 'Fenêtre d’ordinateur',
  cahier: 'Cahier éditorial',
  editeur: 'Éditeur de code',
  brutal: 'Affiche brutale',
  dashboard: 'Interface produit',
  herbier: 'Herbier (étiquette de produit)',
};

// Police "code" des modeles qui en affichent (libelles, chiffres, onglets).
export const FACELESS_TEMPLATE_MONO = { fenetre: 'jetbrainsmono', cahier: 'ibmplexmono', editeur: 'jetbrainsmono', brutal: 'spacemono', dashboard: 'geistmono', herbier: 'dmmono' };

// Polices en plus de la principale et de la mono d un modele (italiques, sans-serif) : chargees avec la page.
export const FACELESS_TEMPLATE_EXTRA_FONTS = {
  herbier: [
    { family: 'DM Serif Display', file: 'fonts/DMSerifDisplay-Italic.ttf', weights: '400', style: 'italic' },
    { family: 'DM Sans', file: 'fonts/DMSans.ttf', weights: '100 1000', style: 'normal' },
    { family: 'DM Mono', file: 'fonts/DMMono-Italic.ttf', weights: '500', style: 'italic' },
  ],
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

// Modele "Fenetre" : le contenu s affiche dans une fenetre d ordinateur posee sur un aplat de
// couleur saturee, l avatar passe devant. Une seule dominante par video (background = accent).
// Le fond secondaire est la meme dominante un peu plus sombre ; le fond sombre est reserve a l appel a l action.
const FENETRE_RULES = 'Chaque scène tient dans la fenêtre : textes très courts (2 à 6 mots), un seul mot clé entre ** par écran. Fond "main" presque partout, "dark" seulement pour l’appel à l’action. Aucun emoji (sauf mise en page logo). Donne à chaque scène un "tab" court façon nom de fichier ou d’adresse (ex. "monsite.fr", "couches.md", "resultat.live"). Utilise "stat" pour un chiffre clé réellement présent dans le script.';
const fenetre = (key, label, description, dominant, alt) => ({
  label,
  description,
  style: {
    name: label,
    preset: key,
    template: 'fenetre',
    palette: {
      background: dominant, backgroundAlt: alt, dark: '#111111', text: '#f5f2eb', accent: dominant, accent2: '#ffc531', card: '#f5f2eb', cardText: '#111111',
    },
    font: 'bricolage',
    card: 'flat',
    background: 'solid',
    decor: 'none',
    motion: 'smooth',
    enters: ['cut'],
    captions: { enabled: true, position: 'top', style: 'box' },
    density: 'sobre',
    rules: FENETRE_RULES,
    avatarPrompt: 'fidèle à l’image de base du personnage, expressions marquées, rendu net, sans contour blanc',
  },
});
Object.assign(FACELESS_PRESETS, {
  'fenetre-orange': fenetre('fenetre-orange', 'Fenêtre orange', 'Une fenêtre d’ordinateur sur un aplat orange saturé, l’avatar passe devant : tech, SaaS, chiffres.', '#e8420c', '#c93a0b'),
  'fenetre-cobalt': fenetre('fenetre-cobalt', 'Fenêtre cobalt', 'La fenêtre d’ordinateur sur un aplat bleu cobalt : plus froid, plus « produit ».', '#2b50ff', '#2242d6'),
  'fenetre-olive': fenetre('fenetre-olive', 'Fenêtre olive', 'La fenêtre d’ordinateur sur un aplat vert olive : plus calme, plus organique.', '#6b8e00', '#5a7800'),
  'fenetre-baie': fenetre('fenetre-baie', 'Fenêtre baie', 'La fenêtre d’ordinateur sur un aplat rose baie : plus chaleureux, plus créatif.', '#c2185b', '#a5134d'),
});

// Modele "Cahier" : editorial et sobre. Papier quadrille, une phrase a deux niveaux (gris, puis le mot
// important en tres grand et en noir), un seul visuel central. accent2 = le gris du premier niveau.
const CAHIER_RULES = 'Une idée par écran. Le texte à l’écran est une phrase courte (4 à 9 mots) dont le mot ou les 2 mots importants sont entre ** : ils s’affichent en très grand, le reste en gris. Aucun emoji. Fond "main" partout, "dark" seulement pour l’appel à l’action. Texte en haut, animation au milieu : utilise "list" pour 2 à 4 étapes, "stat" (avec "compare", 2 ou 3 valeurs) pour une progression chiffrée réellement dite, "word" pour un mot à retenir. L’avatar ne se montre qu’à la fin.';
const cahier = (key, label, description, accent) => ({
  label,
  description,
  style: {
    name: label,
    preset: key,
    template: 'cahier',
    palette: {
      background: '#f4f5f1', backgroundAlt: '#ffffff', dark: '#111111', text: '#111111', accent, accent2: '#8b8d86', card: '#ffffff', cardText: '#111111',
    },
    font: 'intertight',
    card: 'sticker',
    background: 'grid',
    decor: 'none',
    motion: 'smooth',
    enters: ['cut'],
    captions: { enabled: true, position: 'top', style: 'plain' },
    density: 'sobre',
    rules: CAHIER_RULES,
    avatarPrompt: 'fidèle à l’image de base du personnage, expressions marquées, rendu net et propre',
  },
});
Object.assign(FACELESS_PRESETS, {
  'cahier-vert': cahier('cahier-vert', 'Cahier vert', 'Papier quadrillé, phrase en gris puis le mot important en très grand, un seul visuel : éditorial et soigné.', '#1f7a5c'),
  'cahier-bleu': cahier('cahier-bleu', 'Cahier bleu', 'Le cahier éditorial avec un accent bleu : plus « produit », plus tech.', '#2447c8'),
  'cahier-brique': cahier('cahier-brique', 'Cahier brique', 'Le cahier éditorial avec un accent rouge brique : plus chaleureux.', '#b3361f'),
});

// Modele "Editeur" : le propos affiche comme du code (lignes numerotees, coloration, frappe), sombre et
// technique. accent = la couleur de surbrillance (fonctions, mot actif), accent2 = le mot cle de l accroche.
const EDITEUR_RULES = 'Esthétique éditeur de code, sombre. Pour chaque scène "hook" ou "title", écris "code" : 2 à 5 lignes de pseudo-code JavaScript très court (32 caractères max par ligne) qui illustre ce qui est dit, lisible par un non-développeur (ex. const site = {, temps: "4 secondes",, };, // trop lent.). Jamais de vraie API, de marque ou de code exécutable. La phrase à l’écran ("text") a UN mot clé entre **. Utilise "word" pour un mot à retenir (terminal), "stat" avec "compare" (avant / après) pour une comparaison chiffrée réellement dite. Aucun emoji.';
const editeur = (key, label, description, accent, accent2) => ({
  label,
  description,
  style: {
    name: label,
    preset: key,
    template: 'editeur',
    palette: {
      background: '#0f111a', backgroundAlt: '#121522', dark: '#0b0c12', text: '#e6e8f2', accent, accent2, card: '#171a26', cardText: '#e6e8f2',
    },
    font: 'sora',
    card: 'flat',
    background: 'solid',
    decor: 'none',
    motion: 'smooth',
    enters: ['cut'],
    captions: { enabled: true, position: 'top', style: 'box' },
    density: 'normal',
    rules: EDITEUR_RULES,
    avatarPrompt: 'fidèle à l’image de base du personnage, expressions marquées, rendu net, légère lumière de contour',
  },
});
Object.assign(FACELESS_PRESETS, {
  'editeur-cyan': editeur('editeur-cyan', 'Éditeur cyan', 'Le propos s’affiche comme du code dans un éditeur sombre, l’avatar dans une bulle ronde : tech, dev, IA.', '#5be3ff', '#ff7a6e'),
  'editeur-corail': editeur('editeur-corail', 'Éditeur corail', 'L’éditeur de code avec une surbrillance corail : plus chaud.', '#ff7a6e', '#5be3ff'),
  'editeur-jaune': editeur('editeur-jaune', 'Éditeur jaune', 'L’éditeur de code avec une surbrillance jaune : plus énergique.', '#ffd166', '#ff7a6e'),
});

// Modele "Brutal" : affiche de stade. Noir, blanc casse, UN fluo (accent) sur le mot qui compte, capitales
// condensees enormes, cadre epais, coupes franches (stop motion). Texte toujours noir sur le fluo.
const BRUTAL_RULES = 'Style affiche : phrases très courtes en capitales (3 à 7 mots), une seule idée par scène. Entoure UN seul mot clé par scène de ** : il passe en bloc fluo, jamais plus d\'un accent par écran. Pour un mot à retenir, utilise "word" (il s\'affiche 5 fois en cascade sur fond noir). "list" : 2 à 4 éléments de 1 à 3 mots, numérotés. "stat" pour un chiffre clé réellement dit. L\'avatar n\'apparaît que sur "title" et "avatar". Aucun emoji. Coupes franches.';
const brutal = (key, label, description, fluo) => ({
  label,
  description,
  style: {
    name: label,
    preset: key,
    template: 'brutal',
    palette: {
      background: '#f2f2ee', backgroundAlt: '#ffffff', dark: '#0a0a0a', text: '#0a0a0a', accent: fluo, accent2: '#ffffff', card: '#ffffff', cardText: '#0a0a0a',
    },
    font: 'anton',
    card: 'flat',
    background: 'solid',
    decor: 'none',
    motion: 'stopmotion',
    enters: ['cut'],
    captions: { enabled: true, position: 'top', style: 'box' },
    density: 'sobre',
    rules: BRUTAL_RULES,
    avatarPrompt: 'fidèle à l’image de base du personnage, expressions marquées, rendu net et contrasté',
  },
});
Object.assign(FACELESS_PRESETS, {
  'brutal-fluo': brutal('brutal-fluo', 'Brutal fluo', 'Affiche de stade : noir, blanc cassé, un seul fluo jaune-vert, capitales énormes, cadre épais.', '#c6ff00'),
  'brutal-rose': brutal('brutal-rose', 'Brutal rose', 'L’affiche brutale avec un fluo rose : plus pop, plus mode.', '#ff2e93'),
  'brutal-orange': brutal('brutal-orange', 'Brutal orange', 'L’affiche brutale avec un fluo orange : plus chaud, plus énergique.', '#ff5a1f'),
  'brutal-cyan': brutal('brutal-cyan', 'Brutal cyan', 'L’affiche brutale avec un fluo cyan : plus froid, plus tech.', '#00e5ff'),
});

// Modele "Dashboard" : une interface produit claire. Fond gris froid, cartes blanches, pastilles de statut, un graphique
// qui se construit. accent = la couleur d interface (mot cle, courbe, carte active). Rouge et vert sont fixes, reserves au sens.
const DASHBOARD_RULES = 'Une interface produit : chaque scène est une ou deux cartes. Entoure UN mot clé par phrase de **. Chiffres UNIQUEMENT ceux du script, jamais inventés : "stat" avec "word" (le chiffre final), "compare" (avant puis après, 2 ou 3 valeurs) et, seulement si le script donne plusieurs points, "series" (jusqu\'à 8 valeurs avec leur libellé). "list" : 2 à 4 éléments avec "text" (titre court) et "sub" (une sous-ligne de 2 à 5 mots). Rouge et vert seulement pour une baisse ou une hausse, avec un mot. Aucun emoji.';
const dashboard = (key, label, description, accent) => ({
  label,
  description,
  style: {
    name: label,
    preset: key,
    template: 'dashboard',
    palette: {
      background: '#eef0f4', backgroundAlt: '#ffffff', dark: '#0f172a', text: '#0f172a', accent, accent2: '#64748b', card: '#ffffff', cardText: '#0f172a',
    },
    font: 'geist',
    card: 'flat',
    background: 'solid',
    decor: 'none',
    motion: 'smooth',
    enters: ['cut'],
    captions: { enabled: true, position: 'top', style: 'box' },
    density: 'normal',
    rules: DASHBOARD_RULES,
    avatarPrompt: 'fidèle à l’image de base du personnage, expressions marquées, rendu net et propre',
  },
});
Object.assign(FACELESS_PRESETS, {
  'dashboard-indigo': dashboard('dashboard-indigo', 'Dashboard indigo', 'Interface produit claire : cartes blanches, pastilles, un graphique qui se construit. SaaS, business, chiffres.', '#4f46e5'),
  'dashboard-vert': dashboard('dashboard-vert', 'Dashboard vert', 'L’interface produit avec un accent vert profond : finance, croissance.', '#0b7a5a'),
  'dashboard-bleu': dashboard('dashboard-bleu', 'Dashboard bleu', 'L’interface produit avec un accent bleu : plus corporate.', '#1d4ed8'),
});

// Modele "Herbier" : page d herbier (papier creme, serif doux, rameau au trait) et etiquette de produit decryptee ligne par ligne.
// accent = le mot en italique et le trait actif (terracotta par defaut) ; le rouge et le vert ne servent qu a juger un ingredient.
const HERBIER_RULES = 'Naturel, rassurant, précis : le persona lit les ingrédients pour la personne. Phrases courtes en deux niveaux, UN mot ou groupe de mots entre ** par phrase (il passe en italique de couleur). Pour décrypter une étiquette de produit, utilise "label" : "items" = 4 à 8 ingrédients dans l’ordre de l’étiquette, chacun avec "tone" : "avoid" (à éviter, barré en rouge), "good" (à rechercher, surligné en vert) ou "watch" (à surveiller) ; ajoute "sub" (un mot court : sulfate, aloe vera) aux ingrédients jugés, "text" = le verdict ("Verdict : **à reposer.**"). Ne juge QUE ce que le script dit. Pour une liste de repères, "list" avec "tone" par élément (good par défaut). "word" pour un ingrédient (le mot) avec son nom latin dans "text". Aucun emoji.';
const herbier = (key, label, description, accent) => ({
  label,
  description,
  style: {
    name: label,
    preset: key,
    template: 'herbier',
    palette: {
      background: '#f6f2e8', backgroundAlt: '#dce5d0', dark: '#1f3a2b', text: '#1f3a2b', accent, accent2: '#9db08c', card: '#fffdf8', cardText: '#1f3a2b',
    },
    font: 'dmserif',
    card: 'flat',
    background: 'solid',
    decor: 'none',
    motion: 'smooth',
    enters: ['cut'],
    captions: { enabled: true, position: 'top', style: 'box' },
    density: 'sobre',
    rules: HERBIER_RULES,
    avatarPrompt: 'fidèle à l’image de base du personnage, expressions marquées, rendu net et doux',
  },
});
Object.assign(FACELESS_PRESETS, {
  'herbier-terracotta': herbier('herbier-terracotta', 'Herbier terracotta', 'Page d’herbier : papier crème, serif doux, rameau au trait, étiquette de produit décryptée ligne par ligne. Produits bio, hair care.', '#c4623a'),
  'herbier-lavande': herbier('herbier-lavande', 'Herbier lavande', 'L’herbier avec un accent lavande : soins apaisants.', '#7a68ad'),
  'herbier-argile': herbier('herbier-argile', 'Herbier rose argile', 'L’herbier avec un accent rose argile : beauté douce.', '#b8705f'),
});

export const DEFAULT_PRESET = 'papercraft-pastel';

export const DEFAULT_AVATAR_SVG = {
  papercraft: { hair: 'long', hairColor: '#5b3a2e', skin: '#ffe2cf', accessory: 'bow', top: '#c9b6ff' },
};
