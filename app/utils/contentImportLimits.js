// Limites de l import de contenus, cote navigateur : miroir de server/utils/contentImport.js
// (le serveur fait foi et revalide tout ; l egalite est verrouillee par un test).
export const IMPORT_MAX_VIDEO_BYTES = 150 * 1024 * 1024
export const IMPORT_MAX_IMAGE_BYTES = 20 * 1024 * 1024
export const IMPORT_MAX_FILES_PER_BATCH = 20
export const IMPORT_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm']
export const IMPORT_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
export const IMPORT_ACCEPT = [...IMPORT_VIDEO_TYPES, ...IMPORT_IMAGE_TYPES].join(',')

export function formatMegabytes(bytes) {
  const mb = Number(bytes) / 1048576
  if (mb < 1) return `${Math.max(1, Math.round(Number(bytes) / 1024))} Ko`
  return mb >= 100 ? `${Math.round(mb)} Mo` : `${mb.toFixed(1).replace('.', ',')} Mo`
}

/** Message pour l utilisateur, ou chaine vide si le fichier est acceptable. */
export function importFileProblem(file) {
  const type = String(file?.type || '').toLowerCase()
  const isVideo = IMPORT_VIDEO_TYPES.includes(type)
  const isImage = IMPORT_IMAGE_TYPES.includes(type)
  if (!isVideo && !isImage) return 'Format non pris en charge (MP4, MOV, WebM, JPG, PNG ou WebP).'
  if (!file.size) return 'Fichier vide.'
  const max = isVideo ? IMPORT_MAX_VIDEO_BYTES : IMPORT_MAX_IMAGE_BYTES
  if (file.size > max) return `Fichier trop lourd (${Math.round(max / 1048576)} Mo maximum).`
  return ''
}
