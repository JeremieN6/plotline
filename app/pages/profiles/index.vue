<template>
  <div class="min-h-screen bg-[#FAFAF8] p-7">
    <div class="max-w-5xl mx-auto">
      <!-- Header -->
      <div class="flex items-center justify-between gap-4 mb-6">
        <h1 class="text-2xl font-bold text-gray-900">Mes profils</h1>
        <button
          class="px-4 py-2 bg-[#E8873A] text-white font-bold text-sm rounded-lg hover:bg-[#d4762f] transition-colors"
          @click="goNew"
        >
          Nouveau profil
        </button>
      </div>

      <!-- Loading skeleton -->
      <div v-if="loading" class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div v-for="n in 3" :key="n" class="bg-white border border-[#E5E3DF] rounded-xl p-4 min-h-[160px] overflow-hidden relative">
          <div class="h-4 w-1/2 bg-gray-200 rounded mb-3 animate-pulse"></div>
          <div class="h-3 w-11/12 bg-gray-200 rounded mb-2 animate-pulse"></div>
          <div class="h-3 w-3/5 bg-gray-200 rounded mb-4 animate-pulse"></div>
          <div class="h-9 w-2/3 bg-gray-200 rounded-lg animate-pulse"></div>
        </div>
      </div>

      <!-- Error -->
      <div v-else-if="error" class="flex flex-col items-center gap-3 py-16 text-center">
        <p class="text-gray-500 text-base mb-2">Impossible de charger les profils pour l'instant.</p>
        <div class="flex gap-3 flex-wrap justify-center">
          <button
            class="px-4 py-2 bg-white border border-[#E5E3DF] text-gray-900 font-bold text-sm rounded-lg hover:bg-gray-50 transition-colors"
            @click="refresh"
          >
            Réessayer
          </button>
          <button
            class="px-4 py-2 bg-[#E8873A] text-white font-bold text-sm rounded-lg hover:bg-[#d4762f] transition-colors"
            @click="goNew"
          >
            Créer un profil
          </button>
        </div>
      </div>

      <!-- Empty state -->
      <div v-else-if="!influencers.length" class="flex flex-col items-center gap-3 py-16 text-center">
        <p class="text-gray-500 text-base mb-2">Tu n'as pas encore de profil.</p>
        <button
          class="px-4 py-2 bg-[#E8873A] text-white font-bold text-sm rounded-lg hover:bg-[#d4762f] transition-colors"
          @click="goNew"
        >
          Créer mon premier profil
        </button>
      </div>

      <!-- Sections: ambassadrices et marques sont deux natures distinctes -->
      <div v-else class="space-y-8">
        <section v-for="section in sections" :key="section.key">
          <div class="mb-3 flex items-baseline gap-2">
            <h2 class="text-sm font-bold uppercase tracking-[0.14em] text-[#A37A58]">{{ section.title }}</h2>
            <span class="text-xs font-semibold text-gray-400">{{ section.items.length }}</span>
          </div>

          <p v-if="!section.items.length" class="rounded-xl border border-dashed border-[#E5E3DF] bg-white px-4 py-4 text-sm text-gray-500">
            {{ section.empty }}
          </p>

          <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div
              v-for="influencer in section.items"
              :key="influencer.id"
              class="bg-white border border-[#E5E3DF] rounded-xl p-4 shadow-sm flex flex-col justify-between min-h-[160px]"
            >
              <div class="pb-3">
                <h3 class="mb-2 text-lg font-bold text-gray-900">{{ influencer.name }}</h3>

                <div v-if="getNicheList(influencer.niche).length" class="mb-2 flex flex-wrap gap-2">
                  <span
                    v-for="item in getNicheList(influencer.niche)"
                    :key="`${influencer.id}-${item}`"
                    class="rounded-full bg-[#F5F2ED] px-2.5 py-1 text-xs font-semibold text-gray-700"
                  >
                    {{ item }}
                  </span>
                </div>

                <div v-if="getStyleList(influencer.style).length" class="mb-3 flex flex-wrap gap-2">
                  <span
                    v-for="styleItem in getStyleList(influencer.style)"
                    :key="`${influencer.id}-style-${styleItem}`"
                    class="rounded-full bg-[#EEF3FF] px-2.5 py-1 text-xs font-semibold text-[#334B79]"
                  >
                    {{ styleItem }}
                  </span>
                </div>

                <!-- Rattachement: visible des deux cotes, et cliquable pour le modifier -->
                <div class="mb-2">
                  <p class="text-xs font-semibold uppercase tracking-[0.1em] text-gray-400">
                    {{ attachmentOf(influencer).label }}
                  </p>
                  <div v-if="attachmentOf(influencer).names.length" class="mt-1.5 flex flex-wrap gap-2">
                    <span
                      v-for="name in attachmentOf(influencer).names"
                      :key="`${influencer.id}-link-${name}`"
                      class="rounded-full bg-[#FDF0E4] px-2.5 py-1 text-xs font-semibold text-[#B45F1D]"
                    >
                      {{ name }}
                    </span>
                  </div>
                  <button
                    v-else-if="influencer.profileType === 'PERSONA'"
                    type="button"
                    class="mt-1.5 text-xs font-semibold text-[#B45F1D] underline underline-offset-2 hover:text-[#8E4B16]"
                    @click="goEdit(influencer.id)"
                  >
                    {{ attachmentOf(influencer).empty }}
                  </button>
                  <p v-else class="mt-1.5 text-xs text-gray-400">{{ attachmentOf(influencer).empty }}</p>
                </div>

                <p v-if="influencer.profileType === 'PERSONA'" class="text-gray-500 text-sm">
                  Face ref : <strong class="text-gray-700">{{ influencer.faceRefPath ? 'Oui' : 'Non' }}</strong>
                </p>
              </div>

              <div class="flex gap-3 mt-3 flex-wrap">
                <button
                  class="px-3 py-2 bg-white border border-[#E5E3DF] text-gray-700 font-bold text-sm rounded-lg hover:bg-gray-50 transition-colors"
                  @click="goDetail(influencer.id)"
                >
                  Ouvrir
                </button>
                <button
                  class="px-3 py-2 bg-[#E8873A] text-white font-bold text-sm rounded-lg hover:bg-[#d4762f] transition-colors"
                  @click="goGenerate(influencer.id)"
                >
                  Générer
                </button>
                <button
                  class="px-3 py-2 bg-white border border-[#E5E3DF] text-gray-700 font-bold text-sm rounded-lg hover:bg-gray-50 transition-colors"
                  @click="goEdit(influencer.id)"
                >
                  Modifier
                </button>
                <button
                  class="px-3 py-2 bg-white border border-[#E5E3DF] text-gray-700 font-bold text-sm rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  :disabled="deletingIds.includes(influencer.id)"
                  @click="removeInfluencer(influencer.id)"
                >
                  {{ deletingIds.includes(influencer.id) ? 'Suppression...' : 'Supprimer' }}
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const deletingIds = ref([])
const { requestConfirmation, pushToast } = useUiFeedback()
const { wording, accountType } = useWording()
const isContentCreator = computed(() => accountType.value === 'CONTENT_CREATOR')
const isBrand = computed(() => accountType.value === 'BRAND')
const activeInfluencerId = useActiveInfluencer()

