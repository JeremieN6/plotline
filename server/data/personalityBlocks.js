/**
 * Registre des blocs de personnalite, par type de profil (`kind` = profileType :
 * PERSONA, BRAND, ACTIVITY). Ajouter un champ, un bloc ou un type se fait ICI
 * seulement : le generateur lit ce registre, il ne connait aucun champ en dur.
 *
 * Champ :
 *   key          cle stable (stockee dans le JSON)
 *   label        libelle de l interface
 *   type         'text' | 'longtext' | 'number' | 'list'
 *   max          longueur max (texte) / valeur max (number) / nombre d elements (list)
 *   itemMax      (list) longueur max d un element
 *   min          (number) valeur min
 *   assistHint   consigne pour Claude : toujours du concret (un nom, un lieu, un detail)

 *   optional     le champ peut rester vide (pas de graine, pas de remplissage force)
 *   seedable     une graine tiree cote code oriente ce champ (voir personalitySeeds.js)
 *   seedCategory categorie de graine utilisee quand seedable = true
 *   column       colonne existante du profil qui fait foi pour ce champ. Quand un
 *                profil est charge, la valeur vient de la colonne (lecture seule,
 *                origin 'user') ; la personnalite n ecrit JAMAIS dans les colonnes.
 *   columnPart   'first' | 'rest' pour une colonne liste (niche separee par virgules)
 */

const PERSONA_SUBJECT = 'le persona';

function voiceBlock(subject) {
  return {
    key: 'voice',
    label: 'Voix',
    fields: [
      {
        key: 'tone',
        label: 'Ton',
        type: 'text',
        max: 220,
        seedable: true,
        seedCategory: 'voiceRegisters',
        assistHint: `Une phrase qui decrit comment parle ${subject}, suivie de 3 adjectifs precis separes par des virgules (pas "authentique", "inspirant", "positif" : trop vagues). Ne commence JAMAIS par "Parle comme quelqu un qui" : varie la construction (une comparaison, une situation, un defaut, une habitude de langage).`,
      },
      {
        key: 'sentenceLength',
        label: 'Longueur des phrases',
        type: 'text',
        max: 120,
        assistHint: 'Rythme concret des phrases : courtes et hachees, longues avec des incises, alternance... Une ligne, avec un exemple de tournure.',
      },
      {
        key: 'verbalTics',
        label: 'Tics de langage',
        type: 'list',
        max: 4,
        itemMax: 60,
        assistHint: 'De 2 a 4 expressions ou mots reellement repetes (ex : "bon.", "franchement ?", une formule de fin de video). Coherents avec l age, l origine et le metier, jamais un slogan.',
      },
      {
        key: 'bannedWords',
        label: 'Mots jamais utilises',
        type: 'list',
        max: 6,
        itemMax: 40,
        assistHint: 'De 3 a 6 mots ou expressions que cette voix refuse d employer (ex : "bienveillance", "game changer", "les amis"), coherents avec ses convictions.',
      },
      {
        key: 'humor',
        label: 'Type d humour',
        type: 'text',
        max: 160,
        assistHint: 'Le ressort comique precis (autoderision sur un sujet donne, absurde administratif, understatement...) et ce dont il/elle ne rit jamais.',
      },
      {
        key: 'punctuation',
        label: 'Emojis et ponctuation',
        type: 'text',
        max: 160,
        assistHint: 'Usage concret : aucun emoji, un seul emoji fetiche (lequel), points de suspension, majuscules... Une ligne.',
      },
      {
        key: 'address',
        label: 'Tutoiement ou vouvoiement',
        type: 'text',
        max: 80,
        assistHint: 'Tutoie ou vouvoie l audience, et pourquoi en quelques mots.',
      },
      {
        key: 'audienceName',
        label: 'Facon de nommer son audience',
        type: 'text',
        max: 80,
        assistHint: 'Comment l audience est appelee (ou "ne la nomme jamais"). Evite les surnoms collectifs generiques ("la team", "la fam").',
      },
    ],
  };
}

