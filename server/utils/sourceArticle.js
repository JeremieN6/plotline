// Article d origine d une video (facultatif) : un simple repere pour la retrouver, jamais utilise pour la generation.
// Stocke dans le renderSpec de la version (aucune colonne).

export const MAX_SOURCE_ARTICLE = 200;

/** Titre ou adresse saisi : une ligne, espaces normalises, borne. Vide si rien d exploitable. */
export function normalizeSourceArticle(value) {
  return String(value ?? '')
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_SOURCE_ARTICLE);
}

/** Lisible a partir d un slug de blog : « mon-article-sur-x » -> « Mon article sur x ». */
export function sourceArticleFromSlug(slug) {
  const text = normalizeSourceArticle(String(slug ?? '').replace(/[-_]+/g, ' '));
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : '';
}
