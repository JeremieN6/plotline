import { watch } from 'vue'

export function useJobNotifications() {
  const { pushToast } = useUiFeedback()
  const notifiedContentIds = useState('plotline-job-notifications', () => ({}))
  let timerId = null
  let activeContentIds = new Set()

  async function pollJobs() {
    try {
      const jobs = await $fetch('/api/jobs/active')
      const nextActiveIds = new Set((jobs || []).map((job) => String(job.id)))
      const disappearedIds = [...activeContentIds].filter((contentId) => !nextActiveIds.has(contentId))

      activeContentIds = nextActiveIds

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
    timerId = window.setInterval(pollJobs, 5000)
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
