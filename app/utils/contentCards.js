// Logique pure de la page « Mes creations » (cartes, filtres, compteurs, plateformes). Testee dans
// tests/content-cards.test.mjs ; la page et ses composants n y font que de l affichage.

/** Statut d affichage d une carte : les contenus ratees ou rejetes ont leur propre etat. */
export function cardStateOf(item) {
  const status = String(item?.status || '').toUpperCase()
  if (status === 'PROCESSING') return 'generating'
  if (status === 'VALIDATED') return 'validated'
  if (status === 'PUBLISHED') return 'published'
  if (status === 'FAILED') return 'failed'
  if (status === 'REJECTED') return 'rejected'
  return 'pending'
}

/** Onglet auquel appartient un contenu (« En attente » regroupe aussi les contenus en generation). */
export function tabOf(item) {
  const state = cardStateOf(item)
  if (state === 'validated') return 'VALIDATED'
  if (state === 'published') return 'PUBLISHED'
  return 'PENDING'
}

/** Type (feed | reel | story) d un contenu, pour le filtre. */
export function typeKeyOf(item) {
  const format = String(item?.format || '').toUpperCase()
  if (format === 'REEL') return 'reel'
  if (format === 'STORY') return 'story'
  return 'feed'
}

/**
 * Compteurs des onglets, calcules sur la liste DEJA regroupee par carrousel (une carte = un contenu).
 * Les contenus echoues ou rejetes ne comptent que dans « Tout ».
 */
export function countByTab(items) {
  const counts = { ALL: 0, PENDING: 0, VALIDATED: 0, PUBLISHED: 0 }
  for (const item of items || []) {
    counts.ALL += 1
    const state = cardStateOf(item)
    if (state === 'failed' || state === 'rejected') continue
    counts[tabOf(item)] += 1
  }
  return counts
}

/** Filtre par onglet, types coches (liste vide = tous) et tri par date de creation. */
export function filterAndSort(items, { tab = 'ALL', types = [], sort = 'recent' } = {}) {
  const wanted = new Set(types)
  const list = (items || []).filter((item) => {
    if (wanted.size && !wanted.has(typeKeyOf(item))) return false
    if (tab === 'ALL') return true
    const state = cardStateOf(item)
    if (state === 'failed' || state === 'rejected') return false
    return tabOf(item) === tab
  })
  const direction = sort === 'oldest' ? 1 : -1
  return [...list].sort((a, b) => direction * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()))
}

/**
 * Accroche et suite de la legende : la premiere phrase sert de titre de carte, le reste de texte.
 * Une legende sans ponctuation de fin de phrase, ou d une seule phrase, n a pas de « suite ».
 */
export function captionHook(caption) {
  const text = String(caption || '').replace(/\r\n/g, '\n').trim()
  if (!text) return { hook: '', rest: '' }
  const newline = text.indexOf('\n')
  const sentence = text.match(/^[\s\S]*?[.!?…](?=\s|$)/)
  let end = -1
  if (sentence) end = sentence[0].length
  if (newline !== -1 && (end === -1 || newline < end)) end = newline
  if (end === -1 || end >= text.length) return { hook: text, rest: '' }
  return { hook: text.slice(0, end).trim(), rest: text.slice(end).trim() }
}

/** Image d aperçu d une video : 25 % de la duree (jamais l image 0, souvent identique d une video a l autre). */
export function posterTime(duration) {
  const value = Number(duration)
  if (!Number.isFinite(value) || value <= 0) return 0
  return Math.min(value * 0.25, Math.max(value - 0.1, 0))
}

/**
 * Pastille « Programmé 7 nov., 09:00 » d un contenu VALIDE dont la publication automatique est planifiee dans le
 * futur. Vide sinon : un contenu en attente garde sa date mais ne partira pas (le planificateur ne publie que les
 * contenus valides), une date passee est signalee autrement (voir `isScheduleOverdue`).
 */
export function scheduledBadgeLabel(item, now = Date.now()) {
  if (cardStateOf(item) !== 'validated' || !item?.scheduledAt) return ''
  const date = new Date(item.scheduledAt)
  if (Number.isNaN(date.getTime()) || date.getTime() <= now) return ''
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  )
  return `Programmé ${parts.day} ${parts.month}, ${parts.hour}:${parts.minute}`
}

/** Contenu valide dont la date planifiee est deja passee sans publication : a republier ou replanifier. */
export function isScheduleOverdue(item, now = Date.now()) {
  if (cardStateOf(item) !== 'validated' || !item?.scheduledAt) return false
  const time = new Date(item.scheduledAt).getTime()
  return Number.isFinite(time) && time <= now
}