function editorialBlock(subject) {
  return {
    key: 'editorial',
    label: 'Editorial',
    fields: [
      {
        key: 'mainNiche',
        label: 'Niche principale',
        type: 'text',
        max: 80,
        column: 'niche',
        columnPart: 'first',
        assistHint: `La niche principale de ${subject}, formulee de facon specifique (ex : "restauration de radios anciennes", pas "DIY"). 2 a 6 mots.`,
      },
      {
        key: 'secondaryNiches',
        label: 'Niches secondaires',
        type: 'list',
        max: 3,
        itemMax: 60,
        column: 'niche',
        columnPart: 'rest',
        assistHint: 'De 2 a 3 niches secondaires qui decoulent de l histoire ou des gouts, pas des variantes de la niche principale.',
      },
      {
        key: 'contentPillars',
        label: 'Piliers de contenu',
        type: 'list',
        max: 5,
        itemMax: 90,
        assistHint: 'De 3 a 5 piliers concrets, chacun formule comme un type de publication reconnaissable (ex : "le diagnostic du lundi : une panne, une cause, 60 secondes").',
      },
      {
        key: 'preferredFormats',
        label: 'Formats preferes',
        type: 'list',
        max: 4,
        itemMax: 60,
        assistHint: 'De 2 a 4 formats (Reel face camera, carrousel tutoriel, story sondage...) avec, si utile, la duree ou le nombre de slides.',
      },
      {
        key: 'redLines',
        label: 'Lignes rouges',
        type: 'list',
        max: 5,
        itemMax: 100,
        assistHint: 'De 3 a 5 choses que cette voix ne publierait jamais (sujets, partenariats, formats), coherentes avec les convictions.',
      },
      {
        key: 'promise',
        label: 'Promesse a l audience',
        type: 'text',
        max: 180,
        assistHint: 'Ce que l audience gagne concretement a suivre ce compte, en une phrase verifiable (pas "inspirer", "partager ma passion").',
      },
    ],
  };
}

function appearanceBlock(subject, { isPersona }) {
  const fields = isPersona
    ? [
        {
          key: 'traits',
          label: 'Traits',
          type: 'longtext',
          max: 400,
          assistHint: `Description physique de ${subject} DEDUITE de son histoire et de son mode de vie (une cicatrice liee au metier, une posture, des mains abimees...). Jamais l inverse : rien dans le reste de la fiche ne doit decouler de l apparence.`,
        },
        {
          key: 'clothingStyle',
          label: 'Style vestimentaire',
          type: 'text',
          max: 200,
          assistHint: 'Vetements concrets et recurrents (matiere, piece fetiche, marque d usage generique sans logo), coherents avec le budget et le metier.',
        },
        {
          key: 'distinctiveSigns',
          label: 'Signes distinctifs',
          type: 'text',
          max: 200,
          column: 'particularities',
          assistHint: 'De 1 a 3 signes reconnaissables a l image (accessoire, tatouage discret, coupe), chacun justifie par un element de l histoire.',
        },
      ]
    : [];

  return {
    key: 'appearance',
    label: isPersona ? 'Apparence et univers visuel' : 'Univers visuel',
    fields: [
      ...fields,
      {
        key: 'visualStyle',
        label: 'Style visuel',
        type: 'text',
        max: 160,
        column: 'style',
        assistHint: 'Le style visuel global des contenus en quelques mots concrets (lumiere, cadrage, matieres), utilisable comme consigne d image.',
      },
      {
        key: 'recurringSets',
        label: 'Decors recurrents',
        type: 'list',
        max: 4,
        itemMax: 90,
        assistHint: 'De 2 a 4 decors precis et recurrents (ex : "l etabli du garage, lampe d architecte verte"), coherents avec la ville et le budget.',
      },
      {
        key: 'palette',
        label: 'Palette',
        type: 'text',
        max: 120,
        assistHint: 'De 3 a 5 couleurs nommees precisement (ex : "vert bouteille, laiton patine, gris beton"), pas de codes hexadecimaux.',
      },
    ],
  };
}

