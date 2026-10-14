/**
 * Moteur de production des REEL d un plan editorial (pur).
 *
 * Decision du 2026-10-14 : tant que Kling n a pas de credit et qu Omni Flash ne
 * donne pas un rendu publiable, les REEL d un plan sont produits par la video
 * faceless (montage code, voix ElevenLabs, aucun modele de generation video).
 * `REEL_ENGINE=legacy` rend l ancien routage (Kling / Omni Flash / Veo) sans
 * toucher au code : a poser le jour ou un de ces modeles redevient utilisable.
 */

export const REEL_ENGINES = ['faceless', 'legacy'];

export function getReelEngine(env = process.env) {
  const value = String(env?.REEL_ENGINE || '').trim().toLowerCase();
  return value === 'legacy' ? 'legacy' : 'faceless';
}

/**
 * Libelle discret affiche a cote du format d une idee, pour dire comment elle
 * sera produite. null = rien a afficher.
 */
export function describeAllFormatProductions(engine = 'faceless') {
  return Object.fromEntries(
    ['FEED', 'STORY', 'REEL', 'CUSTOM_PROMPT_STUDIO'].map((format) => [format, describeFormatProduction(format, engine)]),
  );
}

export function describeFormatProduction(format, engine = 'faceless') {
  switch (String(format || '').trim().toUpperCase()) {
    case 'REEL':
      return engine === 'legacy' ? 'Vidéo générée' : 'Vidéo faceless';
    case 'STORY':
      return 'Clip Pinterest';
    case 'FEED':
      return 'Image';
    case 'CUSTOM_PROMPT_STUDIO':
      return 'Studio';
    default:
      return null;
  }
}
