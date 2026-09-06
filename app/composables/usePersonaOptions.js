/**
 * Options de creation/edition de persona dependantes du genre: silhouette et
 * placeholder de nom. Auparavant dupliquees a l'identique dans 3 ecrans
 * (profiles/new.vue, profiles/[id]/edit.vue, onboarding/brand.vue), toutes au
 * feminin -- ce fichier est la seule source, et couvre desormais les deux genres.
 */

const SILHOUETTE_OPTIONS_BY_GENDER = {
  FEMALE: [
    { value: 'SLIM', label: 'Mince', description: 'Elancee, minimaliste, editoriale' },
    { value: 'ATHLETIC', label: 'Athletique', description: 'Tonique, sportive, fit' },
    { value: 'VOLUPTUOUS', label: 'Voluptueuse', description: 'Sablier prononce, courbes marquees', isDefault: true },
    { value: 'CURVY', label: 'Harmonieuse', description: 'Courbes douces, taille dessinee, silhouette plus equilibree' },
  ],
  MALE: [
    { value: 'SLIM', label: 'Mince', description: 'Elance, silhouette fine, allure editoriale' },
    { value: 'ATHLETIC', label: 'Athletique', description: 'Tonique, sportif, fit', isDefault: true },
    { value: 'MUSCULAR', label: 'Musclé', description: 'Carrure marquee, musculature definie' },
    { value: 'STOCKY', label: 'Robuste', description: 'Carrure large, silhouette trapue et solide' },
  ],
}

const NAME_PLACEHOLDER_BY_GENDER = {
  FEMALE: 'ex : Luna',
  MALE: 'ex : Lucas',
}

function normalizeGender(gender) {
  return String(gender || '').trim().toUpperCase() === 'MALE' ? 'MALE' : 'FEMALE'
}

export function getSilhouetteOptions(gender) {
  return SILHOUETTE_OPTIONS_BY_GENDER[normalizeGender(gender)]
}

export function getDefaultSilhouette(gender) {
  return getSilhouetteOptions(gender).find((option) => option.isDefault)?.value || 'VOLUPTUOUS'
}

export function getNamePlaceholder(gender) {
  return NAME_PLACEHOLDER_BY_GENDER[normalizeGender(gender)]
}

export function usePersonaOptions() {
  return { getSilhouetteOptions, getDefaultSilhouette, getNamePlaceholder }
}