function loreBlock(subject, { isPersona }) {
  return {
    key: 'lore',
    label: 'Entourage et lore',
    fields: [
      {
        key: 'recurringCharacters',
        label: 'Personnages recurrents',
        type: 'list',
        max: 4,
        itemMax: 120,
        assistHint: isPersona
          ? 'De 1 a 4 proches recurrents (animal, coloc, ami, voisin) avec un prenom ou surnom et un trait en une phrase. Pas de personne reelle.'
          : 'De 1 a 4 figures recurrentes de la marque (fondateur, artisan, client fidele, mascotte) avec un nom et un trait. Pas de personne reelle.',
      },
      {
        key: 'places',
        label: 'Lieux',
        type: 'list',
        max: 4,
        itemMax: 90,
        assistHint: `De 1 a 4 lieux recurrents du recit de ${subject} (un cafe precis, un marche, un atelier), nommes ou decrits concretement.`,
      },
      {
        key: 'runningGags',
        label: 'Running gags',
        type: 'list',
        max: 3,
        itemMax: 120,
        assistHint: 'De 1 a 3 blagues ou situations recurrentes qui reviennent d une publication a l autre.',
      },
    ],
  };
}

function platformsBlock() {
  return {
    key: 'platforms',
    label: 'Plateformes',
    fields: [
      {
        key: 'bioInstagram',
        label: 'Bio Instagram',
        type: 'text',
        max: 150,
        assistHint: 'Bio Instagram de 150 caracteres MAXIMUM (espaces et emojis compris). Dit qui, quoi, pourquoi suivre. Dans la voix definie. Evite la formule "Metier. Lieu. Chiffre. Emoji." : choisis une construction propre a ce personnage (une phrase, une question, une consigne...) ; l emoji est facultatif.',
      },
      {
        key: 'bioTiktok',
        label: 'Bio TikTok',
        type: 'text',
        max: 80,
        assistHint: 'Bio TikTok de 80 caracteres MAXIMUM. Plus courte et plus directe que la bio Instagram.',
      },
      {
        key: 'bioX',
        label: 'Bio X',
        type: 'text',
        max: 160,
        assistHint: 'Bio X de 160 caracteres MAXIMUM. Peut assumer une opinion.',
      },
      {
        key: 'handles',
        label: 'Pseudos par plateforme',
        type: 'list',
        max: 3,
        itemMax: 40,
        assistHint: 'Un pseudo par plateforme, au format "instagram: @...", "tiktok: @...", "x: @...". Lisibles, sans chiffres aleatoires, 30 caracteres max apres le @.',
      },
      {
        key: 'signatureHashtags',
        label: 'Hashtags de signature',
        type: 'list',
        max: 6,
        itemMax: 40,
        assistHint: 'De 3 a 6 hashtags, dont au moins un propre au compte. Precis, pas de hashtags generiques (#love, #instagood).',
      },
    ],
  };
}

