<template>
  <div class="min-h-screen bg-[#FAFAF8] p-8">
    <div class="mx-auto w-full max-w-3xl rounded-2xl border border-[#E5E3DF] bg-white p-6 shadow-sm">
      <div class="mb-6 flex items-start justify-between gap-4">
        <div>
          <p class="text-sm font-semibold uppercase tracking-[0.18em] text-[#E8873A]">Influenceuse</p>
          <h1 class="mt-2 text-2xl font-bold text-gray-900">Modifier le profil</h1>
          <p class="mt-2 text-sm text-gray-500">Ajoute plusieurs niches si besoin, et remplace la face ref depuis le même écran.</p>
        </div>
        <button
          type="button"
          class="rounded-lg border border-[#E5E3DF] bg-white px-4 py-2 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-50"
          @click="router.push('/influencers')"
        >
          Retour
        </button>
      </div>

      <div v-if="pending" class="space-y-3">
        <div class="h-5 w-40 animate-pulse rounded bg-gray-200"></div>
        <div class="h-12 animate-pulse rounded-xl bg-gray-100"></div>
        <div class="h-12 animate-pulse rounded-xl bg-gray-100"></div>
        <div class="h-12 animate-pulse rounded-xl bg-gray-100"></div>
      </div>

      <div v-else-if="fetchError || !influencer" class="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Impossible de charger cette influenceuse.
      </div>

      <div v-else class="space-y-6">
        <div class="grid gap-4 md:grid-cols-2">
          <div class="md:col-span-2">
            <label class="mb-1.5 block text-sm font-semibold text-gray-800">Nom</label>
            <input v-model="form.name" class="w-full rounded-xl border border-[#E5E3DF] px-3 py-3 text-sm focus:border-[#E8873A] focus:outline-none" placeholder="ex : Luna" />
          </div>

          <div class="md:col-span-2">
            <label class="mb-1.5 block text-sm font-semibold text-gray-800">Niches</label>
            <input v-model="form.niche" class="w-full rounded-xl border border-[#E5E3DF] px-3 py-3 text-sm focus:border-[#E8873A] focus:outline-none" placeholder="ex : lifestyle, fitness, travel" />
            <p class="mt-2 text-xs text-gray-500">Sépare les niches par des virgules. Elles seront affichées comme des tags dans la liste.</p>

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

          <div class="md:col-span-2">
            <label class="mb-1.5 block text-sm font-semibold text-gray-800">Style</label>
            <input v-model="form.style" class="w-full rounded-xl border border-[#E5E3DF] px-3 py-3 text-sm focus:border-[#E8873A] focus:outline-none" placeholder="ex : parisian chic" />
          </div>
        </div>

        <div class="rounded-2xl border border-[#E5E3DF] bg-[#FCFCFB] p-4">
          <div class="flex items-start justify-between gap-4">
            <div>
              <h2 class="text-base font-bold text-gray-900">Face ref</h2>
              <p class="mt-1 text-sm text-gray-500">Conserve le fichier actuel ou remplace-le par une nouvelle image JPG/PNG.</p>
            </div>
            <span class="rounded-full border border-[#E5E3DF] bg-white px-3 py-1 text-xs font-bold text-gray-600">
              {{ currentFaceRefPath ? 'Fichier présent' : 'Aucun fichier' }}
            </span>
          </div>

          <p v-if="currentFaceRefName" class="mt-3 text-sm text-gray-700">
            Fichier actuel : <strong>{{ currentFaceRefName }}</strong>
          </p>

          <div
            class="mt-4 rounded-xl border-2 border-dashed p-6 text-center transition-colors"
            :class="isDragging ? 'border-[#E8873A] bg-orange-50' : fileError ? 'border-red-400 bg-red-50' : 'border-[#E5E3DF] bg-white'"
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
            <p class="font-bold text-gray-800">Dépose une nouvelle image ici</p>
            <p class="mb-3 mt-2 text-sm text-gray-500">ou sélectionne un nouveau fichier</p>
            <button type="button" class="rounded-lg border border-[#E5E3DF] bg-white px-4 py-2 text-sm font-semibold text-gray-800 transition-colors hover:bg-gray-50" @click="openFilePicker">
              Choisir un fichier
            </button>
          </div>

          <div v-if="previewUrl" class="mt-4 overflow-hidden rounded-xl border border-[#E5E3DF]">
            <img :src="previewUrl" alt="Aperçu de la face ref" class="block max-h-72 w-full object-cover" />
          </div>
          <div v-else-if="currentFaceRefUrl" class="mt-4 overflow-hidden rounded-xl border border-[#E5E3DF]">
            <img :src="currentFaceRefUrl" alt="Face ref actuelle" class="block max-h-72 w-full object-cover" />
          </div>

          <p v-if="fileError" class="mt-3 text-sm text-red-600">{{ fileError }}</p>
          <p v-if="uploadError" class="mt-3 text-sm text-red-600">{{ uploadError }}</p>
        </div>

        <p v-if="submitError" class="text-sm text-red-600">{{ submitError }}</p>

        <div class="flex flex-wrap justify-end gap-3">
          <button
            type="button"
            class="rounded-lg border border-[#E5E3DF] bg-white px-4 py-2.5 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-50"
            @click="router.push('/influencers')"
          >
            Annuler
          </button>
          <button
            type="button"
            class="rounded-lg bg-[#E8873A] px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#d4762f] disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="saving || !canSubmit"
            @click="submit"
          >
            <span v-if="saving">Enregistrement...</span>
            <span v-else>Enregistrer</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
