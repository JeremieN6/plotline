/**
 * Widgets Studio: blocs selectionnables qui pre-remplissent un prompt de
 * generation a partir d'un template. Le composable charge la liste (config
 * cote serveur, server/data/widgets.js) et resout un widget rempli en prompt
 * final -- la generation elle-meme reutilise ensuite /api/generate/image ou
 * /api/generate/video, exactement comme le flux "Prompt libre" existant.
 */
export function useWidgets() {
  const widgets = ref([])
  // Patterns de prompts cures (server/data/promptPatterns.js), deja filtres
  // cote serveur selon le type de compte -- ne contient que ce que ce compte
  // a le droit de choisir. Chaque pattern porte un widgetId : filtrer cote
  // client pour n afficher que ceux du widget selectionne.
  const patterns = ref([])
  const loading = ref(false)
  const loadError = ref('')

  async function loadWidgets() {
    loading.value = true
    loadError.value = ''
    try {
      const response = await $fetch('/api/widgets')
      widgets.value = Array.isArray(response?.widgets) ? response.widgets : []
      patterns.value = Array.isArray(response?.patterns) ? response.patterns : []
    } catch (err) {
      loadError.value = err?.data?.statusMessage || err?.message || 'Impossible de charger les widgets'
    } finally {
      loading.value = false
    }
  }

  async function resolveWidget({ widgetId, patternId, profileId, inputs }) {
    return await $fetch('/api/widgets/resolve', {
      method: 'POST',
      body: { widgetId, patternId: patternId || undefined, profileId, inputs },
    })
  }

  return { widgets, patterns, loading, loadError, loadWidgets, resolveWidget }
}
