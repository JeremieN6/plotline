<template>
  <div class="space-y-6">
    <header class="rounded-[20px] border border-[#E5E3DF] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
      <p class="text-xs font-semibold uppercase tracking-[0.22em] text-[#E8873A]">Paramètres</p>
      <p v-if="influencer" class="mt-2 text-base font-bold text-[#111111]">
        {{ influencer.name }} <span class="text-[#999999]">•</span> {{ profileTypeLabelDisplay }}
      </p>
      <div v-if="linkedBrandLabel" class="mt-3 inline-flex items-center gap-2 rounded-full border border-[#E5E3DF] bg-[#FAFAF8] px-3 py-1.5 text-xs font-semibold text-[#666666]">
        <span class="h-2 w-2 rounded-full bg-[#E8873A]"></span>
        {{ linkedBrandLabel }}
      </div>
      <h1 class="mt-1 text-3xl font-bold tracking-tight text-[#111111]">Modifier le profil</h1>
      <p class="mt-2 text-sm text-[#666666]">{{ settingsDescription }}</p>
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
            <p class="mt-2 text-xs text-gray-500">Sépare les styles par des virgules. Ils seront affichés comme des tags dans la liste.</p>

            <div v-if="styleItems.length" class="mt-3 flex flex-wrap gap-2">
              <span
                v-for="item in styleItems"
                :key="item"
                class="rounded-full border border-[#E5E3DF] bg-[#FAFAF8] px-2.5 py-1 text-xs font-semibold text-[#111111]"
              >
                {{ item }}
              </span>
            </div>
          </div>
        </div>

        <div v-if="isAmbassadorProfile" class="rounded-2xl border border-[#E5E3DF] bg-[#FCFCFB] p-4">
          <div class="flex items-start justify-between gap-4">
            <div>
              <h2 class="text-base font-bold text-gray-900">Face ref</h2>
              <p class="mt-1 text-sm text-gray-500">Dépose une photo classique de ce à quoi tu veux que ton {{ profileTypeLabel }} ressemble. Le pipeline génère automatiquement la fiche de cohérence visuelle (3 panneaux) à partir de cette photo.</p>
            </div>
            <span class="rounded-full border border-[#E5E3DF] bg-white px-3 py-1 text-xs font-bold text-gray-600">
              {{ currentFaceRefPath ? 'Fichier présent' : 'Aucun fichier' }}
            </span>
          </div>

          <p v-if="currentFaceRefName" class="mt-3 text-sm text-gray-700">
            Fichier actuel : <strong>{{ currentFaceRefName }}</strong>
          </p>

          <div v-if="currentFaceRefUrl && !sourcePreviewUrl && !generatedImageDataUrl" class="mt-4 overflow-hidden rounded-xl border border-[#E5E3DF]">
            <img
              v-if="!currentFaceRefMissing"
              :src="currentFaceRefUrl"
              alt="Face ref actuelle"
              class="block max-h-72 w-full object-cover"
              @error="onCurrentFaceRefError"
            />
            <div v-else class="p-4 text-sm text-amber-700 bg-amber-50">
              Cette image de reference n'est pas disponible sur ce poste. Dépose une nouvelle photo source pour régénérer.
            </div>
          </div>

          <template v-if="!generatedImageDataUrl">
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
              <p class="font-bold text-gray-800">Dépose une photo source ici (visage dégagé, cadrage buste minimum)</p>
              <p class="mb-3 mt-2 text-sm text-gray-500">ou sélectionne un nouveau fichier</p>
              <button type="button" class="rounded-lg border border-[#E5E3DF] bg-white px-4 py-2 text-sm font-semibold text-gray-800 transition-colors hover:bg-gray-50" @click="openFilePicker">
                Choisir un fichier
              </button>
            </div>

            <div v-if="sourcePreviewUrl" class="mt-4 overflow-hidden rounded-xl border border-[#E5E3DF]">
              <img :src="sourcePreviewUrl" alt="Photo source" class="block max-h-72 w-full object-cover" />
            </div>

            <p v-if="fileError" class="mt-3 text-sm text-red-600">{{ fileError }}</p>
            <p v-if="generateError" class="mt-3 text-sm text-red-600">{{ generateError }}</p>

            <button
              v-if="sourceImageBase64"
              type="button"
              class="mt-4 w-full rounded-lg bg-[#E8873A] px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#d4762f] disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="generatingRef"
              @click="generateFaceReference"
            >
              {{ generatingRef ? 'Génération en cours... (~30s)' : 'Générer la nouvelle fiche référence' }}
            </button>
          </template>

          <template v-else>
            <p class="mt-4 text-sm text-gray-700">Nouvelle fiche référence générée. Valide-la pour remplacer la face ref actuelle, ou régénère à partir de la même photo.</p>
            <div class="mt-3 overflow-hidden rounded-xl border border-[#E5E3DF]">
              <img :src="generatedImageDataUrl" alt="Nouvelle fiche référence" class="block max-h-96 w-full object-cover" />
            </div>
            <p v-if="applyError" class="mt-3 text-sm text-red-600">{{ applyError }}</p>
            <div class="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                class="rounded-lg border border-[#E5E3DF] bg-white px-4 py-2.5 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="generatingRef || applyingFaceRef"
                @click="regenerateFaceReference"
              >
                🔄 Regénérer
              </button>
              <button
                type="button"
                class="rounded-lg bg-[#111111] px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#2a2a2a] disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="applyingFaceRef"
                @click="applyGeneratedFaceRef"
              >
                {{ applyingFaceRef ? 'Application...' : '✓ Valider et remplacer' }}
              </button>
            </div>
          </template>
        </div>

        <div v-if="isAmbassadorProfile" class="rounded-2xl border border-[#E5E3DF] bg-[#FCFCFB] p-4">
          <div>
            <h2 class="text-base font-bold text-gray-900">Marques représentées</h2>
            <p class="mt-1 text-sm text-gray-500">
              Une même {{ wording.ambassador }} peut représenter plusieurs marques. Coche celles pour lesquelles elle peut générer du contenu.
            </p>
          </div>

          <div v-if="!brandOptions.length" class="mt-4 rounded-xl border border-dashed border-[#E5D8C9] bg-white px-3 py-3 text-sm text-[#7B5A3F]">
            Aucune marque n'existe encore sur ce compte.
          </div>

          <div v-else class="mt-4 grid gap-2 sm:grid-cols-2">
            <label
              v-for="brand in brandOptions"
              :key="brand.id"
              class="flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 transition-colors"
              :class="selectedBrandIds.includes(brand.id) ? 'border-[#E8873A] bg-orange-50' : 'border-[#E5E3DF] bg-white hover:bg-gray-50'"
            >
              <input
                type="checkbox"
                :value="brand.id"
                :checked="selectedBrandIds.includes(brand.id)"
                class="h-4 w-4 accent-[#E8873A]"
                @change="toggleBrand(brand.id)"
              >
              <span class="text-sm font-semibold text-gray-900">{{ brand.name }}</span>
            </label>
          </div>

          <div v-if="brandOptions.length" class="mt-3 flex items-center gap-3">
            <button
              type="button"
              class="rounded-[10px] bg-[#E8873A] px-3.5 py-2 text-sm font-bold text-white transition-colors hover:bg-[#D97A2F] disabled:opacity-60"
              :disabled="savingBrands"
              @click="saveBrandLinks"
            >
              {{ savingBrands ? 'Enregistrement...' : 'Enregistrer les marques' }}
            </button>
            <p v-if="brandLinksMessage" class="text-xs text-[#7B5A3F]">{{ brandLinksMessage }}</p>
          </div>
        </div>

        <div v-if="isAmbassadorProfile" class="rounded-2xl border border-[#E5E3DF] bg-[#FCFCFB] p-4">
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

        <div class="rounded-2xl border border-red-200 bg-red-50/60 p-4">
          <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 class="text-base font-bold text-red-700">Zone de danger</h2>
              <p class="mt-1 text-sm text-red-600">Supprime définitivement ce profil {{ profileTypeLabel }} ainsi que tous ses contenus générés.</p>
            </div>
            <button
              type="button"
              class="shrink-0 rounded-lg border border-red-300 bg-white px-4 py-2.5 text-sm font-bold text-red-600 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="deleting"
              @click="deleteProfile"
            >
              {{ deleting ? 'Suppression...' : `Supprimer ce profil ${profileTypeLabel}` }}
            </button>
          </div>
          <p v-if="deleteError" class="mt-3 text-sm text-red-600">{{ deleteError }}</p>
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
const { pushToast, requestConfirmation } = useUiFeedback()
const { wording } = useWording()

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
const fileError = ref('')
const generateError = ref('')
const applyError = ref('')
const deleteError = ref('')
const saving = ref(false)
const deleting = ref(false)
const generatingRef = ref(false)
const applyingFaceRef = ref(false)
const savingInstagram = ref(false)
const twitterStatusLoading = ref(false)
const twitterConnecting = ref(false)
const twitterConnected = ref(false)
const twitterUsername = ref('')
const isDragging = ref(false)
const sourceImageBase64 = ref('')
const sourcePreviewUrl = ref('')
const generatedImageBase64 = ref('')
const generatedTempImagePath = ref('')
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

// Rattachement aux marques: une ambassadrice peut en representer plusieurs, et
// jusqu ici rien ne permettait de modifier ce lien une fois le profil cree.
const { data: allProfiles, refresh: refreshProfiles } = await useFetch('/api/influencers', {
  key: 'influencer-edit-profiles',
})
const savingBrands = ref(false)
const brandLinksMessage = ref('')
const selectedBrandIds = ref([])

const brandOptions = computed(() => {
  const list = Array.isArray(allProfiles.value) ? allProfiles.value : []
  return list.filter((item) => item?.id !== id.value && item?.profileType === 'BRAND')
})

watch(
  [allProfiles, id],
  () => {
    const list = Array.isArray(allProfiles.value) ? allProfiles.value : []
    const current = list.find((item) => item?.id === id.value)
    const linked = Array.isArray(current?.brandIds) && current.brandIds.length
      ? current.brandIds
      : (current?.brandId ? [current.brandId] : [])
    selectedBrandIds.value = [...linked]
  },
  { immediate: true },
)

function toggleBrand(brandId) {
  const current = selectedBrandIds.value
  selectedBrandIds.value = current.includes(brandId)
    ? current.filter((value) => value !== brandId)
    : [...current, brandId]
  brandLinksMessage.value = ''
}

async function saveBrandLinks() {
  savingBrands.value = true
  brandLinksMessage.value = ''

  try {
    await $fetch(`/api/influencers/${id.value}/brands`, {
      method: 'PUT',
      body: { brandIds: selectedBrandIds.value },
    })
    await refreshProfiles()
    brandLinksMessage.value = selectedBrandIds.value.length
      ? 'Marques enregistrées.'
      : 'Plus aucune marque rattachée.'
  } catch (err) {
    brandLinksMessage.value = err?.statusMessage || 'Enregistrement impossible.'
  } finally {
    savingBrands.value = false
  }
}

const nicheItems = computed(() => splitNiches(form.niche))
const styleItems = computed(() => splitNiches(form.style))
const isAmbassadorProfile = computed(() => {
  return Boolean(String(influencer.value?.faceRefPath || currentFaceRefPath.value || '').trim())
})
const profileTypeLabel = computed(() => (isAmbassadorProfile.value ? wording.value.ambassador : 'marque'))
const profileTypeLabelDisplay = computed(() => {
  const label = profileTypeLabel.value
  return label.charAt(0).toUpperCase() + label.slice(1)
})
const linkedBrandLabel = computed(() => {
  const brandName = String(influencer.value?.brandName || '').trim()
  if (isAmbassadorProfile.value && brandName) {
    return `${wording.value.ambassador} rattachée à la marque ${brandName}`
  }

  if (!isAmbassadorProfile.value && brandName) {
    return `Influenceuse rattachée à la marque ${brandName}`
  }

  return ''
})
const settingsDescription = computed(() => {
  if (isAmbassadorProfile.value) {
    return 'Ajoute plusieurs niches si besoin, et remplace la face ref depuis le même écran.'
  }
  return 'Ajoute plusieurs niches et styles si besoin, et connecte tes réseaux sociaux depuis le même écran.'
})
const generatedImageDataUrl = computed(() => {
  if (!generatedImageBase64.value) return ''
  if (generatedImageBase64.value.startsWith('data:image/')) return generatedImageBase64.value
  return `data:image/jpeg;base64,${generatedImageBase64.value}`
})
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

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => {
      const result = String(reader.result || '')
      const base64 = result.includes(',') ? result.split(',')[1] : ''
      if (!base64) {
        reject(new Error('Impossible de lire l\'image source'))
        return
      }
      resolve(base64)
    }

    reader.onerror = () => {
      reject(new Error('Impossible de lire l\'image source'))
    }

    reader.readAsDataURL(file)
  })
}