const id = String(route.params.id || '')
const { pushToast } = useUiFeedback()

const fetchError = ref('')
const submitError = ref('')
const uploadError = ref('')
const fileError = ref('')
const saving = ref(false)
const isDragging = ref(false)
const selectedFile = ref(null)
const previewUrl = ref('')
const currentFaceRefPath = ref('')
const currentFaceRefUrl = ref('')
const fileInputRef = ref(null)

const form = reactive({
  name: '',
  niche: '',
  style: '',
})

const { data, pending, error, refresh } = await useFetch(`/api/influencers/${id}`, {
  key: `influencer-edit-${id}`,
})

const influencer = computed(() => data.value ?? null)
const nicheItems = computed(() => splitNiches(form.niche))
const currentFaceRefName = computed(() => currentFaceRefPath.value.split(/[\\/]/).pop() || '')
const currentFaceRefFilename = computed(() => currentFaceRefPath.value.split(/[\\/]/).pop() || '')
const canSubmit = computed(() => Boolean(form.name.trim() && nicheItems.value.length && form.style.trim()))

watch(
  () => influencer.value,
  (value) => {
    if (!value) {
      return
    }

    form.name = value.name || ''
    form.niche = value.niche || ''
    form.style = value.style || ''
    currentFaceRefPath.value = value.faceRefPath || ''
    currentFaceRefUrl.value = value.faceRefUrl || (currentFaceRefFilename.value ? `/api/media/face-refs/${encodeURIComponent(currentFaceRefFilename.value)}` : '')
  },
  { immediate: true },
)

watch(
  () => error.value,
  (value) => {
    fetchError.value = value?.data?.statusMessage || value?.message || ''
  },
  { immediate: true },
)

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
  setFile(event.target?.files?.[0])
}

function onDrop(event) {
  isDragging.value = false
  setFile(event.dataTransfer?.files?.[0])
}

async function uploadFaceRefIfNeeded() {
  if (!selectedFile.value) {
    return
  }

  const formData = new FormData()
  formData.append('file', selectedFile.value)
  formData.append('influencerId', id)

  const response = await fetch('/api/upload/face-ref', {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}))
    throw new Error(payload?.statusMessage || payload?.message || 'Upload impossible')
  }

  const payload = await response.json()
  currentFaceRefPath.value = payload?.path || currentFaceRefPath.value
  currentFaceRefUrl.value = payload?.url || currentFaceRefUrl.value
  selectedFile.value = null
}

async function submit() {
  if (!canSubmit.value || saving.value) {
    return
  }

  saving.value = true
  submitError.value = ''
  uploadError.value = ''

  try {
    await $fetch(`/api/influencers/${id}`, {
      method: 'PATCH',
      body: {
        name: form.name.trim(),
        niche: form.niche,
        style: form.style.trim(),
      },
    })

    await uploadFaceRefIfNeeded()
    await refresh()

    pushToast({
      title: 'Influenceuse mise à jour',
      message: 'Les modifications ont bien été enregistrées.',
      tone: 'success',
    })

    await router.push('/influencers')
  } catch (err) {
    const message = err?.data?.statusMessage || err?.message || String(err)
    submitError.value = message
    pushToast({
      title: 'Mise à jour impossible',
      message,
      tone: 'error',
      duration: 4500,
    })
  } finally {
    saving.value = false
  }
}

onBeforeUnmount(() => {
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value)
  }
})
</script>