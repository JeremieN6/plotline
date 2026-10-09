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
  // Directions artistiques de scene (server/data/artDirections.js), proposees
  // seulement aux widgets listes dans artDirectionWidgetIds (Video Scenario).
  const artDirections = ref([])
  const artDirectionWidgetIds = ref([])
  const loading = ref(false)
  const loadError = ref('')

  async function loadWidgets() {
    loading.value = true
    loadError.value = ''
    try {
      const response = await $fetch('/api/widgets')
      widgets.value = Array.isArray(response?.widgets) ? response.widgets : []
      patterns.value = Array.isArray(response?.patterns) ? response.patterns : []
      artDirections.value = Array.isArray(response?.artDirections) ? response.artDirections : []
      artDirectionWidgetIds.value = Array.isArray(response?.artDirectionWidgetIds) ? response.artDirectionWidgetIds : []
    } catch (err) {
      loadError.value = err?.data?.statusMessage || err?.message || 'Impossible de charger les widgets'
    } finally {
      loading.value = false
    }
  }

  async function resolveWidget({ widgetId, patternId, artDirectionId, profileId, inputs }) {
    return await $fetch('/api/widgets/resolve', {
      method: 'POST',
      body: { widgetId, patternId: patternId || undefined, artDirectionId: artDirectionId || undefined, profileId, inputs },
    })
  }

  return { widgets, patterns, artDirections, artDirectionWidgetIds, loading, loadError, loadWidgets, resolveWidget }
}
