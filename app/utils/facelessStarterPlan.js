// Plan faceless « à écrire soi-même » : une trame de départ standard et la sauvegarde du plan en cours dans le navigateur.
// Rien ici n'appelle Claude : ouvrir la trame ou restaurer un plan ne coûte rien.

const DEFAULT_AVATAR = () => ({ mode: 'head', pose: 'idle', beats: [{ at: 0, expr: 'neutral', flip: false }] })

/** Une scène vide (mêmes champs que celles écrites par Claude). */
export function blankScene(overrides = {}) {
  return {
    say: '', layout: 'title', text: '', title: '', word: '', emoji: '', bg: 'main', captions: true, items: [], sfx: [], avatar: DEFAULT_AVATAR(), ...overrides,
  }
}

/**
 * Trame de départ standard : une accroche, trois points, un appel à l'action.
 * Les textes sont vides : une scène sans texte dit est ignorée au montage, jamais lue.
 */
export function starterPlan() {
  return {
    title: '',
    caption: '',
    hashtags: [],
    theme: 'papercraft-pastel',
    scenes: [
      blankScene({ layout: 'hook' }),
      blankScene({ layout: 'avatar' }),
      blankScene({ layout: 'avatar' }),
      blankScene({ layout: 'avatar' }),
      blankScene({ layout: 'avatar', bg: 'dark' }),
    ],
  }
}

export const PLAN_STORAGE_KEY = 'plotline-faceless-plan:v1'
export const PLAN_MAX_AGE_MS = 7 * 24 * 3600 * 1000

/** Pur : lit un plan sauvegardé (JSON) ; renvoie null s'il est absent, périmé, d'une autre persona ou mal formé. */
export function parseSavedPlan(raw, { profileId = '', now = Date.now() } = {}) {
  let saved
  try {
    saved = JSON.parse(String(raw || ''))
  } catch {
    return null
  }
  if (!saved || typeof saved !== 'object') return null
  if (String(saved.profileId || '') !== String(profileId || '')) return null
  if (!Number.isFinite(saved.savedAt) || now - saved.savedAt > PLAN_MAX_AGE_MS) return null
  const plan = saved.plan
  if (!plan || typeof plan !== 'object' || !Array.isArray(plan.scenes) || !plan.scenes.length) return null
  return { plan, savedAt: saved.savedAt }
}

/** Pur : sérialise le plan en cours pour le navigateur. */
export function serializePlan(plan, { profileId = '', now = Date.now() } = {}) {
  return JSON.stringify({ profileId: String(profileId || ''), savedAt: now, plan })
}
