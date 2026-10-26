/**
 * Source unique des types de contenu et des statuts d un contenu planifie (calendrier, plan editorial,
 * legendes, badges). Les classes sont des tokens du kit (voir docs/ui-kit/UI.md) : aucune couleur en dur.
 */

export const CONTENT_TYPES = {
  feed: { key: 'feed', label: 'Feed', dot: 'bg-ui-accent', badge: 'bg-ui-accent-soft text-ui-accent-ink' },
  reel: { key: 'reel', label: 'Reel', dot: 'bg-ui-reel', badge: 'bg-ui-reel-soft text-ui-reel-ink' },
  story: { key: 'story', label: 'Story', dot: 'bg-ui-story', badge: 'bg-ui-story-soft text-ui-story-ink' },
}

const FORMAT_TO_TYPE = { FEED: 'feed', REEL: 'reel', STORY: 'story' }

/** Type d un format du plan (FEED, REEL, STORY ; tout autre format, ex. CUSTOM_PROMPT_STUDIO, est un feed). */
export function contentTypeOf(format) {
  return CONTENT_TYPES[FORMAT_TO_TYPE[String(format || '').toUpperCase()]] || CONTENT_TYPES.feed
}

/**
 * Statuts d un contenu planifie. `outline` : contour d une puce du calendrier (pointille = pas encore produit).
 * `spinner` et `check` : decor du badge.
 */
export const CONTENT_STATUSES = {
  draft: { key: 'draft', label: 'Brouillon', badge: 'bg-ui-subtle text-ui-ink-muted', outline: 'border-dashed' },
  approved: { key: 'approved', label: 'Approuvé', badge: 'bg-ui-success-soft text-ui-success-ink', outline: 'border-solid' },
  generating: { key: 'generating', label: 'En génération', badge: 'bg-ui-accent-soft text-ui-accent-ink', outline: 'border-dashed', spinner: true },
  published: { key: 'published', label: 'Publié', badge: 'bg-ui-success-soft text-ui-success-ink', outline: 'border-solid', check: true },
}

export function contentStatusOf(key) {
  return CONTENT_STATUSES[key] || CONTENT_STATUSES.draft
}
