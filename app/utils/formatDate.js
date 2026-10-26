/**
 * Formatage des dates, une seule fonction pour tout le produit : « mar. 6 oct., 18:00 ».
 * Pur (heure locale du navigateur).
 */

function partsOf(value) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  )
  return { date, parts }
}

/** « mar. 6 oct., 18:00 » (chaine vide si la date est invalide). */
export function formatShortDate(value) {
  const info = partsOf(value)
  if (!info) return ''
  const { parts } = info
  return `${parts.weekday} ${parts.day} ${parts.month}, ${parts.hour}:${parts.minute}`
}

/** Periode de dates : « 6–11 oct. » (meme mois) ou « 30 sept.–4 oct. ». */
export function formatDateRange(start, end) {
  const a = partsOf(start)
  const b = partsOf(end)
  if (!a || !b) return ''
  const month = (info) => info.parts.month
  if (a.date.getMonth() === b.date.getMonth() && a.date.getFullYear() === b.date.getFullYear()) {
    return a.date.getDate() === b.date.getDate() ? `${a.parts.day} ${month(a)}` : `${a.parts.day}–${b.parts.day} ${month(b)}`
  }
  return `${a.parts.day} ${month(a)}–${b.parts.day} ${month(b)}`
}

/** Valeur ISO -> { date: 'YYYY-MM-DD', time: 'HH:MM' } en heure locale (pour les champs date et heure). */
export function toLocalDateTimeFields(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return { date: '', time: '' }
  const pad = (n) => String(n).padStart(2, '0')
  return { date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`, time: `${pad(date.getHours())}:${pad(date.getMinutes())}` }
}

/** { date, time } locaux -> ISO UTC (chaine vide si incomplet ou invalide). */
export function fromLocalDateTimeFields({ date, time }) {
  if (!date) return ''
  const parsed = new Date(`${date}T${time || '00:00'}`)
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString()
}
