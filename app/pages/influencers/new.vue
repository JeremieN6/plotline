<template>
  <div class="min-h-screen bg-[#FAFAF8] flex items-center justify-center p-8">
    <div class="bg-white border border-[#E5E3DF] rounded-xl w-full max-w-2xl p-6 shadow-sm">

      <!-- Progress bar -->
      <div class="relative h-10 mb-5">
        <div class="absolute left-5 right-5 top-4 h-2 bg-[#E5E3DF] rounded-full"></div>
        <div
          class="absolute left-5 top-4 h-2 rounded-full transition-all duration-300"
          style="background: linear-gradient(90deg, #E8873A, #f6a16a)"
          :style="{ width: `calc(${filledWidth} - 40px)` }"
        ></div>
        <div class="relative flex justify-between px-5 z-10">
          <div v-for="n in totalSteps" :key="n" class="flex items-center justify-center w-7 h-7">
            <span
              class="w-7 h-7 rounded-full inline-flex items-center justify-center text-sm font-semibold border transition-colors"
              :class="step === n
                ? 'bg-[#E8873A] text-white border-[#E8873A] shadow-md'
                : 'bg-white text-gray-500 border-[#E5E3DF]'"
            >{{ n }}</span>
          </div>
        </div>
      </div>

      <h2 class="text-xl font-semibold text-gray-900 mt-1 mb-1">{{ stepTitle }}</h2>
      <p class="text-sm text-gray-500 mb-5">{{ stepSubtitle }}</p>

      <!-- Step 1 : identité -->
      <div v-if="step === 1" class="flex flex-col gap-3">
        <div>
          <label class="block text-sm font-semibold text-gray-800 mb-1.5">Nom</label>
          <input v-model="form.name" class="w-full px-3 py-2.5 border border-[#E5E3DF] rounded-lg text-sm focus:outline-none focus:border-[#E8873A]" placeholder="ex : Luna" />
        </div>
        <div>
          <label class="block text-sm font-semibold text-gray-800 mb-1.5">Niches</label>
          <input v-model="form.niche" class="w-full px-3 py-2.5 border border-[#E5E3DF] rounded-lg text-sm focus:outline-none focus:border-[#E8873A]" placeholder="ex : lifestyle, fitness, travel" />
          <p class="mt-2 text-xs text-gray-500">Tu peux renseigner plusieurs niches séparées par des virgules.</p>
          <div v-if="nicheItems.length" class="mt-3 flex flex-wrap gap-2">
            <span
              v-for="item in nicheItems"
              :key="item"
              class="rounded-full bg-orange-50 px-2.5 py-1 text-xs font-bold text-[#E8873A]"
            >
              {{ item }}
            </span>
          </div>
        </div>
        <div>
          <label class="block text-sm font-semibold text-gray-800 mb-1.5">Style</label>
          <input v-model="form.style" class="w-full px-3 py-2.5 border border-[#E5E3DF] rounded-lg text-sm focus:outline-none focus:border-[#E8873A]" placeholder="ex : californian blonde, parisian chic" />
        </div>
      </div>

      <!-- Step 2 : image de référence -->
      <div v-if="step === 2" class="flex flex-col gap-3">
        <label class="block text-sm font-semibold text-gray-800 mb-1">Image de référence (JPG/PNG)</label>
        <div
          class="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors"
          :class="isDragging ? 'border-[#E8873A] bg-orange-50' : fileError ? 'border-red-400' : 'border-[#E5E3DF] bg-white'"
          @dragenter.prevent="isDragging = true"
          @dragover.prevent="isDragging = true"
          @dragleave.prevent="isDragging = false"
          @drop.prevent="onDrop"
        >
          <input
            ref="fileInputRef"
            type="file"
            accept="image/jpeg,image/png,.jpg,.jpeg,.png"
            class="hidden"
            @change="onFileSelect"
          />
          <p class="font-bold text-gray-800 mb-2">Dépose ton image ici</p>
          <p class="text-sm text-gray-500 mb-3">ou</p>
          <button type="button" class="px-4 py-2 bg-white border border-[#E5E3DF] text-gray-800 font-semibold text-sm rounded-lg hover:bg-gray-50 transition-colors" @click="openFilePicker">
            Choisir un fichier
          </button>
        </div>

        <div v-if="faceRefUrl || previewUrl" class="border border-[#E5E3DF] rounded-xl overflow-hidden">
          <img :src="faceRefUrl || previewUrl" alt="Aperçu image de référence" class="block w-full max-h-72 object-cover" />
        </div>
        <p v-if="fileError" class="text-sm text-red-600">{{ fileError }}</p>
        <p v-if="uploadError" class="text-sm text-red-600">{{ uploadError }}</p>
        <p v-if="faceRefPath" class="text-sm text-green-700 font-medium">Image envoyée avec succès.</p>
      </div>

      <!-- Step 3 : confirmation -->
      <div v-if="step === 3">
        <div class="bg-gray-50 border border-[#E5E3DF] rounded-lg p-4 flex flex-col gap-2 text-sm text-gray-800">
          <div><strong>Nom :</strong> {{ form.name }}</div>
          <div><strong>Niche :</strong> {{ form.niche }}</div>
          <div><strong>Style :</strong> {{ form.style }}</div>
          <div><strong>Image de référence :</strong> {{ faceRefPath ? 'Oui' : 'Non' }}</div>
        </div>
        <p v-if="error" class="text-sm text-red-600 mt-3">{{ error }}</p>
      </div>

      <!-- Actions -->
      <div class="flex justify-between gap-3 mt-6">
        <button
          type="button"
          class="px-4 py-2.5 bg-white border border-[#E5E3DF] text-gray-800 font-semibold text-sm rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="step === 1 || loading"
          @click="prevStep"
        >
          Précédent
        </button>

        <button
          v-if="step < totalSteps"
          type="button"
          class="px-4 py-2.5 bg-[#E8873A] text-white font-semibold text-sm rounded-lg hover:bg-[#d4762f] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="loading || !canNext"
          @click="nextStep"
        >
          <span v-if="step === 2 && uploading">Upload...</span>
          <span v-else>Suivant</span>
        </button>

        <button
          v-else
          type="button"
          class="px-4 py-2.5 bg-[#E8873A] text-white font-semibold text-sm rounded-lg hover:bg-[#d4762f] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="loading"
          @click="submit"
        >
          <span v-if="loading">Création...</span>
          <span v-else>Créer mon influenceuse</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const step = ref(1)