/** 0:12, 1:05. Vide si la duree est inconnue. */
export function formatDuration(duration) {
  const value = Number(duration)
  if (!Number.isFinite(value) || value <= 0) return ''
  const total = Math.round(value)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

/**
 * Plateformes de publication automatique d un profil. TikTok n y figure pas : aucune publication TikTok
 * automatique n existe (decision actee, voir CLAUDE.md), un contenu poste la-bas passe par « Marquer comme publie ».
 */
export function publishTargets(profile) {
  return [
    { id: 'INSTAGRAM', label: 'Instagram', connected: Boolean(profile?.instagramAccountId) },
    { id: 'X', label: 'X', connected: Boolean(profile?.twitterConnected) },
  ]
}

/** Plateforme du clic principal « Publier » : Instagram si connecte, sinon X, sinon rien (bouton grise). */
export function defaultPublishTarget(profile) {
  return publishTargets(profile).find((target) => target.connected) || null
}

/** Une plateforme est deja publiee pour ce contenu ? */
export function isPublishedOn(item, platformId) {
  if (platformId === 'INSTAGRAM') return Boolean(item?.publishedAt)
  if (platformId === 'X') return Boolean(item?.twitterPublishedAt)
  return false
}

/**
 * Actions d une carte selon son etat. `primary` / `secondary` = boutons du pied de carte ; `menu` = entrees du menu ⋯
 * (dans l ordre d affichage). `edit` n est montre que si le compte peut modifier ce contenu (decide par ContentCard).
 * Il n y a pas de « Regenerer » : la regeneration passe par « Modifier » (contenu en attente), d ou « Remettre en attente » pour un contenu valide.
 */
export function actionsFor(item) {
  const state = cardStateOf(item)
  const hasCaption = Boolean(String(item?.caption || '').trim())
  const copy = hasCaption ? ['copy'] : []

  if (state === 'generating') return { primary: null, secondary: null, menu: [] }
  if (state === 'failed') {
    // Echec de PUBLICATION (le media existe) : on peut remettre le contenu en « Valide ». Echec de generation : rien a recuperer.
    const hasMedia = Boolean(String(item?.imageUrl || '').trim())
    return { primary: null, secondary: hasMedia ? 'recover' : null, menu: ['delete'] }
  }
  if (state === 'rejected') return { primary: null, secondary: null, menu: ['unvalidate', 'delete'] }
  if (state === 'pending') {
    return { primary: 'validate', secondary: 'reject', menu: ['edit', ...copy, 'delete'] }
  }
  if (state === 'validated') {
    // « Annuler la programmation » : seulement s il y a une date (a venir ou depassee) ; le contenu reste valide.
    const scheduled = item?.scheduledAt ? ['cancelSchedule'] : []
    return { primary: 'publish', secondary: 'schedule', menu: [...scheduled, 'markPublished', 'unvalidate', ...copy, 'delete'] }
  }
  // Publie : plus d action de publication ; une publication manuelle peut etre annulee.
  const manual = Boolean(item?.manualPublication)
  return { primary: null, secondary: 'detail', menu: [...(manual ? ['cancelManual'] : []), ...copy, 'delete'] }
}

const HASHTAG = /^#[\p{L}\p{N}_]+$/u

/**
 * Separe la legende de ses hashtags de fin : le dernier paragraphe, s il n est fait que de hashtags, devient la
 * liste de tags (la legende est stockee en un seul texte). Les hashtags au milieu d une phrase restent dans le texte.
 */
export function splitHashtags(caption) {
  const text = String(caption || '').replace(/\r\n/g, '\n').trimEnd()
  const lines = text.split('\n')
  let index = lines.length
  while (index > 0 && lines[index - 1].trim() && lines[index - 1].trim().split(/\s+/).every((token) => HASHTAG.test(token))) index -= 1
  if (index === lines.length) return { body: text, tags: [] }
  const tags = lines.slice(index).join(' ').split(/\s+/).filter(Boolean)
  return { body: lines.slice(0, index).join('\n').trimEnd(), tags: [...new Set(tags)] }
}

/** Inverse de splitHashtags : texte, ligne vide, puis les tags (le « # » est ajoute s il manque). */
export function joinHashtags(body, tags) {
  const cleaned = [...new Set((tags || []).map((tag) => String(tag || '').trim().replace(/^#*/, '')).filter(Boolean).map((tag) => `#${tag}`))]
  const text = String(body || '').trimEnd()
  if (!cleaned.length) return text
  return text ? `${text}\n\n${cleaned.join(' ')}` : cleaned.join(' ')
}
