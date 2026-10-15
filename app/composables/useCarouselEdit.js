// Modification d un carrousel dans le Studio : passer d une slide a l autre,
// en ajouter, en retirer, ou tout regenerer. Partage par /studio et
// /brand-studio. Une slide reste un contenu autonome (regroupe par carouselId) :
// chaque action passe par les routes existantes (GET/DELETE /api/content/:id,
// POST /api/content/:id/regenerate, POST /api/generate/image).

export const CAROUSEL_EDIT_MAX_SLIDES = 10
// Tarif indicatif d une image Gemini (a verifier sur la console Google).
export const CAROUSEL_EDIT_IMAGE_COST_USD = 0.134

const POLL_MS = 5000
const POLL_MAX_TICKS = 120

export function useCarouselEdit({ editingContentId, prompt, errorMessage, loading, previewUrl = null, applyContent, notify = null }) {
  const slides = ref([])
  const meta = ref(null)
  const addingSlide = ref(false)
  const drafts = {}
  let pollTimer = null
  let pollTicks = 0

  const isCarousel = computed(() => slides.value.length > 1)
  const canAdd = computed(() => isCarousel.value && slides.value.length < CAROUSEL_EDIT_MAX_SLIDES)
  const currentSlide = computed(() => slides.value.find((slide) => slide.id === editingContentId.value) || null)
  const canRemove = computed(() => isCarousel.value && !addingSlide.value && currentSlide.value?.status !== 'PROCESSING')
  const regenerableCount = computed(() => slides.value.filter((slide) => slide.status === 'PENDING').length)

  function say(title, message, tone = 'success') {
    if (typeof notify === 'function') notify({ title, message, tone })
  }

  function init(content) {
    slides.value = Array.isArray(content?.slides) ? content.slides : []
    meta.value = {
      influencerId: content?.influencerId || '',
      ambassadorId: content?.ambassadorId || null,
      campaignId: content?.campaignId || null,
      carouselId: String(content?.carouselId || '').trim(),
    }
    if (slides.value.some((slide) => slide.status === 'PROCESSING')) startPolling()
  }

  function draftFor(id) {
    return drafts[id]
  }

  function saveDraft() {
    if (editingContentId.value && !addingSlide.value) drafts[editingContentId.value] = prompt.value
  }

  // Charge une slide dans le formulaire (et rafraichit la liste des slides).
  async function loadInto(id) {
    const content = await $fetch(`/api/content/${id}`)
    if (Array.isArray(content?.slides) && content.slides.length > 1) slides.value = content.slides
    addingSlide.value = false
    applyContent(content, id)
  }

  async function switchTo(id) {
    if (!id || loading.value) return
    if (id === editingContentId.value && !addingSlide.value) return
    errorMessage.value = ''
    saveDraft()
    try {
      await loadInto(id)
    } catch (err) {
      errorMessage.value = err?.data?.statusMessage || err?.message || 'Impossible de charger cette slide.'
    }
  }

  function startAdd() {
    if (!canAdd.value || loading.value) return
    errorMessage.value = ''
    saveDraft()
    addingSlide.value = true
    prompt.value = ''
    if (previewUrl) previewUrl.value = ''
  }

  async function cancelAdd() {
    if (!addingSlide.value || loading.value) return
    errorMessage.value = ''
    try {
      await loadInto(editingContentId.value)
      if (draftFor(editingContentId.value) !== undefined) prompt.value = drafts[editingContentId.value]
    } catch (err) {
      errorMessage.value = err?.data?.statusMessage || err?.message || 'Impossible de recharger la slide.'
    }
  }

  // Ajoute une slide a la fin du carrousel, a partir du prompt du formulaire.
  async function submitAdd() {
    const text = prompt.value.trim()
    if (!text) throw new Error('Écris le prompt de la nouvelle slide.')
    if (!meta.value?.carouselId || !meta.value?.influencerId) throw new Error('Carrousel introuvable.')

    const position = Math.max(0, ...slides.value.map((slide) => Number(slide.position || 0))) + 1
    const result = await $fetch('/api/generate/image', {
      method: 'POST',
      body: {
        influencerId: meta.value.influencerId,
        ambassadorId: meta.value.ambassadorId || null,
        campaignId: meta.value.campaignId || null,
        workflowType: 'free',
        prompt: text,
        contentType: 'feed',
        carouselId: meta.value.carouselId,
        carouselPosition: position,
      },
    })
    if (!result?.contentId) throw new Error('La nouvelle slide n a pas pu être lancée.')

    const previousId = editingContentId.value
    slides.value = [...slides.value, { id: result.contentId, imageUrl: '', prompt: text, status: 'PROCESSING', position }]
    addingSlide.value = false
    try {
      await loadInto(result.contentId)
    } catch {
      // la slide est bien creee : si on ne peut pas l ouvrir, on revient a la precedente
      await loadInto(previousId).catch(() => {})
    }
    startPolling()
    say('Slide ajoutée', 'La nouvelle slide est en cours de génération.')
  }

  // Retire la slide en cours (son image est supprimee definitivement).
  async function removeCurrent() {
    if (!canRemove.value || loading.value) return
    const id = editingContentId.value
    const index = slides.value.findIndex((slide) => slide.id === id)
    if (!window.confirm('Retirer cette slide du carrousel ? Son image sera supprimée définitivement.')) return

    loading.value = true
    errorMessage.value = ''
    try {
      await $fetch(`/api/content/${id}`, { method: 'DELETE' })
      delete drafts[id]
      slides.value = slides.value.filter((slide) => slide.id !== id)
      const next = slides.value[Math.min(Math.max(index, 0), slides.value.length - 1)]
      if (next) await loadInto(next.id)
      say('Slide retirée', slides.value.length > 1 ? 'Le carrousel a été mis à jour.' : 'Il ne reste qu\'une image : ce n\'est plus un carrousel.')
    } catch (err) {
      errorMessage.value = err?.data?.statusMessage || err?.message || 'Suppression impossible.'
    } finally {
      loading.value = false
    }
  }

  // Relance TOUTES les slides en attente, chacune depuis son prompt actuel
  // (brouillon en cours compris). Une image payante par slide.
  async function regenerateAll() {
    if (loading.value || addingSlide.value) return
    const targets = slides.value.filter((slide) => slide.status === 'PENDING')
    if (!targets.length) {
      errorMessage.value = 'Aucune slide prête à être régénérée (attends la fin des générations en cours).'
      return
    }
    const cost = (targets.length * CAROUSEL_EDIT_IMAGE_COST_USD).toFixed(2).replace('.', ',')
    if (!window.confirm(`Régénérer ${targets.length} slide(s) à partir de leur prompt actuel ? Coût indicatif : ${cost} $ (${targets.length} image(s)).`)) return

    saveDraft()
    loading.value = true
    errorMessage.value = ''
    let started = 0
    const failed = []
    try {
      for (const slide of targets) {
        const text = String(drafts[slide.id] ?? slide.prompt ?? '').trim()
        if (!text) {
          failed.push(slide)
          continue
        }
        try {
          await $fetch(`/api/content/${slide.id}/regenerate`, { method: 'POST', body: { prompt: text } })
          slide.status = 'PROCESSING'
          slide.prompt = text
          delete drafts[slide.id]
          started += 1
        } catch {
          failed.push(slide)
        }
      }
    } finally {
      loading.value = false
    }
    if (started) startPolling()
    if (failed.length) {
      errorMessage.value = `${failed.length} slide(s) n'ont pas pu être relancées (prompt vide ou erreur). Les autres sont en cours.`
    }
    if (started) say('Régénération lancée', `${started} slide(s) en cours de génération.`)
  }

  // A appeler apres une regeneration reussie de la slide en cours.
  function afterRegenerate(text) {
    const id = editingContentId.value
    delete drafts[id]
    const slide = slides.value.find((item) => item.id === id)
    if (slide) {
      slide.status = 'PROCESSING'
      if (text) slide.prompt = text
    }
    startPolling()
  }

  function startPolling() {
    if (!process.client || pollTimer) return
    pollTicks = 0
    pollTimer = setInterval(async () => {
      pollTicks += 1
      if (pollTicks > POLL_MAX_TICKS || !slides.value.some((slide) => slide.status === 'PROCESSING')) {
        stopPolling()
        return
      }
      const anchor = editingContentId.value
      if (!anchor) return
      try {
        const content = await $fetch(`/api/content/${anchor}`)
        if (Array.isArray(content?.slides) && content.slides.length > 1) slides.value = content.slides
        if (previewUrl && !addingSlide.value && editingContentId.value === content?.id) {
          previewUrl.value = String(content?.imageUrl || '').trim()
        }
      } catch {
        // un echec ponctuel de lecture ne doit rien casser : prochain tour
      }
    }, POLL_MS)
  }

  function stopPolling() {
    if (pollTimer) clearInterval(pollTimer)
    pollTimer = null
  }

  function reset() {
    stopPolling()
    slides.value = []
    meta.value = null
    addingSlide.value = false
    for (const key of Object.keys(drafts)) delete drafts[key]
  }

  onBeforeUnmount(stopPolling)

  return {
    slides,
    addingSlide,
    isCarousel,
    canAdd,
    canRemove,
    regenerableCount,
    init,
    draftFor,
    switchTo,
    startAdd,
    cancelAdd,
    submitAdd,
    removeCurrent,
    regenerateAll,
    afterRegenerate,
    reset,
  }
}
