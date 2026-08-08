<template>
  <div class="space-y-6">
    <header class="rounded-[20px] border border-[#E5E3DF] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
      <p class="text-xs font-semibold uppercase tracking-[0.22em] text-[#E8873A]">Studio</p>
      <h1 class="mt-2 text-3xl font-bold tracking-tight text-[#111111]">Studio</h1>
      <p class="mt-2 text-sm text-[#666666]">Crée rapidement des visuels et vidéos IA pour ton activité.</p>
    </header>

    <div class="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.9fr)]">
      <section class="rounded-[20px] border border-[#E5E3DF] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
        <div
          v-if="isEditingMode"
          class="rounded-[14px] border border-[#F2CCAA] bg-[#FFF5EC] p-3"
        >
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p class="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#B45F1D]">Mode modification</p>
              <p class="mt-1 text-sm font-semibold text-[#111111]">Tu modifies une génération existante.</p>
              <button
                type="button"
                class="mt-2 rounded-[10px] border border-[#E6B78E] bg-white px-3 py-1.5 text-xs font-bold text-[#B45F1D] transition-colors hover:bg-[#FFF2E6]"
                @click="exitEditMode"
              >
                Quitter la modification
              </button>
            </div>
            <div class="h-16 w-16 overflow-hidden rounded-[10px] border border-[#E6D7C8] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
              <video
                v-if="editContentPreviewUrl && mode === 'video'"
                :src="editContentPreviewUrl"
                class="h-full w-full object-cover"
                muted
                playsinline
                preload="metadata"
              />
              <img
                v-else-if="editContentPreviewUrl"
                :src="editContentPreviewUrl"
                alt="Miniature du contenu en modification"
                class="h-full w-full object-cover"
              />
              <div v-else class="flex h-full w-full items-center justify-center text-[10px] font-semibold text-[#B49A85]">
                Aperçu
              </div>
            </div>
          </div>
        </div>

        <div class="mt-4 flex flex-wrap items-center gap-4">
          <label class="inline-flex items-center gap-2 text-sm font-semibold text-[#111111]">
            <input v-model="mode" type="radio" value="image" class="accent-[#E8873A]" />
            🖼️ Image
          </label>
          <label class="inline-flex items-center gap-2 text-sm font-semibold text-[#111111]">
            <input v-model="mode" type="radio" value="video" class="accent-[#E8873A]" />
            🎬 Vidéo
          </label>
        </div>

        <section
          v-if="mode === 'image' && !editingContentId"
          class="mt-4 rounded-[14px] border border-[#E5E3DF] bg-[#FAFAF8] p-3"
        >
          <p class="text-xs font-semibold uppercase tracking-[0.16em] text-[#A37A58]">Type de génération</p>
          <div class="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              class="rounded-[10px] border px-3 py-2 text-sm font-semibold transition-colors"
              :class="imageGenerationKind === 'single'
                ? 'border-[#E8873A] bg-[#FDF3EA] text-[#111111]'
                : 'border-[#E5E3DF] bg-white text-[#666666] hover:border-[#E8873A]/40'"
              @click="imageGenerationKind = 'single'"
            >
              Post unique
            </button>
            <button
              type="button"
              class="rounded-[10px] border px-3 py-2 text-sm font-semibold transition-colors"
              :class="imageGenerationKind === 'carousel'
                ? 'border-[#E8873A] bg-[#FDF3EA] text-[#111111]'
                : 'border-[#E5E3DF] bg-white text-[#666666] hover:border-[#E8873A]/40'"
              @click="imageGenerationKind = 'carousel'"
            >
              Carrousel
            </button>
          </div>
          <p class="mt-2 text-xs text-[#7B5A3F]">Le mode carrousel crée plusieurs images d'un coup (2 à 10 slides).</p>
        </section>

        <template v-if="mode === 'image' && imageGenerationKind === 'carousel' && !editingContentId">
          <div class="mt-4 space-y-3">
            <div class="flex items-center justify-between gap-3">
              <label class="text-sm font-bold text-[#111111]">Prompts du carrousel</label>
              <span class="text-xs font-semibold text-[#8A8A8A]">{{ carouselPrompts.length }}/{{ CAROUSEL_MAX_PROMPTS }} slides</span>
            </div>

            <div
              v-for="(item, index) in carouselPrompts"
              :key="item.id"
              class="rounded-[12px] border border-[#E5E3DF] bg-[#FAFAF8] p-3"
            >
              <div class="mb-2 flex items-center justify-between gap-2">
                <p class="text-xs font-bold uppercase tracking-[0.12em] text-[#9A9A9A]">Slide {{ index + 1 }}</p>
                <button
                  v-if="carouselPrompts.length > CAROUSEL_MIN_PROMPTS"
                  type="button"
                  class="text-xs font-semibold text-[#B45F1D] transition-colors hover:text-[#8E4B16]"
                  @click="removeCarouselPrompt(item.id)"
                >
                  Supprimer
                </button>
              </div>
              <textarea
                v-model="item.prompt"
                class="w-full rounded-[10px] border border-[#E5E3DF] bg-white p-3 text-sm text-[#111111] outline-none focus:border-[#E8873A]"
                style="min-height: 120px;"
                placeholder="Décris cette slide..."
              />
            </div>

            <button
              type="button"
              class="rounded-[10px] border border-dashed border-[#D9C6B4] bg-white px-3 py-2 text-sm font-semibold text-[#B45F1D] transition-colors hover:bg-[#FFF6EE] disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="carouselPrompts.length >= CAROUSEL_MAX_PROMPTS"
              @click="addCarouselPrompt"
            >
              + Ajouter un prompt
            </button>
          </div>
        </template>

        <template v-else>
          <label for="studio-prompt" class="mt-4 block text-sm font-bold text-[#111111]">Décris ce que tu veux créer</label>
          <textarea
            id="studio-prompt"
            v-model="prompt"
            class="mt-3 w-full rounded-[14px] border border-[#E5E3DF] bg-[#FAFAF8] p-4 text-sm text-[#111111] outline-none focus:border-[#E8873A]"
            style="min-height: 220px;"
            placeholder="Colle ton prompt ici ou décris ta scène..."
          />
        </template>

        <section class="mt-4 overflow-hidden rounded-[14px] border border-[#E5E3DF] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
          <button
            type="button"
            class="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors duration-150 hover:bg-[#FAFAF8]"
            @click="ambassadorPanelOpen = !ambassadorPanelOpen"
          >
            <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[#F2EEE8] text-base">👤</span>
            <div class="min-w-0 flex-1">
              <p class="text-sm font-bold text-[#111111]">Ambassadrice</p>
              <p class="truncate text-xs text-[#999999]">{{ ambassadorSummary }}</p>
            </div>
            <Icon
              name="lucide:chevron-down"
              class="h-4 w-4 shrink-0 text-[#BBBBBB] transition-transform duration-200"
              :class="ambassadorPanelOpen ? 'rotate-180' : ''"
            />
          </button>

          <transition
            enter-active-class="transition-[opacity,transform] duration-200 ease-out"
            enter-from-class="opacity-0 -translate-y-1"
            enter-to-class="opacity-100 translate-y-0"
            leave-active-class="transition-[opacity,transform] duration-150 ease-in"
            leave-from-class="opacity-100 translate-y-0"
            leave-to-class="opacity-0 -translate-y-1"
          >
            <div v-if="ambassadorPanelOpen" class="border-t border-[#F0EDE8] px-4 pb-4 pt-3.5">
              <div
                v-if="isContentCreator && showStudioHint"
                class="mb-4 flex items-start gap-2.5 rounded-[10px] border border-[#EBDCCF] bg-[#FFF7F0] px-3 py-2.5"
              >
                <span class="mt-px shrink-0 text-[13px]">💡</span>
                <p class="flex-1 text-xs leading-relaxed text-[#7B5A3F]">L'ambassadrice est facultative — génère sans elle pour un visuel sans visage.</p>
                <button
                  type="button"
                  class="mt-px shrink-0 opacity-50 transition-opacity hover:opacity-100"
                  @click.stop="dismissStudioHint"
                >
                  <Icon name="lucide:x" class="h-3.5 w-3.5 text-[#946944]" />
                </button>
              </div>

              <div class="grid grid-cols-2 gap-2">
                <label
                  class="flex cursor-pointer items-center gap-2.5 rounded-[10px] border p-3 text-sm font-medium transition-all duration-150"
                  :class="generationMode === 'with-ambassador'
                    ? 'border-[#E8873A] bg-[#FDF3EA] text-[#111111]'
                    : 'border-[#E5E3DF] bg-[#FAFAF8] text-[#888888] hover:border-[#E8873A]/40 hover:bg-white'"
                >
                  <input
                    v-model="generationMode"
                    type="radio"
                    value="with-ambassador"
                    class="accent-[#E8873A]"
                    :disabled="!hasAmbassadorProfiles"
                  />
                  Avec ambassadrice
                </label>
                <label
                  class="flex cursor-pointer items-center gap-2.5 rounded-[10px] border p-3 text-sm font-medium transition-all duration-150"
                  :class="generationMode === 'without-ambassador'
                    ? 'border-[#E8873A] bg-[#FDF3EA] text-[#111111]'
                    : 'border-[#E5E3DF] bg-[#FAFAF8] text-[#888888] hover:border-[#E8873A]/40 hover:bg-white'"
                >
                  <input
                    v-model="generationMode"
                    type="radio"
                    value="without-ambassador"
                    class="accent-[#E8873A]"
                  />
                  Sans ambassadrice
                </label>
              </div>

              <div v-if="generationMode === 'with-ambassador' && hasAmbassadorProfiles" class="mt-3">
                <label class="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#AAAAAA]">Ambassadrice sélectionnée</label>
                <select
                  v-model="selectedAmbassadorId"
                  class="mt-1.5 w-full rounded-[10px] border border-[#E5E3DF] bg-white px-3 py-2.5 text-sm text-[#111111] shadow-[0_1px_2px_rgba(0,0,0,0.04)] outline-none focus:border-[#E8873A] focus:shadow-[0_0_0_3px_rgba(232,135,58,0.10)]"
                >
                  <option value="">Choisir une ambassadrice...</option>
                  <option v-for="ambassador in ambassadorProfiles" :key="ambassador.id" :value="ambassador.id">
                    {{ ambassador.name }}
                  </option>
                </select>
              </div>

              <div v-if="!hasAmbassadorProfiles" class="mt-3 flex items-center justify-between gap-3 rounded-[10px] border border-dashed border-[#E5D8C9] bg-[#FAFAF8] px-3 py-2.5">
                <p class="text-xs text-[#7B5A3F]">Aucune ambassadrice configurée.</p>
                <NuxtLink
                  to="/profiles/new"
                  class="inline-flex items-center gap-1.5 rounded-[8px] bg-[#FDE7D6] px-2.5 py-1.5 text-xs font-bold text-[#B45F1D] transition-colors hover:bg-[#FAD9BE]"
                >
                  <Icon name="lucide:plus" class="h-3 w-3" />
                  Créer
                </NuxtLink>
              </div>
            </div>
          </transition>
        </section>

        <p v-if="errorMessage" class="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{{ errorMessage }}</p>

        <button
          type="button"
          class="mt-5 rounded-[12px] bg-[#E8873A] px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-[#d4762f] disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="loading || !canGenerate"
          @click="submit"
        >
          {{ loading ? 'Génération en cours...' : (editingContentId ? 'Régénérer' : 'Générer') }}
        </button>
      </section>

      <aside class="rounded-[20px] border border-[#E5E3DF] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
        <h2 class="text-lg font-bold text-[#111111]">Résultat</h2>
        <p class="mt-2 text-xs text-[#666666]">Le rendu apparaît ici après lancement.</p>

        <!-- Génération vidéo en cours -->
        <div v-if="videoPolling.active" class="mt-4 space-y-3">
          <div class="flex items-center gap-3 rounded-[14px] border border-[#E5E3DF] bg-[#FAFAF8] px-4 py-3">
            <span class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[#E8873A] border-t-transparent" />
            <span class="text-sm font-semibold text-[#111111]">Génération vidéo en cours...</span>
          </div>
          <p class="text-xs text-[#888]">La vidéo est générée par Veo (~60–90 s). Elle apparaîtra ici automatiquement.</p>
          <NuxtLink
            to="/content"
            class="inline-flex items-center gap-1.5 text-xs font-semibold text-[#E8873A] hover:underline"
          >
            Suivre dans Mes créations →
          </NuxtLink>
        </div>

        <!-- Génération en cours (soumission initiale, image ou avant le polling vidéo) -->
        <div v-else-if="loading" class="mt-4 flex items-center gap-3 rounded-[14px] border border-[#E5E3DF] bg-[#FAFAF8] px-4 py-3">
          <span class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[#E8873A] border-t-transparent" />
          <span class="text-sm font-semibold text-[#111111]">Génération en cours...</span>
        </div>

        <!-- Résultat vidéo prêt -->
        <div v-else-if="videoResult" class="mt-4 space-y-3">
          <template v-if="videoResult.status === 'PENDING' || videoResult.status === 'VALIDATED' || videoResult.status === 'PUBLISHED'">
            <video
              v-if="videoResult.imageUrl"
              :src="videoResult.imageUrl"
              class="w-full rounded-[14px] border border-[#E5E3DF] object-cover"
              controls
              playsinline
              muted
            />
            <p class="text-xs text-[#444]">Vidéo générée avec succès.</p>
            <NuxtLink to="/content" class="inline-flex items-center gap-1.5 text-xs font-semibold text-[#E8873A] hover:underline">
              Voir dans Mes créations →
            </NuxtLink>
          </template>
          <template v-else-if="videoResult.status === 'FAILED'">
            <p class="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {{ videoResult.errorMessage || 'La génération a échoué.' }}
            </p>
          </template>
        </div>

        <!-- Résultat image -->
        <div v-else-if="lastResult && mode === 'image'" class="mt-4 space-y-3 rounded-[14px] border border-[#E5E3DF] bg-[#FAFAF8] p-4 text-sm text-[#222]">
          <template v-if="lastResult.mode === 'carousel'">
            <p><strong>Mode :</strong> Carrousel</p>
            <p><strong>Slides générées :</strong> {{ lastResult.generatedCount || 0 }} / {{ lastResult.total || 0 }}</p>
            <p><strong>Status :</strong> {{ lastResult.status || '-' }}</p>
            <p v-if="Array.isArray(lastResult.contentIds) && lastResult.contentIds.length">
              <strong>Content IDs :</strong> {{ lastResult.contentIds.join(', ') }}
            </p>
          </template>
          <template v-else>
            <p><strong>Status :</strong> {{ lastResult.status || '-' }}</p>
            <p><strong>Content ID :</strong> {{ lastResult.contentId || '-' }}</p>
            <p v-if="lastResult.model"><strong>Modèle :</strong> {{ lastResult.model }}</p>
          </template>
        </div>

        <p v-else class="mt-4 text-sm text-[#777]">Aucun résultat pour le moment.</p>
      </aside>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

const { pushToast } = useUiFeedback()
const { user } = useAuthSession()
const activeInfluencerId = useActiveInfluencer()
const route = useRoute()

const prompt = ref('')
const mode = ref('image')
const imageGenerationKind = ref('single')
const generationMode = ref('without-ambassador')
const selectedAmbassadorId = ref('')
const loading = ref(false)
const errorMessage = ref('')
const lastResult = ref(null)
const showStudioHint = ref(true)
const ambassadorPanelOpen = ref(true)
const editingContentId = ref('')
const editContentPreviewUrl = ref('')
const CAROUSEL_MIN_PROMPTS = 2
const CAROUSEL_MAX_PROMPTS = 10
let carouselPromptKey = 0

function createCarouselPrompt(initialValue = '') {
  carouselPromptKey += 1
  return {
    id: `carousel-prompt-${carouselPromptKey}`,
    prompt: initialValue,
  }
}

const carouselPrompts = ref([
  createCarouselPrompt(''),
  createCarouselPrompt(''),
])

// Polling vidéo asynchrone
const videoPolling = ref({ active: false, contentId: null, intervalId: null })
const videoResult = ref(null)

function clearVideoPolling() {
  if (videoPolling.value.intervalId) {
    clearInterval(videoPolling.value.intervalId)
    videoPolling.value.intervalId = null
  }
  videoPolling.value.active = false
  videoPolling.value.contentId = null
}

async function pollVideoStatus(contentId) {
  try {
    const status = await $fetch(`/api/content/${contentId}/status`)
    if (status?.done) {
      clearVideoPolling()
      videoResult.value = status

      if (status.status === 'PENDING' || status.status === 'VALIDATED' || status.status === 'PUBLISHED') {
        pushToast({ title: 'Vidéo prête !', message: 'Ta vidéo est disponible dans Mes créations.', tone: 'success' })
      } else if (status.status === 'FAILED') {
        pushToast({ title: 'Erreur', message: status.errorMessage || 'Génération vidéo échouée.', tone: 'error' })
      }
    }
  } catch {
    // Ignore les erreurs transitoires du polling
  }
}

function startVideoPolling(contentId) {
  clearVideoPolling()
  videoResult.value = null
  videoPolling.value.active = true
  videoPolling.value.contentId = contentId
  videoPolling.value.intervalId = setInterval(() => pollVideoStatus(contentId), 5000)
  // Premier check immédiat
  pollVideoStatus(contentId)
}

onBeforeUnmount(() => {
  clearVideoPolling()
})

const { data: influencersData } = await useFetch('/api/influencers', {
  key: 'studio-influencers',
})

const selectedProfile = computed(() => {
  const list = Array.isArray(influencersData.value) ? influencersData.value : []
  if (!list.length) return null

  const active = list.find((item) => item.id === activeInfluencerId.value)
  return active || list[0]
})

const primaryInfluencerId = computed(() => selectedProfile.value?.id || '')
const isContentCreator = computed(() => String(user.value?.accountType || '').toUpperCase() === 'CONTENT_CREATOR')
const ambassadorProfiles = computed(() => {
  const list = Array.isArray(influencersData.value) ? influencersData.value : []
  return list.filter((item) => Boolean(String(item?.faceRefPath || '').trim()))
})
const hasAmbassadorProfiles = computed(() => ambassadorProfiles.value.length > 0)
const activeAmbassadorId = computed(() => {
  const activeId = String(activeInfluencerId.value || '')
  if (!activeId) return ''
  const found = ambassadorProfiles.value.find((item) => item.id === activeId)
  return found?.id || ''
})
const wantsAmbassador = computed(() => generationMode.value === 'with-ambassador' && hasAmbassadorProfiles.value)
const resolvedAmbassadorId = computed(() => {
  if (!wantsAmbassador.value) return ''
  return String(selectedAmbassadorId.value || '').trim()
})

const selectedAmbassadorName = computed(() => {
  if (!selectedAmbassadorId.value) return ''
  const found = ambassadorProfiles.value.find((item) => item.id === selectedAmbassadorId.value)
  return found?.name || ''
})

const ambassadorSummary = computed(() => {
  if (generationMode.value === 'without-ambassador') return 'Génération sans ambassadrice'
  if (selectedAmbassadorName.value) return selectedAmbassadorName.value
  if (!hasAmbassadorProfiles.value) return 'Aucune ambassadrice disponible'
  return 'Sélectionner une ambassadrice'
})

const isEditingMode = computed(() => Boolean(editingContentId.value))

const trimmedCarouselPrompts = computed(() => (
  carouselPrompts.value.map((item) => String(item?.prompt || '').trim())
))

const canGenerate = computed(() => {
  if (mode.value === 'image' && imageGenerationKind.value === 'carousel' && !editingContentId.value) {
    if (carouselPrompts.value.length < CAROUSEL_MIN_PROMPTS || carouselPrompts.value.length > CAROUSEL_MAX_PROMPTS) {
      return false
    }

    if (trimmedCarouselPrompts.value.some((itemPrompt) => !itemPrompt)) {
      return false
    }
  } else if (!prompt.value.trim()) {
    return false
  }

  if (!primaryInfluencerId.value) return false
  if (wantsAmbassador.value && !resolvedAmbassadorId.value) return false
  return true
})

function addCarouselPrompt() {
  if (carouselPrompts.value.length >= CAROUSEL_MAX_PROMPTS) return
  carouselPrompts.value.push(createCarouselPrompt(''))
}

function removeCarouselPrompt(promptId) {
  if (carouselPrompts.value.length <= CAROUSEL_MIN_PROMPTS) return
  carouselPrompts.value = carouselPrompts.value.filter((item) => item.id !== promptId)
}

watch(
  ambassadorProfiles,
  (list) => {
    if (!list.length) {
      generationMode.value = 'without-ambassador'
      selectedAmbassadorId.value = ''
      return
    }

    if (activeAmbassadorId.value) {
      selectedAmbassadorId.value = activeAmbassadorId.value
      return
    }

    if (!selectedAmbassadorId.value) {
      selectedAmbassadorId.value = list[0].id
    }
  },
  { immediate: true },
)

watch(generationMode, (value) => {
  if (value === 'without-ambassador') {
    selectedAmbassadorId.value = ''
    return
  }

  if (!selectedAmbassadorId.value) {
    selectedAmbassadorId.value = activeAmbassadorId.value || ambassadorProfiles.value[0]?.id || ''
  }
})

watch(mode, (value) => {
  if (value !== 'image') {
    imageGenerationKind.value = 'single'
  }
})

function exitEditMode() {
  editingContentId.value = ''
  editContentPreviewUrl.value = ''
  navigateTo(route.path || '/studio')
}

const editContentIdParam = String(route.query.edit || '').trim()
if (editContentIdParam) {
  try {
    const editContent = await $fetch(`/api/content/${editContentIdParam}`)
    editingContentId.value = editContentIdParam
    prompt.value = String(editContent?.prompt || '')
    editContentPreviewUrl.value = String(editContent?.imageUrl || '').trim()
    mode.value = String(editContent?.format || '').trim().toUpperCase() === 'REEL' ? 'video' : 'image'

    if (editContent?.ambassadorId) {
      generationMode.value = 'with-ambassador'
      selectedAmbassadorId.value = editContent.ambassadorId
    } else {
      generationMode.value = 'without-ambassador'
      selectedAmbassadorId.value = ''
    }
  } catch (err) {
    errorMessage.value = err?.data?.statusMessage || err?.message || 'Impossible de charger ce contenu à modifier.'
  }
}

function dismissStudioHint() {
  showStudioHint.value = false
  if (!process.client) return
  try {
    localStorage.setItem('plotline.studio.hint.dismissed', '1')
  } catch {}
}

if (process.client) {
  try {
    showStudioHint.value = localStorage.getItem('plotline.studio.hint.dismissed') !== '1'
  } catch {
    showStudioHint.value = true
  }
}

async function submit() {
  if (loading.value || !canGenerate.value) return

  loading.value = true
  errorMessage.value = ''

  try {
    const isEditing = Boolean(editingContentId.value)

    if (mode.value === 'image') {
      if (isEditing) {
        lastResult.value = await $fetch(`/api/content/${editingContentId.value}/regenerate`, {
          method: 'POST',
          body: { prompt: prompt.value.trim() },
        })
      } else if (imageGenerationKind.value === 'carousel') {
        const prompts = trimmedCarouselPrompts.value
        const successIds = []
        const failures = []

        for (let index = 0; index < prompts.length; index += 1) {
          try {
            const response = await $fetch('/api/generate/image', {
              method: 'POST',
              body: {
                influencerId: primaryInfluencerId.value,
                ambassadorId: resolvedAmbassadorId.value || null,
                workflowType: 'free',
                prompt: prompts[index],
                contentType: 'feed',
              },
            })

            if (response?.contentId) {
              successIds.push(response.contentId)
            }
          } catch (err) {
            failures.push({
              index,
              message: err?.data?.statusMessage || err?.message || 'Erreur inconnue',
            })
          }
        }

        lastResult.value = {
          mode: 'carousel',
          status: failures.length ? (successIds.length ? 'partial' : 'failed') : 'processing',
          generatedCount: successIds.length,
          total: prompts.length,
          contentIds: successIds,
        }

        if (!successIds.length) {
          throw new Error(failures[0]?.message || 'Aucune image du carrousel n a pu être générée.')
        }

        if (failures.length) {
          errorMessage.value = `${failures.length} slide(s) sur ${prompts.length} ont échoué. Tu peux relancer après correction des prompts.`
        }
      } else {
        lastResult.value = await $fetch('/api/generate/image', {
          method: 'POST',
          body: {
            influencerId: primaryInfluencerId.value,
            ambassadorId: resolvedAmbassadorId.value || null,
            workflowType: 'free',
            prompt: prompt.value.trim(),
            contentType: 'feed',
          },
        })
      }
    } else {
      const result = isEditing
        ? await $fetch(`/api/content/${editingContentId.value}/regenerate`, {
            method: 'POST',
            body: { prompt: prompt.value.trim() },
          })
        : await $fetch('/api/generate/video', {
            method: 'POST',
            body: {
              prompt: prompt.value.trim(),
              influencerId: primaryInfluencerId.value,
              ambassadorId: resolvedAmbassadorId.value || null,
              withFaceRef: wantsAmbassador.value,
            },
          })
      lastResult.value = result

      if (result?.contentId) {
        startVideoPolling(result.contentId)
        pushToast({
          title: isEditing ? 'Régénération lancée' : 'Génération lancée',
          message: isEditing ? 'Veo régénère ta vidéo. Résultat ici dans ~60s.' : 'Veo génère ta vidéo. Résultat ici dans ~60s.',
          tone: 'success',
        })
      }
    }

    if (mode.value === 'image') {
      pushToast({
        title: isEditing ? 'Régénération lancée' : 'Génération lancée',
        message: isEditing
          ? 'Le contenu a bien été renvoyé au pipeline.'
          : (imageGenerationKind.value === 'carousel'
              ? `Le carrousel est parti en génération (${lastResult.value?.generatedCount || 0} slide(s)).`
              : 'Le contenu a bien été envoyé au pipeline.'),
        tone: 'success',
      })
    }

    editingContentId.value = ''
    editContentPreviewUrl.value = ''
  } catch (err) {
    errorMessage.value = err?.data?.statusMessage || err?.message || 'Generation impossible.'
  } finally {
    loading.value = false
  }
}
</script>
