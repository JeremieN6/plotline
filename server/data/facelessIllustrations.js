/**
 * Illustrations du dossier faceless d une persona : petites images qui
 * illustrent le propos d une video (photo dans un polaroid, image de stock,
 * maquette d ecran). Generees UNE fois (ou importees), puis reutilisees.
 */

export const ILLUSTRATION_KINDS = {
  photo: 'Photo réaliste',
  illustration: 'Illustration dans la DA',
  mockup: 'Maquette d\'écran',
  // Logo de marque : toujours IMPORTE (jamais genere : un logo invente serait faux) ; affiche petit et centre.
  logo: 'Logo de marque',
};

/** Types qu on peut faire generer (un logo ne se genere pas, il s importe). */
export const GENERATABLE_KINDS = ['photo', 'illustration', 'mockup'];

export const MAX_ILLUSTRATIONS = 60;
// Au plus 3 nouvelles images generees automatiquement pour UNE video.
export const MAX_NEW_PER_VIDEO = 3;
export const MAX_ILLUSTRATION_PROMPT = 400;

export const ILLUSTRATION_SOURCES = ['generated', 'upload'];
