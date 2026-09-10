/**
 * Definitions des widgets Studio: blocs selectionnables qui pre-remplissent un
 * prompt de generation a partir d'un template. Config statique volontairement
 * (comme variables.json/promptTemplates.js): pas d'edition de template depuis
 * l'UI en V1, ajouter un widget = ajouter une entree ici, jamais de code
 * specifique a ce widget.
 *
 * Forme d'une variable: { key, source: 'input'|'persona'|'upload', label?,
 * type?, assistHint? }. `assistHint` guide Claude quand l'utilisateur remplit
 * les champs a partir d'une idee libre (server/utils/widgetFieldsAssistGenerator.js) --
 * c'est la que vit la consigne propre a ce champ, le mecanisme de generation
 * lui-meme etant generique pour tous les widgets.
 * Forme d'un asset requis: { key, source: 'persona'|'upload', required }.
 */

export const WIDGETS = [
  {
    id: 'PORTRAIT_STUDIO',
    nom: 'Portrait Studio Persona',
    typeGeneration: ['IMAGE'],
    requiresPersona: true,
    template:
      'Create a photorealistic {{cadrage}} portrait of {{persona.description}}, wearing {{tenue}}, in a {{decor}} setting. {{lumiere}}. Natural skin texture, realistic pores, authentic proportions, no beautification, no identity change. {{style_photo}} aesthetic, {{aspect_ratio}} composition.',
    variables: [
      {
        key: 'cadrage',
        source: 'input',
        label: 'Cadrage',
        type: 'text',
        assistHint: 'Type de cadrage photo, en anglais, court (ex: close-up, medium shot, three-quarter).',
      },
      {
        key: 'tenue',
        source: 'input',
        label: 'Tenue',
        type: 'text',
        assistHint: 'Description de la tenue portee, en anglais, concrete.',
      },
      {
        key: 'decor',
        source: 'input',
        label: 'Decor',
        type: 'text',
        assistHint: 'Description du lieu/decor, en anglais, concrete et visuelle.',
      },
      {
        key: 'lumiere',
        source: 'input',
        label: 'Lumiere',
        type: 'text',
        assistHint: 'Description de l eclairage, en anglais (ex: soft natural window light, golden hour).',
      },
      {
        key: 'style_photo',
        source: 'input',
        label: 'Style photo',
        type: 'text',
        assistHint: 'Style photographique, en anglais, court (ex: editorial, cinematic, studio).',
      },
      {
        key: 'aspect_ratio',
        source: 'input',
        label: 'Format (aspect ratio)',
        type: 'text',
        assistHint: 'Format d image le plus adapte a l idee decrite (ex: 9:16, 4:5, 1:1).',
      },
      { key: 'persona.description', source: 'persona' },
    ],
    assetsRequis: [{ key: 'personaFaceRef', source: 'persona', required: true }],
    negativePrompt: 'identity change, plastic skin, extra fingers, CGI appearance, text, watermark',
  },
  {
    id: 'VLOG_LIFESTYLE',
    nom: 'Vlog Lifestyle Handheld',
    typeGeneration: ['VIDEO'],
    requiresPersona: true,
    template:
      'An ultra-realistic handheld {{type_vlog}} video. {{persona.description}} in {{decor}}. Natural handheld camera movement, casual framing, imperfect human camera operation, authentic everyday atmosphere. No scripted acting, no artificial transitions, no identity changes, camera never visible. Timeline ({{duree}}s): {{sequence_scenes}}. {{dialogue_court}}',
    variables: [
      {
        key: 'type_vlog',
        source: 'input',
        label: 'Type de vlog',
        type: 'text',
        assistHint: 'Type de vlog, en anglais, court (ex: morning routine, day in my life, get ready with me).',
      },
      {
        key: 'decor',
        source: 'input',
        label: 'Decor',
        type: 'text',
        assistHint: 'Description du lieu/decor, en anglais, concrete et visuelle.',
      },
      {
        key: 'duree',
        source: 'input',
        label: 'Duree (secondes)',
        type: 'number',
        assistHint: 'Duree totale en secondes, un nombre entier realiste pour ce format (ex: 15, 30, 45).',
      },
      {
        key: 'sequence_scenes',
        source: 'input',
        label: 'Sequence des scenes',
        type: 'textarea',
        assistHint: 'Enchainement des plans/scenes dans le temps, en anglais, concret et visuel.',
      },
      {
        key: 'dialogue_court',
        source: 'input',
        label: 'Dialogue court',
        type: 'textarea',
        assistHint: 'Courte phrase parlee par le persona, en francais, ton naturel, adresse directe a la camera.',
      },
      { key: 'persona.description', source: 'persona' },
    ],
    assetsRequis: [{ key: 'personaFaceRef', source: 'persona', required: true }],
    negativePrompt: "camera visible, changement d'identité, transitions artificielles, pose scriptée",
  },
  {
    id: 'FOOD_AD',
    nom: 'Food Ad Local Language',
    typeGeneration: ['VIDEO'],
    requiresPersona: false,
    template:
      'Create a {{duree}}-second photorealistic {{cuisine}} commercial using {{image_reference}} as the exact reference for the cast, setting and food presentation. {{sequence_preparation}}. Dialogue in {{langue_locale}}: {{repliques}}. End with a hero shot of {{plat_final}}. Same characters, same setting, same food styling throughout, no identity drift, no logos, no subtitles.',
    variables: [
      {
        key: 'duree',
        source: 'input',
        label: 'Duree (secondes)',
        type: 'number',
        assistHint: 'Duree totale en secondes, un nombre entier realiste pour une publicite courte (ex: 15, 20, 30).',
      },
      {
        key: 'cuisine',
        source: 'input',
        label: 'Cuisine',
        type: 'text',
        assistHint: 'Type de cuisine, en anglais, court (ex: Italian, street food, home cooking).',
      },
      {
        key: 'sequence_preparation',
        source: 'input',
        label: 'Sequence de preparation',
        type: 'textarea',
        assistHint: 'Etapes de preparation du plat, en anglais, concret et visuel (gestes, ingredients, cuisson).',
      },
      {
        key: 'langue_locale',
        source: 'input',
        label: 'Langue locale',
        type: 'text',
        assistHint: 'Nom de la langue a utiliser pour le champ "repliques" (deduite de l idee, francais par defaut).',
      },
      {
        key: 'repliques',
        source: 'input',
        label: 'Repliques',
        type: 'textarea',
        assistHint: 'Texte parle pendant la publicite, ecrit dans la langue donnee par le champ "langue_locale".',
      },
      {
        key: 'plat_final',
        source: 'input',
        label: 'Plat final',
        type: 'text',
        assistHint: 'Nom/description du plat final mis en avant dans le plan de fin, en anglais.',
      },
      // La reference porte le nom de la variable du template (utilisee comme
      // start frame de la video, pas injectee comme texte dans le prompt).
      { key: 'image_reference', source: 'upload', label: 'Image de reference (cast + decor + plat)' },
    ],
    assetsRequis: [{ key: 'image_reference', source: 'upload', required: true }],
    negativePrompt: 'identity drift, plastic food, exaggerated steam, subtitles, watermark',
  },
  {
    id: 'UGC_PRODUIT',
    nom: 'UGC Post - Brand Product',
    typeGeneration: ['IMAGE', 'VIDEO'],
    requiresPersona: true,
    template:
      'Format 9:16 vertical, premium UGC x {{categorie_produit}} commercial. Use the uploaded product image as the exact reference: {{description_produit_lock}}. {{persona.description}} holds/applies {{produit}}, face partially visible for authentic UGC feel. Voiceover: {{texte_voix_off}}. Shots: hook -> texture/application -> hero product reveal -> CTA final.',
    variables: [
      {
        key: 'categorie_produit',
        source: 'input',
        label: 'Categorie produit',
        type: 'text',
        assistHint: 'Categorie du produit, en anglais, courte (ex: skincare, haircare, supplement).',
      },
      {
        key: 'description_produit_lock',
        source: 'input',
        label: 'Description produit (lock)',
        type: 'textarea',
        assistHint: 'Description precise du produit (forme, couleur, packaging) a garder identique tout du long, en anglais.',
      },
      {
        key: 'produit',
        source: 'input',
        label: 'Produit',
        type: 'text',
        assistHint: 'Nom du produit, en anglais ou tel que fourni dans l idee.',
      },
      {
        key: 'texte_voix_off',
        source: 'input',
        label: 'Texte voix off',
        type: 'textarea',
        assistHint: 'Texte de la voix off, en francais, ton naturel et convaincant, adresse directe.',
      },
      { key: 'persona.description', source: 'persona' },
    ],
    assetsRequis: [
      { key: 'personaFaceRef', source: 'persona', required: true },
      { key: 'packshot', source: 'upload', required: true, label: 'Packshot produit' },
    ],
    negativePrompt: 'distorted product, altered label, fake typography, plastic skin',
  },
  {
    id: 'SCENARIO_BLOG',
    nom: 'Video Scenario',
    typeGeneration: ['VIDEO'],
    // false (comme FOOD_AD) : le Studio affiche alors le picker generique
    // "Profil (pour le classement du contenu)", sans exiger de face ref --
    // exactement ce qu il faut ici, le profil choisi n etant que le
    // proprietaire du contenu dans "Mes creations". Le verrouillage reel de
    // l identite est un choix separe, porte par une case a cocher dediee
    // dans le Studio (branchee sur withFaceRef), pas par ce champ.
    requiresPersona: false,
    template: '{{scenePrompt}}',
    variables: [
      {
        key: 'scenePrompt',
        source: 'input',
        label: 'Scène (décor, cadrage)',
        type: 'textarea',
        assistHint:
          'Decrit la scene a generer : decor, cadrage, ambiance. Concret et visuel, en anglais (les modeles video suivent mieux l anglais). Pas de texte a incruster, pas de dialogue dedans.',
      },
      {
        key: 'scriptText',
        source: 'input',
        label: 'Script parlé',
        type: 'textarea',
        assistHint:
          'Texte parle par le personnage a l ecran, en francais, 15 a 25 mots, une seule phrase percutante, tutoiement, adresse directe a la camera. Pas de guillemets, pas de didascalie.',
      },
    ],
    assetsRequis: [],
    negativePrompt: '',
  },
];

export function getWidgets() {
  return WIDGETS;
}

export function getWidgetById(id) {
  const key = String(id || '').trim().toUpperCase();
  return WIDGETS.find((widget) => widget.id === key) || null;
}
