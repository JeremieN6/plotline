import { watch } from 'vue'

const WELCOME_STORAGE_KEY = 'plotline:welcome-pending'

const CAPABILITIES_BY_TYPE = {
  INFLUENCER_CREATOR: {
    title: 'Bienvenue créateur·ice d identités virtuelles',
    message: 'Tu peux créer tes influenceuses IA, piloter ton calendrier et lancer tes générations en quelques clics.',
    actionLabel: 'Ouvrir le dashboard',
  },
  CONTENT_CREATOR: {
    title: 'Bienvenue créateur·ice de contenu',
    message: 'Ton studio est prêt pour produire des visuels, préparer tes lots de contenus et garder un rythme régulier.',
    actionLabel: 'Ouvrir le studio',
  },
  BRAND: {
    title: 'Bienvenue espace marque',
    message: 'Tu peux structurer ton brand studio, générer des contenus cohérents et garder une ligne visuelle claire.',
    actionLabel: 'Ouvrir le brand studio',
  },
}

function readPendingWelcome() {
  if (!process.client) return null

  try {
    const raw = window.sessionStorage.getItem(WELCOME_STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    window.sessionStorage.removeItem(WELCOME_STORAGE_KEY)
    return null
  }
}

function clearPendingWelcome() {
  if (!process.client) return
  window.sessionStorage.removeItem(WELCOME_STORAGE_KEY)
}

export function markWelcomePending(options = {}) {
  if (!process.client) return

  const payload = {
    reason: options?.reason === 'signup' ? 'signup' : 'login',
    waitForAccountType: Boolean(options?.waitForAccountType),
    createdAt: Date.now(),
  }

  window.sessionStorage.setItem(WELCOME_STORAGE_KEY, JSON.stringify(payload))
}

export function useWelcomeMessage() {
  const route = useRoute()
  const { user } = useAuthSession()
  const { pushToast } = useUiFeedback()
  const displayed = useState('welcome-toast-displayed', () => false)

  watch(
    [() => user.value, () => route.path],
    () => {
      if (!process.client || displayed.value) return
      if (!user.value?.id) return
      if (route.path.startsWith('/auth')) return

      const pending = readPendingWelcome()
      if (!pending) return

      const accountType = String(user.value?.accountType || '').trim().toUpperCase()
      if (pending.waitForAccountType && !accountType) return

      const capability = CAPABILITIES_BY_TYPE[accountType]
      const actionHref = resolveAccountHomePath(accountType)
      const title = capability?.title || 'Bienvenue sur Plotline'
      const baseMessage = capability?.message || 'Ton espace est prêt. Tu peux démarrer ta production IA dès maintenant.'
      const message = pending.reason === 'signup'
        ? `Merci pour ton inscription. ${baseMessage}`
        : baseMessage

      pushToast({
        title,
        message,
        tone: 'success',
        duration: 6400,
        actionLabel: capability?.actionLabel || 'Commencer',
        actionHref,
      })

      displayed.value = true
      clearPendingWelcome()
    },
    { immediate: true },
  )
}