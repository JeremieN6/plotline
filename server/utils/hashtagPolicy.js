/**
 * Hashtags ajoutes AUTOMATIQUEMENT aux contenus (pur).
 *
 * Decision du 2026-10-14 : desactives par defaut. Les hashtags n ont plus de vraie valeur de portee (les plateformes
 * recommandent peu ou pas de hashtags, X les ignore presque) ; ce qui sert la recherche, ce sont les mots que le public
 * cherche, ecrits dans le texte de la legende. Les blocs de hashtags FIXES par categorie ("#lifestyle #dailyvibes...")
 * etaient en plus hors sujet pour la plupart des profils. Un hashtag saisi a la main reste possible partout.
 * `AUTO_HASHTAGS=true` rend l ancien comportement (blocs fixes, hashtags de marque, hashtags du planificateur).
 */
export function autoHashtagsEnabled(env = process.env) {
  return String(env?.AUTO_HASHTAGS || '').trim().toLowerCase() === 'true';
}
