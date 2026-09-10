/**
 * Assistant Claude autour du prompt : transforme une idee libre exprimee par
 * l'utilisateur en prompt exploitable, dans les 3 zones qui en ont besoin
 * (prompt libre image/video, champs d'un widget, slides de carrousel). Meme
 * style que useWidgets.js : de simples wrappers $fetch, aucune logique.
 */
export function usePromptAssist() {
  async function assistFreePrompt({ idea, mediaType, profileId }) {
    return await $fetch('/api/generate/prompt-assist', {
      method: 'POST',
      body: { idea, mediaType, profileId },
    })
  }

  async function assistWidgetFields({ widgetId, idea, profileId }) {
    return await $fetch('/api/widgets/fields-assist', {
      method: 'POST',
      body: { widgetId, idea, profileId },
    })
  }

  async function assistCarouselSlides({ idea, profileId }) {
    return await $fetch('/api/generate/carousel-assist', {
      method: 'POST',
      body: { idea, profileId },
    })
  }

  return { assistFreePrompt, assistWidgetFields, assistCarouselSlides }
}
