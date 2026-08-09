/**
 * Ambassadrices selectionnables pour une generation, partagees par le Studio et
 * le Studio marque, qui embarquaient jusqu ici la meme logique en double.
 *
 * Le rattachement a une marque (`brandId`) existe en base mais n etait consulte
 * nulle part: toutes les ambassadrices du compte apparaissaient dans la meme
 * liste, sans qu on puisse voir laquelle represente le profil courant.
 *
 * On ne retire personne de la liste. Filtrer strictement la viderait pour les
 * profils existants, dont aucun n a de rattachement: on rend l appartenance
 * visible, et le regroupement s active de lui-meme des qu un lien existe.
 */
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
      ? list.filter((item) => item?.brandId && item.brandId === activeId)
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