const {
  data,
  pending: loading,
  error,
  refresh,
} = await useFetch('/api/profiles', {
  key: 'influencers',
})
const influencers = computed(() => data.value ?? [])

// La page listait tous les profils sous un seul titre "Mes ambassadrices",
// marques comprises. On les separe: ce sont deux natures differentes, et le
// rattachement de l une a l autre n est lisible que si les deux sont visibles.
const ambassadors = computed(() => influencers.value.filter((item) => item?.profileType === 'PERSONA'))
const brands = computed(() => influencers.value.filter((item) => item?.profileType === 'BRAND'))

function brandIdsOf(profile) {
  if (Array.isArray(profile?.brandIds) && profile.brandIds.length) return profile.brandIds
  return profile?.brandId ? [profile.brandId] : []
}

/** Marques representees par une ambassadrice. */
function brandsOf(profile) {
  const ids = brandIdsOf(profile)
  return brands.value.filter((brand) => ids.includes(brand.id))
}

/** Ambassadrices rattachees a une marque. */
function ambassadorsOf(brand) {
  return ambassadors.value.filter((profile) => brandIdsOf(profile).includes(brand.id))
}

/**
 * Rattachement affiche sur une carte, dans les deux sens: les marques d une
 * ambassadrice, les ambassadrices d une marque.
 */
