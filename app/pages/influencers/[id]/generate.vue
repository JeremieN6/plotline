<template>
  <div class="min-h-screen bg-[#FAFAF8] p-6 font-sans">
    <div class="max-w-6xl mx-auto">

      <!-- Barre influenceuse -->
      <div v-if="influencer" class="flex items-center gap-3 bg-white border border-[#E5E3DF] rounded-xl px-4 py-3 mb-4 text-sm">
        <span class="text-gray-500">Influenceuse :</span>
        <strong class="text-gray-900">{{ influencer.name }}</strong>
        <span class="bg-orange-50 text-[#E8873A] px-2.5 py-0.5 rounded-full text-xs font-bold">{{ influencer.niche }}</span>
        <span
          class="ml-auto text-xs font-semibold"
          :class="influencer.faceRefPath ? 'text-green-600' : 'text-red-600'"
        >
          {{ influencer.faceRefPath ? 'Face ref OK' : '⚠ Aucune face ref' }}
        </span>
      </div>

      <!-- Layout 2 colonnes -->
      <div class="flex gap-5 items-start flex-col lg:flex-row">

        <!-- Panel config -->
        <aside class="bg-white border border-[#E5E3DF] rounded-xl p-5 shadow-sm w-full lg:w-5/12">
          <h2 class="text-base font-bold text-gray-900 mb-4">Direction créative</h2>

          <div v-for="group in optionGroups" :key="group.key" class="mb-4">
            <p class="text-sm font-bold text-gray-800 mb-2">{{ group.label }}</p>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="option in group.options"
                :key="option"
                type="button"
                class="border rounded-full px-3 py-1.5 text-xs font-medium cursor-pointer transition-colors"
                :class="selections[group.key] === option
                  ? 'bg-[#E8873A] border-[#E8873A] text-white'
                  : 'bg-white border-[#E5E3DF] text-gray-700 hover:border-[#E8873A]'"
                @click="selectOption(group.key, option)"
              >
                {{ option }}
              </button>
            </div>
          </div>

          <button
            class="mt-2 w-full py-2.5 bg-[#E8873A] text-white font-bold text-sm rounded-lg hover:bg-[#d4762f] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="generating"
            @click="generateImage"
          >
            <span v-if="generating" class="inline-flex items-center gap-2">
              <svg class="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
              Génération...
            </span>
            <span v-else>Générer</span>
          </button>

          <p v-if="errorMsg" class="text-sm text-red-600 mt-3">{{ errorMsg }}</p>
        </aside>

        <!-- Panel résultats -->
        <main class="bg-white border border-[#E5E3DF] rounded-xl p-5 shadow-sm w-full lg:w-7/12 min-h-[600px] flex flex-col">
          <div v-if="!generated && !generating" class="flex-1 flex items-center justify-center text-gray-400 text-center">
            Lance une génération pour voir l'image et la caption ici.
          </div>

          <div v-else-if="generating" class="flex-1 flex flex-col items-center justify-center gap-3 text-gray-500">
            <svg class="w-8 h-8 animate-spin text-[#E8873A]" viewBox="0 0 24 24" fill="none"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
            <p>Création de l'image en cours...</p>
          </div>

          <div v-else class="flex flex-col gap-4">
            <img :src="generated.imageUrl" alt="Image générée" class="w-full rounded-xl border border-[#E5E3DF]" />
            <div class="border border-[#E5E3DF] rounded-xl p-4 flex flex-col gap-3">
              <p class="text-sm text-gray-800 whitespace-pre-wrap m-0">{{ generated.caption || 'Aucune caption générée.' }}</p>
              <button
                class="self-start px-3 py-1.5 bg-white border border-[#E5E3DF] text-gray-800 text-xs font-semibold rounded-lg hover:bg-gray-50 transition-colors"
                @click="copyCaption"
              >
                Copier
              </button>
            </div>
            <p v-if="copyMsg" class="text-xs text-green-700 font-medium">{{ copyMsg }}</p>
          </div>
        </main>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

const { data: influencer } = await useFetch(`/api/influencers/${route.params.id}`)
const generating = ref(false)
const errorMsg = ref('')
const copyMsg = ref('')
const generated = ref(null)

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
    ],
  },
  {
    key: 'outfit',
    label: 'Outfit',
    options: [
      'white crop top + high waist jeans',
      'black bikini',
      'beige linen dress',
      'sport bra + leggings',
      'satin slip dress nude',
      'floral summer dress',
    ],
  },
  {
    key: 'pose',
    label: 'Pose',
    options: [
      'mirror selfie arm raised',
      'over shoulder looking back',
      'leaning against wall',
      'sitting legs crossed candid',
      'standing profile arms relaxed',
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
      'warm natural smile',
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
    ],
  },
]

const selections = reactive({
  location: optionGroups[0].options[0],
  outfit: optionGroups[1].options[0],
  pose: optionGroups[2].options[0],
  mood: optionGroups[3].options[0],
  lighting: optionGroups[4].options[0],
})

function selectOption(groupKey, option) {
  selections[groupKey] = option
}

async function generateImage() {
  if (generating.value) return

  generating.value = true
  errorMsg.value = ''
  copyMsg.value = ''

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
      },
    })

    generated.value = {
      imageUrl: response.imageUrl,
      caption: response.caption,
    }
  } catch (err) {
    errorMsg.value = err?.data?.statusMessage || err?.message || String(err)
  } finally {
    generating.value = false
  }
}

async function copyCaption() {
  if (!generated.value?.caption) return

  try {
    await navigator.clipboard.writeText(generated.value.caption)
    copyMsg.value = 'Caption copiée.'
  } catch (err) {
    copyMsg.value = 'Copie impossible.'
  }
}
</script>
