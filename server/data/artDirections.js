// Directions artistiques (DA) de scene pour les videos parlees (Omni Flash).
// Chaque DA est un fragment de description de scene, en anglais (les modeles
// video suivent mieux l'anglais), ajoute en tete de la scene. Ajouter une DA =
// ajouter une entree ici, aucun autre code.
//
// `speechPace` (optionnel) remplace le rythme de parole par defaut ("calm natural
// pace", voir server/utils/omniFlashPrompts.js) pour les videos faites avec cette
// DA ; sans lui, le rythme par defaut s'applique. Il garde toujours l'ancrage
// "fills about 10 seconds" : c'est lui qui evite les mots inventes ou coupes.
//
// OFFICE_SOBER est la DA historique des videos d'articles de blog (texte
// identique a l'ancien DEFAULT_SCENE_PROMPT) : elle reste le defaut quand
// aucune DA n'est demandee.

export const DEFAULT_ART_DIRECTION_ID = 'OFFICE_SOBER';

// DA A PARAMETRES (optionnel) : au lieu d'un texte fixe, une DA peut declarer des
// `parameters` (decor, lumiere, cadrage...), chacun avec des `options` { id, label,
// text } et un `default`. La scene est composee par `composeScene` (utils) :
// `baseScenePrompt` + le `text` de l'option choisie pour chaque parametre. Une
// option peut porter un `speechPace` (rythme de parole). `scenePrompt` reste la
// scene COMPOSEE AVEC LES VALEURS PAR DEFAUT (appelants externes, tests).
// Ainsi une DA couvre toutes les variations sans multiplier les entrees, et un
// reglage se retrouve par son nom (DA + valeurs, enregistre cote navigateur).
function composeDefaults(direction) {
  const parts = direction.parameters.map((parameter) => parameter.options.find((option) => option.id === parameter.default)?.text);
  return [direction.baseScenePrompt, ...parts].filter(Boolean).join(', ');
}

export const ART_DIRECTIONS = [
  {
    id: 'OFFICE_SOBER',
    label: 'Bureau sobre',
    description: 'Cadre de bureau rangé, lumière douce, ton posé. C\'est la DA des vidéos d\'articles.',
    scenePrompt:
      'A person speaking directly to the camera in a tidy, softly lit home office, natural daylight, relaxed and authentic atmosphere',
  },
  {
    id: 'UGC_PHONE',
    label: 'UGC téléphone amateur',
    description: 'Prise de vue au téléphone, lumière de fenêtre, débit vivant : l\'effet « vrai témoignage ».',
    scenePrompt:
      'Filmed handheld on a smartphone in vertical selfie style, slightly imperfect casual framing, natural window light with realistic soft shadows, a lived-in everyday room in the background, the person in casual everyday clothes with a natural unstyled look, lively and expressive delivery with natural hand gestures and small head movements, authentic unpolished amateur video feel, voice recorded on a phone',
    speechPace: 'at a lively, natural conversational pace, energetic but never rushed, that fills about 10 seconds',
  },
  {
    id: 'CINEMATIC',
    label: 'Cinéma sombre',
    description: 'Lumière contrastée à contre-jour, faible profondeur de champ, grain de pellicule.',
    scenePrompt:
      'Cinematic low-key lighting in a dim moody interior, a warm rim light from behind with cool shadows on the face, shallow depth of field with soft bokeh, a steady locked-off camera with no zoom or push-in, fine 35mm film grain and teal-and-amber color grading, the person speaks calmly and intensely directly to the camera',
    speechPace: 'at a slow, measured, deliberate pace that fills about 10 seconds',
  },
  {
    id: 'PODCAST_STUDIO',
    label: 'Studio de podcast',
    description: 'Studio de podcast avec décor, lumière, cadrage, regard et rythme réglables. Les réglages se retrouvent en les enregistrant sous un nom.',
    baseScenePrompt: 'A person seated in a professionally set up video podcast studio, speaking into a boom-arm microphone',
    parameters: [
      {
        key: 'decor',
        label: 'Décor et couleurs',
        default: 'cream_wainscot',
        options: [
          { id: 'cream_wainscot', label: 'Mur crème à moulures, fauteuil bouclé', text: 'a cream wall with elegant wainscoting panels, a cream boucle armchair and a tall floor lamp with a warm lampshade, soft neutral beige and cream palette' },
          { id: 'acoustic_dark', label: 'Panneaux acoustiques, bois sombre', text: 'dark wood acoustic panels, a leather sofa and a bookshelf with warm practical lamps, deep brown and amber palette' },
          { id: 'loft_brick', label: 'Loft en brique, plantes', text: 'an exposed red-brick loft wall with green plants, a vintage armchair and a soft neon sign, earthy warm palette' },
          { id: 'bright_white', label: 'Blanc minimal, plantes', text: 'a bright minimalist white studio with a white armchair and a few green plants, clean white and light-wood palette' },
        ],
      },
      {
        key: 'lumiere',
        label: 'Lumière',
        default: 'soft_warm',
        options: [
          { id: 'soft_warm', label: 'Douce et chaude, peau lumineuse', text: 'soft warm indoor lighting with a luminous glowing skin tone and gentle shadows' },
          { id: 'daylight', label: 'Lumière du jour naturelle', text: 'natural neutral daylight from a large window, soft and even, true-to-life colors' },
          { id: 'moody', label: 'Contrastée et sombre', text: 'low-key moody lighting with a warm rim light from behind and cool shadows on the face' },
          { id: 'bright_clean', label: 'Très lumineuse, propre', text: 'bright high-key studio lighting, clean and flattering, minimal shadows' },
        ],
      },
      {
        key: 'cadrage',
        label: 'Cadrage',
        default: 'wide_seated',
        options: [
          { id: 'wide_seated', label: 'Plan moyen large, assis en entier', text: 'one fixed locked-off tripod shot, wide-medium vertical framing with the seated speaker visible from head to knees and the microphone and part of the set in frame, no zoom and no camera movement' },
          { id: 'medium', label: 'Plan poitrine', text: 'one fixed locked-off tripod shot, medium framing from the chest up with the microphone in frame, no zoom and no camera movement' },
          { id: 'close', label: 'Gros plan visage', text: 'one fixed locked-off tripod shot, tight close-up on the face with the microphone edge in frame, no zoom and no camera movement' },
        ],
      },
      {
        key: 'regard',
        label: 'Regard',
        default: 'offcamera',
        options: [
          { id: 'offcamera', label: "Vers l'interlocuteur hors champ", text: 'the speaker looks slightly off-camera toward an unseen interviewer sitting beside the camera, never at the lens' },
          { id: 'camera', label: 'Vers la caméra', text: 'the speaker looks directly into the camera lens' },
          { id: 'mixed', label: 'Alterne caméra et interlocuteur', text: 'the speaker alternates naturally between looking toward an unseen interviewer and glancing at the camera' },
        ],
      },
      {
        key: 'rythme',
        label: 'Rythme de parole',
        default: 'calm',
        options: [
          { id: 'calm', label: 'Posé et naturel', text: 'calm conversational delivery with natural pauses', speechPace: 'at a calm, measured conversational pace with natural pauses, that fills about 10 seconds' },
          { id: 'lively', label: 'Vivant et énergique', text: 'lively expressive delivery with natural hand gestures', speechPace: 'at a lively, natural conversational pace, energetic but never rushed, that fills about 10 seconds' },
          { id: 'slow', label: 'Lent et appuyé', text: 'slow deliberate intense delivery', speechPace: 'at a slow, measured, deliberate pace that fills about 10 seconds' },
        ],
      },
    ],
  },
];