const PERSONA_BLOCKS = [
  {
    key: 'identity',
    label: 'Etat civil',
    fields: [
      {
        key: 'displayName',
        label: 'Nom affiche',
        type: 'text',
        max: 60,
        column: 'name',
        assistHint: 'Le nom sous lequel le persona est connu (prenom seul, surnom ou nom de scene).',
      },
      { key: 'firstName', label: 'Prenom', type: 'text', max: 40, assistHint: 'Un prenom plausible pour l age, l origine et la generation, pas un prenom a la mode choisi par defaut.' },
      { key: 'lastName', label: 'Nom', type: 'text', max: 40, assistHint: 'Un nom de famille plausible pour l origine. Jamais celui d une personne connue.' },
      { key: 'nickname', label: 'Pseudo', type: 'text', max: 40, assistHint: 'Le surnom utilise par les proches, seul : pas d explication ni de parentheses (l origine, si elle compte, va dans l histoire).' },
      {
        key: 'age',
        label: 'Age',
        type: 'number',
        min: 18,
        max: 90,
        optional: true,
        assistHint: 'Age en annees (adulte uniquement, 18 minimum). Un nombre. Optionnel : laisse le champ vide sauf si l age est utile a l histoire.',
      },
      {
        key: 'location',
        label: 'Ville / pays',
        type: 'text',
        max: 80,
        seedable: true,
        seedCategory: 'places',
        assistHint: 'Ville ou quartier precis et pays. Une ville moyenne ou un lieu inattendu vaut mieux qu une capitale par defaut.',
      },
      { key: 'languages', label: 'Langues et registre', type: 'text', max: 140, assistHint: 'Langues parlees et registre (familier, soutenu, argot regional...), avec un detail (ex : "passe a l espagnol quand il s enerve").' },
      { key: 'background', label: 'Origine sociale ou culturelle', type: 'text', max: 200, assistHint: 'Milieu d origine concret (metier des parents, region, contexte), sans cliche ni stereotype sur un groupe.' },
      {
        key: 'occupation',
        label: 'Metier actuel ou ancien',
        type: 'text',
        max: 120,
        seedable: true,
        seedCategory: 'occupations',
        assistHint: 'Metier precis, actuel ou ancien, qui nourrit le contenu (ex : "ancienne geometre du cadastre").',
      },
    ],
  },
  {
    key: 'backstory',
    label: 'Histoire',
    fields: [
      { key: 'foundingEvent', label: 'Evenement fondateur', type: 'longtext', max: 500, assistHint: 'Un evenement precis, date ou situe, qui a change sa trajectoire. Concret : un lieu, un objet, une personne (fictive).' },
      { key: 'whyContent', label: 'Pourquoi il/elle fait du contenu', type: 'longtext', max: 400, assistHint: 'La vraie raison, pas "partager sa passion" : un manque, une revanche, un besoin d argent, une promesse faite a quelqu un...' },
      { key: 'untold', label: 'Ce qu il/elle ne raconte pas', type: 'longtext', max: 300, assistHint: 'Un secret ou une zone d ombre qui explique un comportement visible, jamais revele dans les publications. Pas de drame gratuit.' },
    ],
  },
  {
    key: 'beliefs',
    label: 'Convictions',
    fields: [
      { key: 'coreBeliefs', label: 'Croyances', type: 'list', max: 4, itemMax: 140, assistHint: 'De 2 a 4 croyances concretes sur son domaine ou la vie, formulees comme il/elle les dirait.' },
      { key: 'petPeeves', label: 'Ce qui l enerve', type: 'list', max: 4, itemMax: 120, assistHint: 'De 2 a 4 agacements precis et quotidiens (ex : "les tutos qui sautent l etape du ponçage").' },
      { key: 'strongOpinions', label: 'Opinions tranchees', type: 'list', max: 3, itemMax: 160, assistHint: 'De 2 a 3 opinions discutables mais defendables, liees a la niche. Jamais politiques, religieuses ou visant un groupe de personnes.' },
      {
        key: 'contradiction',
        label: 'Contradiction assumee',
        type: 'text',
        max: 200,
        seedable: true,
        seedCategory: 'flaws',
        assistHint: 'Une contradiction precise entre ses discours et ses actes, qu il/elle assume avec humour (ex : "prone la reparation mais change de telephone tous les ans"). C est ce qui rend le persona credible.',
      },
    ],
  },
  {
    key: 'tastes',
    label: 'Gouts',
    fields: [
      { key: 'likes', label: 'Aime', type: 'list', max: 5, itemMax: 100, assistHint: 'De 3 a 5 choses precises et un peu surprenantes (un plat d une region, un auteur peu connu, une heure de la journee, un bruit).' },
      { key: 'dislikes', label: 'N aime pas', type: 'list', max: 5, itemMax: 100, assistHint: 'De 3 a 5 rejets precis, pas des generalites ("l hypocrisie").' },
      {
        key: 'obsessions',
        label: 'Obsessions',
        type: 'list',
        max: 3,
        itemMax: 120,
        seedable: true,
        seedCategory: 'obsessions',
        assistHint: 'De 1 a 3 obsessions tres specifiques, avec un detail qui montre la profondeur. Varie la FORME : un rituel, une peur, un conflit de voisinage, un talent inutile, un projet jamais fini, une collection... Une obsession n est pas forcement un classement ni une collection chiffree ; n ecris un nombre precis que si c est vraiment naturel, et jamais un chiffre rond.',
      },
      {
        key: 'rituals',
        label: 'Rituels',
        type: 'list',
        max: 3,
        itemMax: 120,
        seedable: true,
        seedCategory: 'lifeRhythms',
        assistHint: 'De 1 a 3 rituels quotidiens ou hebdomadaires concrets, avec l heure ou le lieu.',
      },
      { key: 'guiltyPleasures', label: 'Plaisirs coupables', type: 'list', max: 3, itemMax: 100, assistHint: 'De 1 a 3 plaisirs coupables qui contrastent avec son image.' },
      { key: 'fetishObjects', label: 'Objets fetiches', type: 'list', max: 3, itemMax: 100, assistHint: 'De 1 a 3 objets precis, avec leur origine (cadeau, trouvaille, heritage).' },
    ],
  },
  voiceBlock(PERSONA_SUBJECT),
  editorialBlock(PERSONA_SUBJECT),
  appearanceBlock(PERSONA_SUBJECT, { isPersona: true }),
  loreBlock(PERSONA_SUBJECT, { isPersona: true }),
  platformsBlock(),
];

