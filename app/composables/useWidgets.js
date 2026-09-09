/**
 * Widgets Studio: blocs selectionnables qui pre-remplissent un prompt de
 * generation a partir d'un template. Le composable charge la liste (config
 * cote serveur, server/data/widgets.js) et resout un widget rempli en prompt
 * final -- la generation elle-meme reutilise ensuite /api/generate/image ou
 * /api/generate/video, exactement comme le flux "Prompt libre" existant.
 */
export function useWidgets() {
  const widgets = ref([])
  const loading = ref(false)
  const loadError = ref('')

  async function loadWidgets() {
    loading.value = true
    loadError.value = ''
    try {
      const response = await $fetch('/api/widgets')
      widgets.value = Array.isArray(response?.widgets) ? response.widgets : []
    } catch (err) {
      loadError.value = err?.data?.statusMessage || err?.message || 'Impossible de charger les widgets'
    } finally {
      loading.value = false
    }
  }

  async function resolveWidget({ widgetId, profileId, inputs }) {
    return await $fetch('/api/widgets/resolve', {
      method: 'POST',
      body: { widgetId, profileId, inputs },
    })
  }

  return { widgets, loading, loadError, loadWidgets, resolveWidget }
}
