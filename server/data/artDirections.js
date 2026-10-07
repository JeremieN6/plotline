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
      'Cinematic low-key lighting in a dim moody interior, a warm rim light from behind with cool shadows on the face, shallow depth of field with soft bokeh, a slow subtle push-in camera movement, fine 35mm film grain and teal-and-amber color grading, the person speaks calmly and intensely directly to the camera',
    speechPace: 'at a slow, measured, deliberate pace that fills about 10 seconds',
  },
];
