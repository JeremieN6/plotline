<template>
  <div class="space-y-6">
    <header class="rounded-[20px] border border-[#E5E3DF] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
      <p class="text-xs font-semibold uppercase tracking-[0.22em] text-[#E8873A]">Influenceuse</p>
      <h1 class="mt-2 text-3xl font-bold tracking-tight text-[#111111]">Modifier le profil</h1>
      <p class="mt-2 text-sm text-[#666666]">Ajoute plusieurs niches si besoin, et remplace la face ref depuis le même écran.</p>
    </header>

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
            <img
              v-if="!currentFaceRefMissing"
              :src="currentFaceRefUrl"
              alt="Face ref actuelle"
              class="block max-h-72 w-full object-cover"
              @error="onCurrentFaceRefError"
            />
            <div v-else class="p-4 text-sm text-amber-700 bg-amber-50">
              Cette image de reference n'est pas disponible sur ce poste. Uploadez une nouvelle face ref pour continuer.
            </div>
          </div>

          <p v-if="fileError" class="mt-3 text-sm text-red-600">{{ fileError }}</p>
          <p v-if="uploadError" class="mt-3 text-sm text-red-600">{{ uploadError }}</p>
        </div>

        <div class="rounded-2xl border border-[#E5E3DF] bg-[#FCFCFB] p-4">
          <div>
            <h2 class="text-base font-bold text-gray-900">Silhouette</h2>
            <p class="mt-1 text-sm text-gray-500">Définis le gabarit de base qui sera utilisé par ton persona. Tu peux également le laisser par défaut.</p>
          </div>

          <div class="mt-4 grid gap-2 sm:grid-cols-2">
            <button
              v-for="option in silhouetteOptions"
              :key="option.value"
              type="button"
              class="rounded-xl border px-3 py-3 text-left transition-colors"
              :class="form.silhouette === option.value ? 'border-[#E8873A] bg-orange-50' : 'border-[#E5E3DF] bg-white hover:bg-gray-50'"
              @click="form.silhouette = option.value"
            >
              <div class="flex items-center justify-between gap-2">
                <p class="text-sm font-bold text-gray-900">{{ option.label }}</p>
                <span v-if="option.value === 'VOLUPTUOUS'" class="rounded-full border border-orange-200 bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-700">Par defaut</span>
              </div>
              <p class="mt-1 text-xs text-gray-600">{{ option.description }}</p>
            </button>
          </div>
        </div>

        <div class="rounded-2xl border border-[#E5E3DF] bg-[#FCFCFB] p-4">
          <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 class="text-base font-bold text-gray-900">Instagram</h2>
              <p class="mt-1 text-sm text-gray-500">Configure ici le compte et le token utilisés pour publier le contenu.</p>
            </div>
            <button
              type="button"
              class="rounded-lg bg-[#111111] px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-[#2a2a2a] disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="savingInstagram"
              @click="saveInstagramCredentials"
            >
              {{ savingInstagram ? 'Sauvegarde...' : 'Sauvegarder Instagram' }}
            </button>
          </div>

          <div class="mt-4 grid gap-4">
            <div>
              <label class="mb-1.5 block text-sm font-semibold text-gray-800">Instagram account ID</label>
              <input
                v-model="instagramForm.instagramAccountId"
                type="text"
                class="w-full rounded-xl border border-[#E5E3DF] px-3 py-3 text-sm focus:border-[#E8873A] focus:outline-none"
                placeholder="17841400000000000"
              />
            </div>

            <div>
              <label class="mb-1.5 block text-sm font-semibold text-gray-800">Instagram access token</label>
              <textarea
                v-model="instagramForm.instagramAccessToken"
                rows="4"
                class="w-full rounded-xl border border-[#E5E3DF] px-3 py-3 text-sm focus:border-[#E8873A] focus:outline-none"
                placeholder="EAAG..."
              ></textarea>
            </div>
          </div>

          <div class="mt-6 border-t border-[#E5E3DF] pt-6">
            <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 class="text-sm font-bold text-gray-900">Twitter / X</h3>
                <p class="mt-1 text-sm text-gray-500">Connecte le compte X utilisé pour publier le contenu.</p>
              </div>
              <button
                type="button"
                class="rounded-lg px-4 py-2 text-sm font-bold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                :class="twitterConnected ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-[#111111] hover:bg-[#2a2a2a]'"
                :disabled="twitterConnecting || twitterStatusLoading"
                @click="connectTwitter"
              >
                {{ twitterButtonLabel }}
              </button>
            </div>
          </div>
        </div>

        <p v-if="submitError" class="text-sm text-red-600">{{ submitError }}</p>

        <div class="flex flex-wrap justify-end gap-3">
          <button
            type="button"
            class="rounded-lg border border-[#E5E3DF] bg-white px-4 py-2.5 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-50"
            @click="router.push('/content')"
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
</template>

<script setup>
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
const id = computed(() => String(route.params.id || ''))
const activeInfluencerId = useActiveInfluencer()
const { pushToast } = useUiFeedback()

watch(
  id,
  (value) => {
    if (value) {
      activeInfluencerId.value = value
    }
  },
  { immediate: true },
)

const fetchError = ref('')
const submitError = ref('')
const uploadError = ref('')
const fileError = ref('')
const saving = ref(false)
const savingInstagram = ref(false)
const twitterStatusLoading = ref(false)
const twitterConnecting = ref(false)
const twitterConnected = ref(false)
const twitterUsername = ref('')
const isDragging = ref(false)
const selectedFile = ref(null)
const previewUrl = ref('')
const currentFaceRefPath = ref('')
const currentFaceRefUrl = ref('')
const currentFaceRefMissing = ref(false)
const fileInputRef = ref(null)
const initialFormState = ref({
  bodyPrompt: '',
  silhouette: 'VOLUPTUOUS',
})

const silhouetteOptions = [
  { value: 'SLIM', label: '🌿 Mince', description: 'Elancée, minimaliste, éditoriale' },
  { value: 'ATHLETIC', label: '💪 Athletique', description: 'Tonique, sportive, fit' },
  { value: 'VOLUPTUOUS', label: '🔥 Voluptueuse', description: 'Sablier prononcé, courbes marquées' },
  { value: 'CURVY', label: '🫧 Harmonieuse', description: 'Courbes douces, taille dessinée, silhouette plus équilibrée' },
]

const form = reactive({
  name: '',
  niche: '',
  style: '',
  silhouette: 'VOLUPTUOUS',
  bodyPrompt: '',
  hairPrompt: '',
})

const instagramForm = reactive({
  instagramAccountId: '',
  instagramAccessToken: '',
})

const { data, pending, error, refresh } = await useFetch(() => `/api/influencers/${id.value}`, {
  key: computed(() => `influencer-edit-${id.value}`),
})

const influencer = computed(() => data.value ?? null)
const nicheItems = computed(() => splitNiches(form.niche))
const currentFaceRefName = computed(() => currentFaceRefPath.value.split(/[\\/]/).pop() || '')
const currentFaceRefFilename = computed(() => currentFaceRefPath.value.split(/[\\/]/).pop() || '')
const canSubmit = computed(() => Boolean(form.name.trim() && nicheItems.value.length && form.style.trim()))

const twitterButtonLabel = computed(() => {
  if (twitterConnecting.value) {
    return 'En attente de connexion... (120s)'
  }

  if (twitterConnected.value) {
    return twitterUsername.value
      ? `✓ Twitter connecté @${twitterUsername.value}`
      : '✓ Twitter connecté'
  }

  return '🐦 Connecter Twitter'
})

watch(
  () => influencer.value,
  (value) => {
    if (!value) {
      return
    }

    form.name = value.name || ''
    form.niche = value.niche || ''
    form.style = value.style || ''
    form.silhouette = value.silhouette || 'VOLUPTUOUS'
    form.bodyPrompt = value.bodyPrompt || ''
    form.hairPrompt = value.hairPrompt || ''
    instagramForm.instagramAccountId = value.instagramAccountId || ''
    instagramForm.instagramAccessToken = value.instagramAccessToken || ''
    initialFormState.value = {
      bodyPrompt: form.bodyPrompt,
      silhouette: form.silhouette,
    }
    currentFaceRefPath.value = value.faceRefPath || ''
    currentFaceRefUrl.value = value.faceRefUrl || (currentFaceRefFilename.value ? `/api/media/face-refs/${encodeURIComponent(currentFaceRefFilename.value)}` : '')
    currentFaceRefMissing.value = false
  },
  { immediate: true },
)

watch(
  id,
  async (value) => {
    if (!value) {
      twitterConnected.value = false
      twitterUsername.value = ''
      return
    }

    await loadTwitterStatus(value)
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

function extractHttpErrorDetails(err) {
  const statusCode = Number(err?.statusCode || err?.response?.status || err?.data?.statusCode || 0)
  const statusMessage = String(err?.statusMessage || err?.data?.statusMessage || err?.data?.message || err?.message || '')
  return { statusCode, statusMessage }
}

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

function onCurrentFaceRefError() {
  currentFaceRefMissing.value = true
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

async function saveInstagramCredentials() {
  if (savingInstagram.value) {
    return
  }

  savingInstagram.value = true
  try {
    await $fetch(`/api/influencers/${id.value}/instagram`, {
      method: 'PATCH',
      body: {
        instagramAccountId: instagramForm.instagramAccountId,
        instagramAccessToken: instagramForm.instagramAccessToken,
      },
    })

    pushToast({
      title: 'Instagram mis à jour',
      message: 'Les credentials Instagram ont été enregistrés.',
      tone: 'success',
    })
    await refresh()
  } catch (err) {
    const message = err?.data?.statusMessage || err?.message || 'Sauvegarde impossible'
    pushToast({
      title: 'Instagram',
      message,
      tone: 'error',
      duration: 4500,
    })
  } finally {
    savingInstagram.value = false
  }
}

async function loadTwitterStatus(influencerId) {
  twitterStatusLoading.value = true
  try {
    const response = await $fetch(`/api/influencers/${influencerId}/twitter-status`)
    twitterConnected.value = Boolean(response?.connected)
    twitterUsername.value = String(response?.username || '').trim()
  } catch {
    twitterConnected.value = false
    twitterUsername.value = ''
  } finally {
    twitterStatusLoading.value = false
  }
}

async function connectTwitter() {
  if (!id.value || twitterConnecting.value) {
    return
  }

  twitterConnecting.value = true
  try {
    const response = await $fetch(`/api/influencers/${id.value}/twitter-connect`, { method: 'POST' })
    twitterConnected.value = Boolean(response?.connected ?? response?.success)
    twitterUsername.value = String(response?.username || '').trim()

    pushToast({
      title: 'Twitter connecté',
      message: twitterUsername.value
        ? `Compte @${twitterUsername.value} prêt pour la publication.`
        : 'Compte connecté, publication prête.',
      tone: 'success',
    })
    await refresh()
  } catch (err) {
    const { statusMessage } = extractHttpErrorDetails(err)
    pushToast({
      title: 'Connexion Twitter impossible',
      message: statusMessage || 'La connexion n a pas pu être finalisée.',
      tone: 'error',
      duration: 6000,
    })
  } finally {
    twitterConnecting.value = false
  }
}

async function uploadFaceRefIfNeeded() {
  if (!selectedFile.value) {
    return
  }

  const formData = new FormData()
  formData.append('file', selectedFile.value)
  formData.append('influencerId', id.value)

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
  currentFaceRefUrl.value = payload?.url || (currentFaceRefFilename.value ? `/api/media/face-refs/${encodeURIComponent(currentFaceRefFilename.value)}` : currentFaceRefUrl.value)
  currentFaceRefMissing.value = false
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
    const patchBody = {
      name: form.name.trim(),
      niche: form.niche,
      style: form.style.trim(),
    }

    if (form.bodyPrompt !== initialFormState.value.bodyPrompt) {
      patchBody.bodyPrompt = form.bodyPrompt
    }

    if (form.silhouette !== initialFormState.value.silhouette) {
      patchBody.silhouette = form.silhouette
    }

    await $fetch(`/api/influencers/${id.value}`, {
      method: 'PATCH',
      body: patchBody,
    })

    await uploadFaceRefIfNeeded()
    await refresh()

    pushToast({
      title: 'Influenceuse mise à jour',
      message: 'Les modifications ont bien été enregistrées.',
      tone: 'success',
    })

    await router.push('/content')
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