// 2e DA de podcast : production scriptee, explicative, avec CHANGEMENTS DE PLAN
// (et plusieurs intervenants possibles). Elle reutilise le decor, la lumiere et
// le rythme de la DA a plan fixe ; seuls l'enchainement de plans et le regard
// changent. Chaque plan reste stable (aucun mouvement de camera dans un plan).
const podcastFixed = ART_DIRECTIONS.find((item) => item.id === 'PODCAST_STUDIO');
ART_DIRECTIONS.push({
  id: 'PODCAST_PLANS',
  label: 'Studio de podcast, plusieurs plans',
  description: 'Production de podcast scriptée : changements de plan (large, moyen, gros plan) et plusieurs intervenants possibles. Même décor, lumière et rythme que le studio à plan fixe.',
  baseScenePrompt: 'A professionally produced multi-camera video podcast in a studio, speakers seated with boom-arm microphones',
  parameters: [
    podcastFixed.parameters.find((parameter) => parameter.key === 'decor'),
    podcastFixed.parameters.find((parameter) => parameter.key === 'lumiere'),
    {
      key: 'cadrage',
      label: 'Enchaînement de plans',
      default: 'wide_medium_close',
      options: [
        { id: 'wide_medium_close', label: 'Large, puis moyen, puis gros plan', text: 'clean editing cuts between a wide establishing shot of the studio, a medium shot of the speaker and a tighter close-up, each shot steady with no zoom or camera shake inside a shot' },
        { id: 'wide_medium', label: 'Large, puis moyen', text: 'a clean editing cut from a wide establishing shot of the studio to a medium shot of the speaker, each shot steady with no zoom or camera shake inside a shot' },
        { id: 'two_speakers', label: 'Deux intervenants, champ et contre-champ', text: 'two speakers facing each other with their own boom-arm microphones, clean editing cuts between a two-shot of both, a medium shot of the speaker and a medium shot of the listener, each shot steady with no zoom or camera shake inside a shot' },
      ],
    },
    {
      key: 'regard',
      label: 'Regard',
      default: 'interviewer',
      options: [
        { id: 'interviewer', label: "Vers l'interlocuteur", text: 'the speaker looks toward the interviewer, never at the lens' },
        { id: 'camera', label: 'Vers la caméra', text: 'the speaker looks directly into the camera lens' },
        { id: 'mixed', label: 'Alterne caméra et interlocuteur', text: 'the speaker alternates naturally between looking toward the interviewer and glancing at the camera' },
      ],
    },
    podcastFixed.parameters.find((parameter) => parameter.key === 'rythme'),
  ],
});

// Scene et rythme par defaut des DA a parametres (valeurs par defaut de chaque parametre).
for (const direction of ART_DIRECTIONS) {
  if (direction.parameters) {
    direction.scenePrompt = composeDefaults(direction);
    direction.speechPace = direction.parameters
      .flatMap((parameter) => parameter.options.filter((option) => option.id === parameter.default && option.speechPace))
      .map((option) => option.speechPace)[0];
  }
}
