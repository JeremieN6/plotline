<template>
  <div class="min-h-screen bg-[#FAFAF8] p-6 font-sans">
    <div class="mx-auto max-w-6xl">
      <div
        v-if="influencer"
        class="mb-4 flex items-center gap-3 rounded-xl border border-[#E5E3DF] bg-white px-4 py-3 text-sm"
      >
        <span class="text-gray-500">Influenceuse :</span>
        <strong class="text-gray-900">{{ influencer.name }}</strong>
        <span class="rounded-full bg-orange-50 px-2.5 py-0.5 text-xs font-bold text-[#E8873A]">{{ influencer.niche }}</span>
      </div>

      <div class="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <aside class="rounded-xl border border-[#E5E3DF] bg-white p-5 shadow-sm">
          <section>
            <h2 class="mb-3 text-base font-bold text-gray-900">Type de contenu</h2>
            <div class="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              <button
                v-for="type in contentTypes"
                :key="type.value"
                type="button"
                class="relative rounded-xl border p-3 text-left transition-colors"
                :class="typeCardClass(type)"
                :disabled="type.disabled"
                @click="selectedContentType = type.value"
              >
                <span
                  v-if="type.soon"
                  class="absolute right-2 top-2 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-600"
                >
                  Bientôt
                </span>
                <p class="m-0 text-sm font-bold">{{ type.icon }} {{ type.label }}</p>
                <p class="mt-1 text-xs text-gray-500">{{ type.description }}</p>
              </button>
            </div>
          </section>

          <section class="mt-6">
            <h2 class="mb-3 text-base font-bold text-gray-900">Categorie</h2>
            <div class="flex flex-wrap gap-2.5">
              <button
                v-for="category in tagCategories"
                :key="category"
                type="button"
                class="rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors"
                :class="selectedTagCategory === category
                  ? 'border-[#E8873A] bg-[#E8873A] text-white'
                  : 'border-[#E5E3DF] bg-white text-gray-700 hover:border-[#E8873A]'"
                @click="selectedTagCategory = category"
              >
                {{ category }}
              </button>
            </div>
            <p class="mt-2 text-xs text-gray-500">
              Détermine le pool de hashtags utilisé dans la caption et l'ambiance générale.
            </p>
          </section>

          <section class="mt-6">
            <h2 class="mb-3 text-base font-bold text-gray-900">Direction creative</h2>

            <div v-for="group in optionGroups" :key="group.key" class="mb-4 last:mb-0">
              <p class="mb-2 text-sm font-semibold text-gray-800">{{ group.label }}</p>
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="option in group.options"
                  :key="option"
                  type="button"
                  class="rounded-full border px-3 py-1.5 text-xs font-medium transition-colors"
                  :class="selections[group.key] === option
                    ? 'border-[#E8873A] bg-[#E8873A] text-white'
                    : 'border-[#E5E3DF] bg-white text-gray-700 hover:border-[#E8873A]'"
                  @click="selectOption(group.key, option)"
                >
                  {{ option }}
                </button>
              </div>
            </div>
          </section>

          <button
            type="button"
            class="mt-6 w-full rounded-lg bg-[#E8873A] py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#d4762f] disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="!canGenerate"
            @click="generateImage"
          >
            Generer
          </button>

          <p v-if="errorMsg" class="mt-3 text-sm text-red-600">{{ errorMsg }}</p>
        </aside>

        <main class="min-h-[640px] rounded-xl border border-[#E5E3DF] bg-white p-5 shadow-sm">
          <div v-if="!generated && !generating" class="flex min-h-[560px] items-center justify-center text-center text-gray-400">
            Lance une génération pour voir le résultat ici.
          </div>

          <div v-else-if="generating" class="flex min-h-[560px] flex-col items-center justify-center gap-3 text-gray-500">
            <svg class="h-8 w-8 animate-spin text-[#E8873A]" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v8z" />
            </svg>
            <p>Génération en cours...</p>
          </div>

          <div v-else class="flex flex-col gap-4">
            <img :src="generated.imageUrl" alt="Image generee" class="w-full rounded-xl border border-[#E5E3DF]" />

            <div class="rounded-xl border border-[#E5E3DF] p-4">
              <div class="flex items-start justify-between gap-4">
                <p class="m-0 whitespace-pre-wrap text-sm text-gray-800">{{ generated.caption || 'Aucune caption generee.' }}</p>
                <button
                  type="button"
                  class="shrink-0 rounded-lg border border-[#E5E3DF] bg-white px-3 py-1.5 text-xs font-semibold text-gray-800 transition-colors hover:bg-gray-50"
                  @click="copyCaption"
                >
                  Copier
                </button>
              </div>
            </div>

            <p v-if="copyMsg" class="text-xs font-medium text-green-700">{{ copyMsg }}</p>

            <div class="flex flex-wrap gap-2.5">
              <button
                type="button"
                class="rounded-lg bg-[#E8873A] px-3 py-2 text-sm font-bold text-white transition-colors hover:bg-[#d4762f] disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="validating || deleting"
                @click="validateContent"
              >
                {{ validating ? 'Validation...' : 'Valider et mettre en attente' }}
              </button>
              <button
                type="button"
                class="rounded-lg border border-[#E5E3DF] bg-white px-3 py-2 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="validating || deleting"
                @click="deleteContent"
              >
                {{ deleting ? 'Suppression...' : 'Supprimer' }}
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const { pushToast } = useUiFeedback()

const { data: influencer } = await useFetch(`/api/influencers/${route.params.id}`)

const generating = ref(false)
const validating = ref(false)
const deleting = ref(false)
const errorMsg = ref('')
const copyMsg = ref('')
const generated = ref(null)
let pollingTimer = null

const contentTypes = [
  { value: 'feed', label: 'Feed', icon: '🖼️', description: 'Photo générée avec Gemini', disabled: false, soon: false },
  { value: 'reel', label: 'Reel', icon: '🎬', description: 'Vidéo avec Motion Control', disabled: true, soon: true },
  { value: 'story', label: 'Story', icon: '📱', description: "Vidéo d'ambiance faceless", disabled: true, soon: true },
]

const selectedContentType = ref('feed')
const tagCategories = ['lifestyle', 'beach', 'outfit']
const selectedTagCategory = ref('lifestyle')

const optionGroups = [
  {
    key: 'location',
    label: 'Location',
    options: [
      'bedroom mirror',
      'beach at sunset',
      'cafe terrace Paris',
      'poolside luxury',
      'hotel room morning',
      'bathroom vanity',
      'rooftop city view',
      'forest path golden hour',
      'kitchen counter',
      'balcony with city skyline',
      'linen sofa living room',
      'outdoor terrace white stone',
    ],
  },
  {
    key: 'outfit',
    label: 'Outfit',
    options: [
      'white crop top + high waist jeans',
      'black bikini',
      'beige linen dress',
      'oversized grey hoodie',
      'satin slip dress nude',
      'sport bra + leggings',
      'blazer only no shirt',
      'floral summer dress',
      'white button-down shirt half open',
      'long cardigan + cycling shorts',
    ],
  },
  {
    key: 'pose',
    label: 'Pose',
    options: [
      'mirror selfie arm raised',
      'over shoulder looking back',
      'sitting legs crossed candid',
      'standing profile arms relaxed',
      'lying on bed reading',
      'walking looking down',
      'leaning against wall',
      'head tilted soft smile',
      'sitting on floor hugging knees',
      'standing in doorway backlit',
    ],
  },
  {
    key: 'mood',
    label: 'Mood',
    options: [
      'playful smile',
      'sultry soft look',
      'candid laugh eyes closed',
      'serene gaze distance',
      'confident direct eye contact',
      'contemplative looking away',
      'warm natural smile',
      'relaxed eyes half-closed',
      'focused reading or scrolling',
    ],
  },
  {
    key: 'lighting',
    label: 'Lighting',
    options: [
      'golden hour warm backlight',
      'soft diffused indoor',
      'bright natural window light',
      'warm sunset side light',
      'cool morning light',
      'candlelight intimate',
      'overcast outdoor soft',
      'harsh midday sun editorial',
    ],
  },
]

const selections = reactive({
  location: '',
  outfit: '',
  pose: '',
  mood: '',
  lighting: '',
})

const canGenerate = computed(() => {
  const allDirectionsSelected = optionGroups.every((group) => Boolean(selections[group.key]))
  return allDirectionsSelected && !generating.value && selectedContentType.value === 'feed'
})

function typeCardClass(type) {
  if (type.disabled) {
    return 'cursor-not-allowed border-[#E5E3DF] bg-gray-50 text-gray-500 opacity-50'
  }

  if (selectedContentType.value === type.value) {
    return 'border-[#E8873A] bg-orange-50 text-gray-900'
  }

  return 'border-[#E5E3DF] bg-white text-gray-800 hover:border-[#E8873A]'
}

function selectOption(groupKey, option) {
  selections[groupKey] = option
}

function stopPolling() {
  if (pollingTimer) {
    clearInterval(pollingTimer)
    pollingTimer = null
  }
}

async function hydrateGeneratedContent(contentId) {
  const content = await $fetch(`/api/content/${contentId}`)
  generated.value = {
    id: content.id,
    imageUrl: content.imageUrl,
    caption: content.caption,
    status: content.status,
    errorMessage: content.errorMessage,
  }
}

async function checkJobStatus(jobId, contentId) {
  const state = await $fetch(`/api/jobs/${jobId}`)

  if (state.status === 'completed') {
    stopPolling()
    await hydrateGeneratedContent(contentId)
    generating.value = false
    return
  }

  if (state.status === 'failed') {
    stopPolling()
    generating.value = false
    const failedContent = await $fetch(`/api/content/${contentId}`)
    errorMsg.value = failedContent?.errorMessage || state.errorMessage || 'Generation echouee'
  }
}

function startPolling(jobId, contentId) {
  stopPolling()

  checkJobStatus(jobId, contentId).catch((err) => {
    stopPolling()
    generating.value = false
    errorMsg.value = err?.data?.statusMessage || err?.message || String(err)
  })

  pollingTimer = setInterval(() => {
    checkJobStatus(jobId, contentId).catch((err) => {
      stopPolling()
      generating.value = false
      errorMsg.value = err?.data?.statusMessage || err?.message || String(err)
    })
  }, 3000)
}

async function generateImage() {
  if (!canGenerate.value) {
    return
  }

  generating.value = true
  errorMsg.value = ''
  copyMsg.value = ''
  generated.value = null

  try {
    const response = await $fetch('/api/generate/image', {
      method: 'POST',
      body: {
        influencerId: route.params.id,
        location: selections.location,
        outfit: selections.outfit,
        pose: selections.pose,
        mood: selections.mood,
        lighting: selections.lighting,
        tagCategory: selectedTagCategory.value,
      },
    })

    startPolling(response.jobId, response.contentId)
  } catch (err) {
    errorMsg.value = err?.data?.statusMessage || err?.message || String(err)
  }
}

async function copyCaption() {
  if (!generated.value?.caption) {
    return
  }

  try {
    await navigator.clipboard.writeText(generated.value.caption)
    copyMsg.value = 'Caption copiere.'
  } catch {
    copyMsg.value = 'Copie impossible.'
  }
}

async function validateContent() {
  if (!generated.value?.id || validating.value || deleting.value) {
    return
  }

  validating.value = true
  errorMsg.value = ''

  try {
    await $fetch(`/api/content/${generated.value.id}/validate`, {
      method: 'PATCH',
    })

    pushToast({
      title: 'Contenu valide',
      message: 'Le contenu est maintenant en attente de publication.',
      tone: 'success',
    })
  } catch (err) {
    errorMsg.value = err?.data?.statusMessage || err?.message || String(err)
  } finally {
    validating.value = false
  }
}

async function deleteContent() {
  if (!generated.value?.id || validating.value || deleting.value) {
    return
  }

  deleting.value = true
  errorMsg.value = ''

  try {
    await $fetch(`/api/content/${generated.value.id}`, {
      method: 'DELETE',
    })

    generated.value = null
    pushToast({
      title: 'Contenu supprime',
      message: 'Le resultat genere a ete retire.',
      tone: 'success',
    })
  } catch (err) {
    errorMsg.value = err?.data?.statusMessage || err?.message || String(err)
  } finally {
    deleting.value = false
  }
}

onBeforeUnmount(() => {
  stopPolling()
})
</script>
