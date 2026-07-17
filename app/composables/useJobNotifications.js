import { watch } from 'vue'

export function useJobNotifications() {
  const { pushToast } = useUiFeedback()
  const notifiedContentIds = useState('plotline-job-notifications', () => ({}))
  const POLL_FAST_MS = 15_000
  const POLL_IDLE_MS = 60_000
  let timerId = null
  let currentPollInterval = POLL_FAST_MS
  let activeContentIds = new Set()

  async function pollJobs() {
    try {
      const jobs = await $fetch('/api/jobs/active')
      const nextActiveIds = new Set((jobs || []).map((job) => String(job.id)))
      const disappearedIds = [...activeContentIds].filter((contentId) => !nextActiveIds.has(contentId))

      activeContentIds = nextActiveIds
    const targetInterval = nextActiveIds.size > 0 ? POLL_FAST_MS : POLL_IDLE_MS
    if (targetInterval !== currentPollInterval && timerId) {
      currentPollInterval = targetInterval
      window.clearInterval(timerId)
      timerId = window.setInterval(pollJobs, currentPollInterval)
    }
      for (const contentId of disappearedIds) {
        if (notifiedContentIds.value?.[contentId]) {
          continue
        }

        const content = await $fetch(`/api/content/${contentId}`)
        if (content?.status === 'VALIDATED') {
          const influencerName = content?.influencer?.name || 'Influenceuse'
          pushToast({
            title: `Contenu prêt — ${influencerName}`,
            message: 'La génération est terminée.',
            tone: 'success',
            duration: 6000,
            actionLabel: 'Voir',
            actionHref: `/influencers/${content.influencerId}`,
          })
        } else if (content?.status === 'FAILED') {
          pushToast({
            title: 'Génération échouée',
            message: content?.errorMessage || 'Une erreur est survenue pendant la génération.',
            tone: 'error',
            duration: 6000,
          })
        }

        notifiedContentIds.value = {
          ...(notifiedContentIds.value || {}),
          [contentId]: true,
        }
      }
    } catch {
      // Ignore transient polling errors.
    }
  }

  onMounted(() => {
    pollJobs()
    timerId = window.setInterval(pollJobs, POLL_FAST_MS)
  })

  onBeforeUnmount(() => {
    if (timerId) {
      window.clearInterval(timerId)
    }
  })

  return {
    pollJobs,
  }
}