function attachmentOf(profile) {
  if (profile?.profileType === 'PERSONA') {
    return {
      label: `Marques représentées`,
      names: brandsOf(profile).map((brand) => brand.name),
      empty: 'Rattacher à une marque',
    }
  }

  return {
    label: `${wording.value.ambassadorPlural.charAt(0).toUpperCase()}${wording.value.ambassadorPlural.slice(1)}`,
    names: ambassadorsOf(profile).map((item) => item.name),
    empty: `Aucune ${wording.value.ambassador} rattachée`,
  }
}

const sections = computed(() => [
  {
    key: 'ambassadors',
    title: wording.value.ambassadorPlural,
    items: ambassadors.value,
    empty: `Aucune ${wording.value.ambassador} pour l'instant.`,
  },
  {
    key: 'brands',
    title: 'Marques',
    items: brands.value,
    empty: 'Aucune marque pour l\'instant.',
  },
])

function getNicheList(value) {
  return splitNiches(value)
}

function getStyleList(value) {
  return String(value || '')
    .split(/[,|]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function goNew() {
  router.push('/profiles/new')
}

function goEdit(id) {
  router.push(`/profiles/${id}/edit`)
}

function goDetail(id) {
  router.push(`/profiles/${id}`)
}

function goGenerate(id) {
  // Le workflow Pinterest est reserve au compte influenceur: les comptes marque
  // et createur sont rediriges vers leur studio, avec le profil rendu actif.
  if (isContentCreator.value || isBrand.value) {
    activeInfluencerId.value = id
    router.push(isBrand.value ? '/brand-studio' : '/studio')
    return
  }

  router.push(`/profiles/${id}/generate`)
}

async function removeInfluencer(id) {
  if (deletingIds.value.includes(id)) {
    return
  }

  const target = influencers.value.find((item) => item.id === id)

  // Le type reel du profil fait foi: la confirmation annoncait "ambassadrice"
  // meme quand on supprimait une marque.
  const isAmbassador = target?.profileType === 'PERSONA'
  const label = isAmbassador ? wording.value.ambassador : 'marque'
  const defaultMessage = isAmbassador
    ? `Cette ${wording.value.ambassador} ne sera plus disponible pour les marques et campagnes associées.`
    : `Cette marque sera supprimée, les ${wording.value.ambassadorPlural} resteront disponibles.`

  const confirmed = await requestConfirmation({
    title: `Supprimer cette ${label} ?`,
    message: `${defaultMessage} Cette action retire aussi ses contenus générés liés.`,
    confirmLabel: 'Supprimer',
    cancelLabel: 'Annuler',
    tone: 'danger',
  })

  if (!confirmed) {
    return
  }

  deletingIds.value = [...deletingIds.value, id]

  try {
    await $fetch(`/api/profiles/${id}`, {
      method: 'DELETE',
    })
    await refresh()
    pushToast({
      title: `${label.charAt(0).toUpperCase()}${label.slice(1)} supprimée`,
      message: 'La liste a été mise à jour.',
      tone: 'success',
    })
  } catch (err) {
    console.error('Failed to delete influencer', err)
    const message = err?.data?.statusMessage || err?.message || 'La suppression a échoué.'
    pushToast({
      title: 'Suppression impossible',
      message,
      tone: 'error',
      duration: 4500,
    })
  } finally {
    deletingIds.value = deletingIds.value.filter((currentId) => currentId !== id)
  }
}
</script>