const totalSteps = 3
const loading = ref(false)
const uploading = ref(false)
const error = ref('')
const uploadError = ref('')
const fileError = ref('')
const isDragging = ref(false)
const previewUrl = ref('')
const selectedFile = ref(null)
const faceRefPath = ref('')
const faceRefUrl = ref('')
const tempInfluencerId = ref(`temp-${Date.now()}`)
const fileInputRef = ref(null)

const form = reactive({
  name: '',
  niche: '',
  style: '',
})

const titles = ['Identité', 'Image de référence', 'Confirmation']
const subtitles = [
  'Renseigne les informations de base de ton influenceuse.',
  'Ajoute une image de référence pour ancrer la cohérence visuelle.',
  'Vérifie les données puis crée ton influenceuse.',
]

const stepTitle = computed(() => titles[step.value - 1])
const stepSubtitle = computed(() => subtitles[step.value - 1])
const nicheItems = computed(() => splitNiches(form.niche))

const filledWidth = computed(() => {
  const pct = ((step.value - 1) / (totalSteps - 1)) * 100
  return `${pct}%`
})

const canNext = computed(() => {
  if (step.value === 1) {
    return Boolean(form.name.trim() && nicheItems.value.length && form.style.trim())
  }
  if (step.value === 2) {
    return Boolean(selectedFile.value || faceRefPath.value)
  }
  return true
})

function openFilePicker() {
  fileInputRef.value?.click()
}

function validImage(file) {
  if (!file) return false
  return ['image/jpeg', 'image/png'].includes(file.type)
}

function updatePreview(file) {
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value)
  }
  previewUrl.value = URL.createObjectURL(file)
}

function setFile(file) {
  fileError.value = ''
  uploadError.value = ''

  if (!validImage(file)) {
    selectedFile.value = null
    fileError.value = 'Format invalide. Utilise un fichier JPG ou PNG.'
    return
  }

  selectedFile.value = file
  updatePreview(file)
}

function onFileSelect(event) {
  const file = event.target?.files?.[0]
  setFile(file)
}

function onDrop(event) {
  isDragging.value = false
  const file = event.dataTransfer?.files?.[0]
  setFile(file)
}

async function uploadFaceRefIfNeeded() {
  if (faceRefPath.value || !selectedFile.value) return true

  uploading.value = true
  uploadError.value = ''

  try {
    const formData = new FormData()
    formData.append('file', selectedFile.value)
    formData.append('influencerId', tempInfluencerId.value)

    const response = await fetch('/api/upload/face-ref', {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      throw new Error(data?.statusMessage || data?.message || 'Upload impossible')
    }

    const data = await response.json()
    faceRefPath.value = data?.path || ''
    faceRefUrl.value = data?.url || ''

    if (!faceRefPath.value) {
      throw new Error('Le serveur n a pas retourné de chemin de fichier')
    }

    return true
  } catch (err) {
    uploadError.value = err?.message || String(err)
    return false
  } finally {
    uploading.value = false
  }
}

async function nextStep() {
  if (!canNext.value || loading.value) return

  if (step.value === 2) {
    const uploaded = await uploadFaceRefIfNeeded()
    if (!uploaded) return
  }

  if (step.value < totalSteps) {
    step.value += 1
  }
}

function prevStep() {
  if (step.value > 1) {
    step.value -= 1
  }
}

async function submit() {
  if (loading.value) return

  loading.value = true
  error.value = ''

  try {
    const created = await $fetch('/api/influencers', {
      method: 'POST',
      body: {
        userId: 'user-test',
        name: form.name.trim(),
        niche: form.niche.trim(),
        style: form.style.trim(),
      },
    })

    if (faceRefPath.value) {
      await $fetch(`/api/influencers/${created.id}/face-ref`, {
        method: 'PATCH',
        body: { faceRefPath: faceRefPath.value },
      })
    }

    await router.push('/influencers')
  } catch (err) {
    error.value = err?.data?.statusMessage || err?.message || String(err)
  } finally {
    loading.value = false
  }
}

onBeforeUnmount(() => {
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value)
  }
})
</script>