function missionBlock(subject, { isActivity }) {
  const fields = [
    {
      key: 'displayName',
      label: 'Nom',
      type: 'text',
      max: 60,
      column: 'name',
      assistHint: `Le nom de ${subject}.`,
    },
    {
      key: 'mission',
      label: 'Mission',
      type: 'longtext',
      max: 300,
      column: 'description',
      assistHint: `Ce que fait ${subject} et pour qui, en 2 phrases concretes, sans jargon marketing.`,
    },
    { key: 'values', label: 'Valeurs', type: 'list', max: 4, itemMax: 100, assistHint: 'De 2 a 4 valeurs, chacune prouvee par une pratique concrete (ex : "transparence : prix de revient affiche sur chaque fiche").' },
    { key: 'promise', label: 'Promesse', type: 'text', max: 180, assistHint: 'La promesse faite au client, verifiable.' },
    { key: 'products', label: 'Produits ou services', type: 'list', max: 5, itemMax: 120, assistHint: 'De 1 a 5 produits ou services (eventuellement fictifs), nommes et decrits en une ligne chacun.' },
    { key: 'counterModel', label: 'Ennemi / contre-modele', type: 'text', max: 200, assistHint: 'Ce contre quoi la marque se definit (une pratique du secteur, pas une entreprise reelle nommee).' },
  ];

  if (isActivity) {
    fields.push(
      {
        key: 'targetAudience',
        label: 'Public cible',
        type: 'text',
        max: 200,
        column: 'targetAudience',
        assistHint: 'Le public cible decrit par une situation concrete (ex : "artisans seuls qui facturent encore sur papier"), pas par une tranche d age seule.',
      },
      { key: 'offer', label: 'Offre', type: 'longtext', max: 300, assistHint: 'L offre precise : contenu, format, prix ou fourchette, duree.' },
    );
  } else {
    fields.push({
      key: 'targetAudience',
      label: 'Public cible',
      type: 'text',
      max: 200,
      column: 'targetAudience',
      assistHint: 'Le client type decrit par une situation concrete, pas par une tranche d age seule.',
    });
  }

  return { key: 'mission', label: isActivity ? 'Activite' : 'Mission', fields };
}

const BRAND_SUBJECT = 'la marque';
const ACTIVITY_SUBJECT = 'l activite';

export const PERSONALITY_BLOCKS = {
  PERSONA: PERSONA_BLOCKS,
  BRAND: [
    missionBlock(BRAND_SUBJECT, { isActivity: false }),
    voiceBlock(BRAND_SUBJECT),
    editorialBlock(BRAND_SUBJECT),
    appearanceBlock(BRAND_SUBJECT, { isPersona: false }),
    loreBlock(BRAND_SUBJECT, { isPersona: false }),
    platformsBlock(),
  ],
  ACTIVITY: [
    missionBlock(ACTIVITY_SUBJECT, { isActivity: true }),
    voiceBlock(ACTIVITY_SUBJECT),
    editorialBlock(ACTIVITY_SUBJECT),
    appearanceBlock(ACTIVITY_SUBJECT, { isPersona: false }),
    loreBlock(ACTIVITY_SUBJECT, { isPersona: false }),
    platformsBlock(),
  ],
};

export const PERSONALITY_KINDS = Object.keys(PERSONALITY_BLOCKS);

// Profils et niches satures que le generateur doit eviter sauf demande explicite.
export const PERSONALITY_ANTI_PATTERNS = [
  'wellness, yoga, meditation, "self-care"',
  'lifestyle voyage, digital nomad, "vanlife"',
  'fitness motivation, transformation physique',
  '"girl boss", entrepreneuriat motivationnel, "mindset"',
  'mode et beaute generalistes, "outfit of the day"',
  'cuisine healthy, "meal prep", smoothie bowls',
  'routine matinale productive, "5h du matin"',
  'developpement personnel, citations inspirantes',
  'gaming generaliste, reaction videos',
  'crypto, trading, "revenus passifs"',
];
