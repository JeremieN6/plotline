/**
 * Assistant Claude autour du prompt : transforme une idee libre exprimee par
 * l'utilisateur en prompt exploitable, dans les 3 zones qui en ont besoin
 * (prompt libre image/video, champs d'un widget, slides de carrousel). Meme
 * style que useWidgets.js : de simples wrappers $fetch, aucune logique.
 */
export function usePromptAssist() {
  // `contextProfileId` : profil actif du Studio ; s il s agit d une marque, le serveur ajoute sa fiche et son site au contexte.
  // `attachments` : fichiers de reference deja prepares par StudioAttachmentField ({ name, data base64 }) ; le serveur les revalide.
  async function assistFreePrompt({ idea, mediaType, profileId, libraryAssetIds, contextProfileId, attachments }) {
    return await $fetch('/api/generate/prompt-assist', {
      method: 'POST',
      body: {
        idea,
        mediaType,
        profileId,
        contextProfileId: contextProfileId || undefined,
        libraryAssetIds: libraryAssetIds?.length ? libraryAssetIds : undefined,
        attachments: attachments?.length ? attachments.map(({ name, data }) => ({ name, data })) : undefined,
      },
    })
  }

  async function assistWidgetFields({ widgetId, patternId, idea, profileId, libraryAssetIds }) {
    return await $fetch('/api/widgets/fields-assist', {
      method: 'POST',
      body: { widgetId, patternId: patternId || undefined, idea, profileId, libraryAssetIds: libraryAssetIds?.length ? libraryAssetIds : undefined },
    })
  }

  async function assistCarouselSlides({ idea, profileId, contextProfileId }) {
    return await $fetch('/api/generate/carousel-assist', {
      method: 'POST',
      body: { idea, profileId, contextProfileId: contextProfileId || undefined },
    })
  }

  return { assistFreePrompt, assistWidgetFields, assistCarouselSlides }
}
