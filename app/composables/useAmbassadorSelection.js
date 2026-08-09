/**
 * Ambassadrices selectionnables pour une generation, partagees par le Studio et
 * le Studio marque, qui embarquaient jusqu ici la meme logique en double.
 *
 * Une ambassadrice peut representer plusieurs marques: le rattachement se lit
 * dans `brandIds`, avec repli sur l ancien `brandId` tant que la migration des
 * liens n est pas passee.
 *
 * On ne retire personne de la liste. Filtrer strictement la viderait pour les
 * profils sans rattachement: on rend l appartenance visible, et le regroupement
 * s active de lui-meme des qu un lien existe.
 */
function brandIdsOf(profile) {
  if (Array.isArray(profile?.brandIds) && profile.brandIds.length) {
    return profile.brandIds
  }

  return profile?.brandId ? [profile.brandId] : []
}

export function useAmbassadorSelection(profiles, activeProfileId) {
  const ambassadors = computed(() => {
    const list = unref(profiles)
    if (!Array.isArray(list)) return []
    return list.filter((item) => Boolean(String(item?.faceRefPath || '').trim()))
  })

  const hasAmbassadors = computed(() => ambassadors.value.length > 0)

  const groups = computed(() => {
    const activeId = String(unref(activeProfileId) || '')
    const list = ambassadors.value
    const attached = activeId
      ? list.filter((item) => brandIdsOf(item).includes(activeId))
      : []

    // Aucun rattachement: une seule liste, sans intitule de groupe, pour ne pas
    // afficher une distinction qui n a pas encore de sens.
    if (!attached.length) {
      return [{ key: 'all', label: '', items: list }]
    }

    const others = list.filter((item) => !attached.includes(item))
    const result = [{ key: 'attached', label: 'Rattachées à ce profil', items: attached }]

    if (others.length) {
      result.push({ key: 'others', label: 'Non rattachées', items: others })
    }

    return result
  })

  return { ambassadors, hasAmbassadors, groups }
}
