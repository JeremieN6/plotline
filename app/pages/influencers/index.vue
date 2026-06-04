<template>
  <div class="min-h-screen bg-[#FAFAF8] p-7">
    <div class="max-w-5xl mx-auto">
      <!-- Header -->
      <div class="flex items-center justify-between gap-4 mb-6">
        <h1 class="text-2xl font-bold text-gray-900">Mes influenceuses</h1>
        <button
          class="px-4 py-2 bg-[#E8873A] text-white font-bold text-sm rounded-lg hover:bg-[#d4762f] transition-colors"
          @click="goNew"
        >
          Nouvelle influenceuse
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
        <p class="text-gray-500 text-base mb-2">Impossible de charger les influenceuses pour l'instant.</p>
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
            Créer une influenceuse
          </button>
        </div>
      </div>

      <!-- Empty state -->
      <div v-else-if="!influencers.length" class="flex flex-col items-center gap-3 py-16 text-center">
        <p class="text-gray-500 text-base mb-2">Tu n'as pas encore d'influenceuse</p>
        <button
          class="px-4 py-2 bg-[#E8873A] text-white font-bold text-sm rounded-lg hover:bg-[#d4762f] transition-colors"
          @click="goNew"
        >
          Créer ma première influenceuse
        </button>
      </div>

      <!-- Grid -->
      <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div
          v-for="influencer in influencers"
          :key="influencer.id"
          class="bg-white border border-[#E5E3DF] rounded-xl p-4 shadow-sm flex flex-col justify-between min-h-[160px]"
        >
          <div class="pb-3">
            <div class="flex items-start justify-between gap-3 mb-2">
              <h3 class="text-lg font-bold text-gray-900 m-0">{{ influencer.name }}</h3>
              <span
                v-if="getNicheSummary(influencer.niche)"
                class="bg-orange-50 text-[#E8873A] px-2.5 py-1 rounded-full font-bold text-xs shrink-0"
              >
                {{ getNicheSummary(influencer.niche) }}
              </span>
            </div>
            <div v-if="getNicheList(influencer.niche).length" class="mb-3 flex flex-wrap gap-2">
              <span
                v-for="item in getNicheList(influencer.niche)"
                :key="`${influencer.id}-${item}`"
                class="rounded-full bg-[#F5F2ED] px-2.5 py-1 text-xs font-semibold text-gray-700"
              >
                {{ item }}
              </span>
            </div>
            <p class="text-gray-500 text-sm mb-1">{{ influencer.style || '—' }}</p>
            <p class="text-gray-500 text-sm">
              Face ref : <strong class="text-gray-700">{{ influencer.faceRefPath ? 'Oui' : 'Non' }}</strong>
            </p>
          </div>

          <div class="flex gap-3 mt-3 flex-wrap">
            <button
              class="px-3 py-2 bg-[#E8873A] text-white font-bold text-sm rounded-lg hover:bg-[#d4762f] transition-colors"
              @click="goGenerate(influencer.id)"
            >
              Générer une image
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
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const userId = 'user-test'
const deletingIds = ref([])
const { requestConfirmation, pushToast } = useUiFeedback()

const {
  data,
  pending: loading,
  error,
  refresh,
} = await useFetch('/api/influencers', {
  key: 'influencers',
  query: { userId },
})
const influencers = computed(() => data.value ?? [])

function getNicheList(value) {
  return splitNiches(value)
}

function getNicheSummary(value) {
  return summarizeNiches(value)
}

function goNew() {
  router.push('/influencers/new')
}

function goEdit(id) {
  router.push(`/influencers/${id}/edit`)
}

function goGenerate(id) {
  router.push(`/influencers/${id}/generate`)
}

async function removeInfluencer(id) {
  if (deletingIds.value.includes(id)) {
    return
  }

  const confirmed = await requestConfirmation({
    title: 'Supprimer cette influenceuse ?',
    message: 'Cette action retire aussi ses contenus générés liés.',
    confirmLabel: 'Supprimer',
    cancelLabel: 'Annuler',
    tone: 'danger',
  })

  if (!confirmed) {
    return
  }

  deletingIds.value = [...deletingIds.value, id]

  try {
    await $fetch(`/api/influencers/${id}`, {
      method: 'DELETE',
    })
    await refresh()
    pushToast({
      title: 'Influenceuse supprimée',
      message: 'La liste a été mise à jour.',
      tone: 'success',
    })
  } catch (err) {
    console.error('Failed to delete influencer', err)
    pushToast({
      title: 'Suppression impossible',
      message: "La suppression a échoué.",
      tone: 'error',
      duration: 4500,
    })
  } finally {
    deletingIds.value = deletingIds.value.filter((currentId) => currentId !== id)
  }
}
</script>