function onCurrentFaceRefError() {
  currentFaceRefMissing.value = true
}

function resetFaceRefFlow() {
  if (sourcePreviewUrl.value) {
    URL.revokeObjectURL(sourcePreviewUrl.value)
  }
  sourceImageBase64.value = ''
  sourcePreviewUrl.value = ''
  generatedImageBase64.value = ''
  generatedTempImagePath.value = ''
  fileError.value = ''
  generateError.value = ''
  applyError.value = ''
}

async function setFile(file) {
  fileError.value = ''
  generateError.value = ''
  generatedImageBase64.value = ''
  generatedTempImagePath.value = ''

  if (!validImage(file)) {
    sourceImageBase64.value = ''
    fileError.value = 'Format invalide. Utilise un fichier JPG ou PNG.'
    return
  }

  if (sourcePreviewUrl.value) {
    URL.revokeObjectURL(sourcePreviewUrl.value)
  }
  sourcePreviewUrl.value = URL.createObjectURL(file)

  try {
    sourceImageBase64.value = await readFileAsBase64(file)
  } catch (err) {
    sourceImageBase64.value = ''
    fileError.value = err?.message || String(err)
  }
}

async function onFileSelect(event) {
  const file = event.target?.files?.[0]
  if (!file) return
  await setFile(file)
}

