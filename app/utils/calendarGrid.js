/**
 * Logique pure du calendrier mensuel : grille en semaines, trou a venir, resume du mois, statuts et legendes.
 * Les dates sont en heure locale du navigateur. Une « entree » du calendrier :
 * { id, format, status, scheduledAt, caption, hashtags: string[], planId?, itemId? }.
 */

import { contentTypeOf } from './contentTypes.js'

export const startOfDay = (value) => {
  const date = new Date(value)
  date.setHours(0, 0, 0, 0)
  return date
}

export const addDays = (value, days) => {
  const date = new Date(value)
  date.setDate(date.getDate() + days)
  return date
}

export const sameDay = (a, b) => startOfDay(a).getTime() === startOfDay(b).getTime()

/** « 2026-10 » */
export const monthKey = (value) => {
  const date = new Date(value)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

/** « 2026-10 » -> 1er du mois (null si invalide). */
export function parseMonthKey(key) {
  const match = /^(\d{4})-(\d{2})$/.exec(String(key || ''))
  if (!match) return null
  const month = Number(match[2])
  return month >= 1 && month <= 12 ? new Date(Number(match[1]), month - 1, 1) : null
}

/** Statut d'affichage d'un contenu produit (PROCESSING, PENDING, VALIDATED, PUBLISHED). */
export function statusFromContent(status) {
  const value = String(status || '').toUpperCase()
  if (value === 'PROCESSING') return 'generating'
  if (value === 'PUBLISHED') return 'published'
  return 'approved'
}

/**
 * Separe la legende de son dernier bloc de hashtags (le plan approuve enregistre « legende, ligne vide, hashtags »).
 * -> { text, tags }
 */
export function splitCaption(raw) {
  const lines = String(raw || '').trim().split(/\n+/)
  let end = lines.length
  while (end > 0 && /^(\s*#[^\s#]+\s*)+$/.test(lines[end - 1])) end -= 1
  const tags = (lines.slice(end).join(' ').match(/#[^\s#]+/g)) || []
  return { text: lines.slice(0, end).join('\n').trim(), tags }
}

/** Hashtags d'une chaine separee par des espaces. */
export const parseTags = (text) => (String(text || '').match(/#?[^\s#]+/g) || []).map((tag) => (tag.startsWith('#') ? tag : `#${tag}`))

/** Heure « 18:00 » (24 h, heure locale). */
export function timeLabel(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

/**
 * Grille du mois, lundi en premier : un tableau de semaines de 7 cases.
 * Case : { key, index, date | null, day, inMonth, isToday, isPast, isFuture, items }.
 * `isFuture` = jour d'aujourd'hui inclus ; les cases hors du mois sont vides.
 */
export function buildMonthWeeks(monthDate, entries = [], today = new Date()) {
  const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1)
  const total = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate()
  const lead = (first.getDay() + 6) % 7
  const todayStart = startOfDay(today)
  const cells = []

  for (let i = 0; i < lead; i += 1) cells.push({ key: `pad-${i}`, date: null, day: '', inMonth: false, items: [] })
  for (let day = 1; day <= total; day += 1) {
    const date = new Date(first.getFullYear(), first.getMonth(), day)
    cells.push({
      key: `d-${monthKey(date)}-${day}`,
      date,
      day,
      inMonth: true,
      isToday: sameDay(date, todayStart),
      isPast: date < todayStart,
      isFuture: date >= todayStart,
      items: entries
        .filter((entry) => sameDay(entry.scheduledAt, date))
        .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt)),
    })
  }
  while (cells.length % 7 !== 0) cells.push({ key: `tail-${cells.length}`, date: null, day: '', inMonth: false, items: [] })

  const weeks = []
  cells.forEach((cell, index) => { cell.index = index })
  for (let i = 0; i < cells.length; i += 7) {
    const week = cells.slice(i, i + 7)
    weeks.push({ key: `w-${i / 7}`, cells: week, hasItems: week.some((cell) => cell.items.length) })
  }
  return weeks
}

/**
 * Trou a venir : de la fin de la derniere publication planifiee (ou d'aujourd'hui) a la fin du mois affiche.
 * Renvoie { start, end, days } ou null (mois passe, mois couvert, trou de moins de `minDays` jours).
 */
export function findTrailingGap(monthDate, entries = [], today = new Date(), minDays = 3) {
  const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1)
  const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0)
  const todayStart = startOfDay(today)
  if (monthEnd < todayStart) return null

  const from = monthStart > todayStart ? monthStart : todayStart
  const planned = entries
    .map((entry) => startOfDay(entry.scheduledAt))
    .filter((date) => date >= from && date <= monthEnd)
    .sort((a, b) => a - b)
  const start = planned.length ? addDays(planned[planned.length - 1], 1) : from
  if (start > monthEnd) return null
  const days = Math.round((monthEnd - start) / 86400000) + 1
  return days >= minDays ? { start, end: monthEnd, days } : null
}

/** Duree proposee pour couvrir `days` jours : 7, 14 ou 30. */
export const presetDays = (days) => [7, 14, 30].find((option) => option >= days) || 30

/** Resume des contenus d'un mois : { total, feed, reel, story }. */
export function summarizeMonth(monthDate, entries = []) {
  const key = monthKey(monthDate)
  const summary = { total: 0, feed: 0, reel: 0, story: 0 }
  for (const entry of entries) {
    if (monthKey(entry.scheduledAt) !== key) continue
    summary.total += 1
    summary[contentTypeOf(entry.format).key] += 1
  }
  return summary
}

/** Nombre de publications visees sur le mois d'apres la cadence hebdomadaire (0 si inconnue). */
export function monthTarget(postsPerWeek, monthDate) {
  const perWeek = Number(postsPerWeek)
  if (!Number.isFinite(perWeek) || perWeek <= 0) return 0
  const days = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate()
  return Math.max(1, Math.round((perWeek * days) / 7))
}
