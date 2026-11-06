// Plateformes proposees quand on marque un contenu comme publie a la main (meme liste que le serveur :
// MANUAL_PLATFORM_IDS dans server/utils/manualPublication.js, verrouillee par un test).
export const MANUAL_PLATFORMS = [
  { value: 'INSTAGRAM', label: 'Instagram' },
  { value: 'TIKTOK', label: 'TikTok' },
  { value: 'YOUTUBE', label: 'YouTube' },
  { value: 'X', label: 'X' },
  { value: 'FACEBOOK', label: 'Facebook' },
  { value: 'LINKEDIN', label: 'LinkedIn' },
]

/** « TikTok et Instagram » / « TikTok, Instagram et X » ; chaine vide si rien de valide. */
export function formatPlatforms(platforms) {
  const labels = (Array.isArray(platforms) ? platforms : [])
    .map((value) => MANUAL_PLATFORMS.find((item) => item.value === value)?.label)
    .filter(Boolean)
  if (labels.length <= 1) return labels[0] || ''
  return `${labels.slice(0, -1).join(', ')} et ${labels[labels.length - 1]}`
}

/** Lecture tolerante de la colonne `manualPublication` renvoyee par l API : { at, platforms } ou null. */
export function readManualPublication(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const platforms = (Array.isArray(value.platforms) ? value.platforms : []).filter((item) => MANUAL_PLATFORMS.some((p) => p.value === item))
  if (!value.at || Number.isNaN(new Date(value.at).getTime()) || !platforms.length) return null
  return { at: new Date(value.at).toISOString(), platforms }
}