async function onDrop(event) {
  isDragging.value = false
  const file = event.dataTransfer?.files?.[0]
  if (!file) return
  await setFile(file)
}

async function generateFaceReference() {
  if (!sourceImageBase64.value || generatingRef.value) return

  generatingRef.value = true
  generateError.value = ''

  try {
    const payload = await $fetch('/api/generate/face-ref', {
      method: 'POST',
      body: {
        sourceImageBase64: sourceImageBase64.value,
        customPrompt: FACE_REF_BASE_PROMPT,
      },
    })

    generatedImageBase64.value = payload?.imageBase64 || ''
    generatedTempImagePath.value = payload?.tempImagePath || ''

    if (!generatedImageBase64.value || !generatedTempImagePath.value) {
      throw new Error('La génération n\'a pas retourné d\'image exploitable')
    }
  } catch (err) {
    generateError.value = err?.data?.statusMessage || err?.message || String(err)
  } finally {
    generatingRef.value = false
  }
}

function regenerateFaceReference() {
  generatedImageBase64.value = ''
  generatedTempImagePath.value = ''
  applyError.value = ''
}

async function applyGeneratedFaceRef() {
  if (!generatedTempImagePath.value || applyingFaceRef.value) return

  applyingFaceRef.value = true
  applyError.value = ''

  try {
    await $fetch('/api/upload/face-ref', {
      method: 'POST',
      body: {
        influencerId: id.value,
        tempImagePath: generatedTempImagePath.value,
      },
    })

    resetFaceRefFlow()
    await refresh()

    pushToast({
      title: 'Face ref mise à jour',
      message: 'La nouvelle fiche référence a été appliquée.',
      tone: 'success',
    })
  } catch (err) {
    const message = err?.data?.statusMessage || err?.message || 'Application impossible'
    applyError.value = message
    pushToast({
      title: 'Application impossible',
      message,
      tone: 'error',
      duration: 4500,
    })
  } finally {
    applyingFaceRef.value = false
  }
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

async function submit() {
  if (!canSubmit.value || saving.value) {
    return
  }

  saving.value = true
  submitError.value = ''

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

async function deleteProfile() {
  if (deleting.value || !id.value) {
    return
  }

  deleteError.value = ''

  const confirmed = await requestConfirmation({
    title: `Supprimer ce profil ${profileTypeLabel.value} ?`,
    message: `Cette action est irréversible : le profil "${form.name || influencer.value?.name || ''}" et tous ses contenus générés seront définitivement supprimés.`,
    confirmLabel: 'Supprimer définitivement',
    cancelLabel: 'Annuler',
    tone: 'danger',
  })

  if (!confirmed) {
    return
  }

  deleting.value = true
  try {
    await $fetch(`/api/influencers/${id.value}`, { method: 'DELETE' })

    if (activeInfluencerId.value === id.value) {
      activeInfluencerId.value = ''
    }

    pushToast({
      title: 'Profil supprimé',
      message: 'Le profil a bien été supprimé.',
      tone: 'success',
    })

    await router.push('/content')
  } catch (err) {
    const message = err?.data?.statusMessage || err?.message || 'Suppression impossible'
    deleteError.value = message
    pushToast({
      title: 'Suppression impossible',
      message,
      tone: 'error',
      duration: 4500,
    })
  } finally {
    deleting.value = false
  }
}

onBeforeUnmount(() => {
  if (sourcePreviewUrl.value) {
    URL.revokeObjectURL(sourcePreviewUrl.value)
  }
})
</script>