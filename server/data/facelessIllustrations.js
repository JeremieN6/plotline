/**
 * Illustrations du dossier faceless d une persona : petites images qui
 * illustrent le propos d une video (photo dans un polaroid, image de stock,
 * maquette d ecran). Generees UNE fois (ou importees), puis reutilisees.
 */

export const ILLUSTRATION_KINDS = {
  photo: 'Photo réaliste',
  illustration: 'Illustration dans la DA',
  mockup: 'Maquette d\'écran',
};

export const MAX_ILLUSTRATIONS = 60;
// Au plus 3 nouvelles images generees automatiquement pour UNE video.
export const MAX_NEW_PER_VIDEO = 3;
export const MAX_ILLUSTRATION_PROMPT = 400;

export const ILLUSTRATION_SOURCES = ['generated', 'upload'];
