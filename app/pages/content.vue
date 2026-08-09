<template>
  <div class="space-y-6">
    <header class="flex flex-col gap-4 rounded-[20px] border border-[#E5E3DF] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)] lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p class="text-xs font-semibold uppercase tracking-[0.22em] text-[#E8873A]">Contenu</p>
        <h1 class="mt-2 text-3xl font-bold tracking-tight text-[#111111]">{{ selectedInfluencer?.name || 'Contenu' }}</h1>
        <p class="mt-2 text-sm text-[#666666]">{{ selectedInfluencer ? 'Par défaut, la vue démarre sur tout puis se filtre par statut.' : `Aucune ${wording.ambassador} active pour le moment.` }}</p>
        <div v-if="selectedInfluencer" class="mt-3 flex flex-wrap items-center gap-2 text-sm text-[#666666]">
          <span
            v-for="item in nicheChips"
            :key="`niche-${item}`"
            class="rounded-full bg-[#FDE7D6] px-2.5 py-1 text-xs font-bold text-[#B45F1D]"
          >
            {{ item }}
          </span>
          <span
            v-for="item in styleChips"
            :key="`style-${item}`"
            class="rounded-full border border-[#E5E3DF] bg-[#FAFAF8] px-2.5 py-1 text-xs font-semibold text-[#111111]"
          >
            {{ item }}
          </span>
        </div>
      </div>

      <div class="flex flex-wrap gap-2">
        <NuxtLink
          v-if="selectedInfluencer"
          :to="generateHref"
          class="rounded-[12px] bg-[#E8873A] px-4 py-2.5 text-sm font-bold text-white transition-all duration-150 hover:bg-[#d4762f]"
        >
          Générer
        </NuxtLink>
      </div>
    </header>

    <div class="flex flex-wrap gap-2 rounded-[16px] border border-[#E5E3DF] bg-white p-2 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
      <button
        v-for="tab in tabs"
        :key="tab.value"
        type="button"
        class="rounded-[12px] px-4 py-2.5 text-sm font-semibold transition-colors duration-150"
        :class="activeTab === tab.value ? 'bg-[#111111] text-white' : 'text-[#666666] hover:bg-[#FAFAF8]'"
        @click="activeTab = tab.value"
      >
        {{ tab.label }}
      </button>
    </div>

    <div v-if="isBrand" class="flex flex-col gap-3 rounded-[16px] border border-[#E5E3DF] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.05)] sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p class="text-sm font-semibold text-[#111111]">Filtrer par campagne</p>
        <p class="text-xs text-[#666666]">Affiche uniquement les contenus liés à une campagne précise.</p>
      </div>
      <div class="flex items-center gap-2">
        <select
          v-model="selectedCampaignId"
          class="min-w-[220px] rounded-[12px] border border-[#E5E3DF] bg-white px-3 py-2 text-sm text-[#111111] outline-none focus:border-[#E8873A]"
        >
          <option value="">Toutes les campagnes</option>
          <option v-for="campaign in campaigns" :key="campaign.id" :value="campaign.id">
            {{ campaign.name }}
          </option>
        </select>
        <button type="button" class="rounded-[12px] border border-[#E5E3DF] bg-[#FAFAF8] px-3 py-2 text-xs font-bold text-[#111111]" @click="selectedCampaignId = ''">
          Réinitialiser
        </button>
      </div>
    </div>

    <div v-if="loadingMeta || loadingContent" class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      <div v-for="n in 6" :key="n" class="overflow-hidden rounded-[20px] border border-[#E5E3DF] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
        <div class="aspect-[4/5] animate-pulse bg-[#F2EEE8]" />
        <div class="space-y-2 p-4">
          <div class="h-3 w-1/3 animate-pulse rounded bg-[#E5E3DF]" />
          <div class="h-3 w-full animate-pulse rounded bg-[#E5E3DF]" />
          <div class="h-3 w-4/5 animate-pulse rounded bg-[#E5E3DF]" />
        </div>
      </div>
    </div>

    <div v-else-if="!selectedInfluencer" class="rounded-[20px] border border-dashed border-[#E5E3DF] bg-white px-6 py-16 text-center">
      <p class="text-base font-semibold text-[#111111]">Aucune {{ wording.ambassador }} sélectionnée</p>
      <p class="mt-2 text-sm text-[#666666]">Crée une {{ wording.ambassador }} ou sélectionne-en une depuis la sidebar.</p>
      <NuxtLink to="/profiles/new" class="mt-5 inline-flex rounded-[12px] bg-[#E8873A] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#d4762f]">
        Nouvelle {{ wording.ambassador }}
      </NuxtLink>
    </div>

    <div v-else-if="!displayedContents.length" class="rounded-[20px] border border-dashed border-[#E5E3DF] bg-white px-6 py-16 text-center">
      <p class="text-base font-semibold text-[#111111]">{{ emptyStateLabel }}</p>
      <p class="mt-2 text-sm text-[#666666]">Cette {{ wording.ambassador }} n’a pas encore de contenu dans cette catégorie.</p>
    </div>

    <div v-else class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      <article
        v-for="item in displayedContents"
        :key="item.id"
        class="group overflow-hidden rounded-[20px] border border-[#E5E3DF] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08)] transition-transform duration-150 hover:-translate-y-0.5"
        :class="item.status === 'FAILED' ? 'border-red-200' : ''"
      >
        <div class="relative aspect-[4/5] overflow-hidden bg-[#FAFAF8]">
          <template v-if="item.status === 'PROCESSING'">
            <div class="absolute inset-0 animate-pulse bg-[#F2EEE8]" />
            <div class="absolute inset-0 flex items-center justify-center">
              <span class="rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-[#111111] shadow-sm">Génération en cours... {{ item._progress }}%</span>
            </div>
          </template>

          <template v-else-if="item.status === 'FAILED'">
            <div class="flex h-full items-center justify-center p-5">
              <p class="text-center text-sm font-medium text-red-600">{{ item.errorMessage || 'Échec de la génération' }}</p>
            </div>
          </template>

          <template v-else-if="item.imageUrl && !item._imageMissing">
            <button type="button" class="h-full w-full" @click="openModal(item)">
              <video
                v-if="isVideoMedia(item)"
                :src="item.imageUrl"
                class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                muted
                playsinline
                preload="metadata"
                @error="markImageMissing(item)"
              />
              <img
                v-else
                :src="item.imageUrl"
                :alt="`Contenu ${item.format}`"
                class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                @error="markImageMissing(item)"
              />
            </button>
          </template>

          <template v-else-if="item._imageMissing">
            <div class="flex h-full items-center justify-center p-5 text-center text-sm text-[#666666]">
              Média indisponible sur ce serveur.
            </div>
          </template>

          <template v-else>
            <div class="flex h-full items-center justify-center text-sm text-[#999999]">Pas d'image</div>
          </template>

          <div class="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/0 to-black/0 opacity-0 transition-opacity duration-150 group-hover:opacity-100" />
          <div class="absolute left-3 right-3 top-3 flex items-start justify-between gap-2">
            <span class="rounded-full px-2.5 py-1 text-[11px] font-bold text-white" :class="statusClass(item.status)">{{ statusLabel(item.status) }}</span>
            <span
              v-if="carouselSlidesOf(item).length > 1"
              class="rounded-full border border-white/30 bg-black/45 px-2.5 py-1 text-[11px] font-bold text-white"
            >
              ▦ Carrousel · {{ carouselSlidesOf(item).length }}
            </span>
            <span v-else class="rounded-full border border-white/30 bg-black/35 px-2.5 py-1 text-[11px] font-bold text-white">{{ formatLabel(item.format) }}</span>
          </div>

          <div class="absolute inset-x-0 bottom-0 flex gap-2 p-3 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
            <NuxtLink
              v-if="canModify(item)"
              :to="modifyHref(item)"
              class="flex-1 rounded-[12px] border border-white/20 bg-white/15 px-3 py-2 text-center text-xs font-bold text-white backdrop-blur transition-colors duration-150 hover:bg-white/25"
            >
              ✎ Modifier
            </NuxtLink>
            <button
              v-if="canValidate(item)"
              type="button"
              class="flex-1 rounded-[12px] bg-white px-3 py-2 text-xs font-bold text-[#111111] shadow-sm transition-colors duration-150 hover:bg-[#FAFAF8] disabled:opacity-60"
              :disabled="item._loading"
              @click="validate(item)"
            >
              ✓ Valider
            </button>
            <button
              v-if="canPublish(item)"
              type="button"
              class="flex-1 rounded-[12px] bg-[#111111] px-3 py-2 text-xs font-bold text-white shadow-sm transition-colors duration-150 hover:bg-[#2a2a2a] disabled:opacity-60"
              :disabled="item._loading"
              @click="publish(item)"
            >
              {{ isInstagramPublished(item) ? 'Instagram publié' : 'Publier Insta' }}
            </button>
            <button
              v-if="canPublishTwitter(item)"
              type="button"
              class="flex-1 rounded-[12px] bg-[#0f1419] px-3 py-2 text-xs font-bold text-white shadow-sm transition-colors duration-150 hover:bg-[#1f2a33] disabled:opacity-60"
              :disabled="item._loading"
              @click="publishTwitter(item)"
            >
              {{ isTwitterPublished(item) ? 'X publié' : '🐦 Publier sur X' }}
            </button>
            <button
              type="button"
              class="rounded-[12px] border border-white/20 bg-white/15 px-3 py-2 text-xs font-bold text-white backdrop-blur transition-colors duration-150 hover:bg-white/25 disabled:opacity-60"
              :disabled="item._loading"
              @click="remove(item)"
            >
              ✗ Supprimer
            </button>
          </div>
        </div>

        <div class="space-y-3 p-4">
          <div class="flex items-center justify-between gap-2 text-xs text-[#666666]">
            <span class="inline-flex items-center gap-1.5">
              {{ timeAgo(item.createdAt) }}
              <span
                v-if="item.generationModel"
                class="rounded-full border border-[#EDE9E3] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-[#A5A5A5]"
                :title="`Modèle utilisé : ${item.generationModel}`"
              >
                {{ shortModelLabel(item.generationModel) }}
              </span>
            </span>
            <span v-if="item.campaign?.name" class="rounded-full bg-[#F4EFE8] px-2.5 py-1 text-[11px] font-bold text-[#B45F1D]">
              {{ item.campaign.name }}
            </span>
            <button
              v-if="item.caption"
              type="button"
              class="font-semibold text-[#E8873A] transition-colors duration-150 hover:text-[#d4762f]"
              @click="copyCaption(item)"
            >
              {{ item._copied ? 'Copié !' : 'Copier la caption' }}
            </button>
          </div>
          <div v-if="item.status === 'PUBLISHED'" class="flex flex-wrap items-center gap-2 text-[11px] font-extrabold tracking-wide">
            <span
              v-if="isInstagramPublished(item)"
              class="inline-flex h-6 min-w-6 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 px-2 text-emerald-700"
              title="Publié sur Instagram"
            >
              IG
            </span>
            <span
              v-if="isTwitterPublished(item)"
              class="inline-flex h-6 min-w-6 items-center justify-center rounded-full border border-sky-200 bg-sky-50 px-2 text-sky-700"
              title="Publié sur X"
            >
              X
            </span>
          </div>
          <p v-if="item.caption" class="line-clamp-3 text-sm leading-6 text-[#111111]">{{ item.caption }}</p>
        </div>
      </article>
    </div>

    <Teleport to="body">
      <div v-if="modalMedia" class="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black/80 p-4" @click.self="closeModal">
        <button type="button" class="absolute right-4 top-4 rounded-full bg-white/20 px-3 py-2 text-sm font-bold text-white hover:bg-white/30" @click="closeModal">✕</button>

        <div class="relative flex min-h-0 flex-1 items-center justify-center" @click.self="closeModal">
          <button
            v-if="hasSeveralVersions"
            type="button"
            class="absolute left-0 z-10 rounded-full bg-white/20 px-3 py-3 text-lg font-bold text-white backdrop-blur transition-colors hover:bg-white/35 disabled:opacity-30"
            :disabled="versionIndex >= modalVersions.length - 1"
            aria-label="Version précédente"
            @click="goToVersion(versionIndex + 1)"
          >
            ‹
          </button>

          <video
            v-if="modalMediaIsVideo"
            :key="modalMedia"
            :src="modalMedia"
            class="max-h-full max-w-full rounded-[20px] object-contain shadow-2xl"
            controls
            autoplay
            playsinline
          />
          <img v-else :src="modalMedia" class="max-h-full max-w-full rounded-[20px] object-contain shadow-2xl" alt="Aperçu" />

          <button
            v-if="hasSeveralVersions"
            type="button"
            class="absolute right-0 z-10 rounded-full bg-white/20 px-3 py-3 text-lg font-bold text-white backdrop-blur transition-colors hover:bg-white/35 disabled:opacity-30"
            :disabled="versionIndex <= 0"
            aria-label="Version suivante"
            @click="goToVersion(versionIndex - 1)"
          >
            ›
          </button>
        </div>

        <div v-if="hasSeveralSlides" class="flex shrink-0 flex-wrap items-center justify-center gap-3 rounded-[16px] bg-black/60 px-4 py-3 backdrop-blur">
          <button
            type="button"
            class="rounded-[10px] bg-white/15 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-white/25 disabled:opacity-30"
            :disabled="slideIndex <= 0"
            @click="goToSlide(slideIndex - 1)"
          >
            ‹ Slide
          </button>

          <div class="flex items-center gap-1.5">
            <button
              v-for="(slide, index) in modalSlides"
              :key="slide.id"
              type="button"
              class="h-2 rounded-full transition-all"
              :class="index === slideIndex ? 'w-6 bg-[#E8873A]' : 'w-2 bg-white/40 hover:bg-white/70'"
              :aria-label="`Slide ${index + 1}`"
              @click="goToSlide(index)"
            />
          </div>

          <p class="text-xs font-semibold text-white/90">
            Slide {{ slideIndex + 1 }} / {{ modalSlides.length }}
          </p>

          <button
            type="button"
            class="rounded-[10px] bg-white/15 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-white/25 disabled:opacity-30"
            :disabled="slideIndex >= modalSlides.length - 1"
            @click="goToSlide(slideIndex + 1)"
          >
            Slide ›
          </button>
        </div>

        <div v-if="hasSeveralVersions" class="flex shrink-0 flex-wrap items-center justify-center gap-3 rounded-[16px] bg-black/50 px-4 py-3 backdrop-blur">
          <div class="flex items-center gap-1.5">
            <button
              v-for="(version, index) in modalVersions"
              :key="version.id"
              type="button"
              class="h-2 w-2 rounded-full transition-all"
              :class="index === versionIndex ? 'w-5 bg-white' : 'bg-white/40 hover:bg-white/70'"
              :aria-label="`Version ${modalVersions.length - index}`"
              @click="goToVersion(index)"
            />
          </div>

          <p class="text-xs font-semibold text-white/90">
            Version {{ modalVersions.length - versionIndex }} / {{ modalVersions.length }}
            <span v-if="currentVersion?.generationModel" class="text-white/60">
              · {{ shortModelLabel(currentVersion.generationModel) }}
            </span>
          </p>

          <span
            v-if="currentVersion?.isActive"
            class="rounded-full bg-emerald-500/25 px-2.5 py-1 text-[11px] font-bold text-emerald-200"
          >
            Version actuelle
          </span>
          <button
            v-else
            type="button"
            class="rounded-[10px] bg-[#E8873A] px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-[#d4762f] disabled:opacity-60"
            :disabled="restoringVersion"
            @click="restoreVersion"
          >
            {{ restoringVersion ? 'Restauration...' : 'Utiliser cette version' }}
          </button>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'

const activeInfluencerId = useActiveInfluencer()
const { pushToast } = useUiFeedback()
const { wording, accountType, formatLabel } = useWording()
const isContentCreator = computed(() => accountType.value === 'CONTENT_CREATOR')
const isBrand = computed(() => accountType.value === 'BRAND')

const tabs = [
  { label: 'Tout', value: 'ALL' },
  { label: 'En attente', value: 'PENDING' },
  { label: 'Validé', value: 'VALIDATED' },
  { label: 'Publié', value: 'PUBLISHED' },
]

const activeTab = ref('ALL')
const selectedCampaignId = ref('')
const loadingContent = ref(false)
const modalMedia = ref(null)
const modalMediaIsVideo = ref(false)
const modalContent = ref(null)
const modalVersions = ref([])
const versionIndex = ref(0)
const restoringVersion = ref(false)
const currentVersion = computed(() => modalVersions.value[versionIndex.value] || null)
const hasSeveralVersions = computed(() => modalVersions.value.length > 1)
const modalSlides = ref([])
const slideIndex = ref(0)
const hasSeveralSlides = computed(() => modalSlides.value.length > 1)

// Le workflow Pinterest (/profiles/[id]/generate) est reserve au compte
// influenceur. Les comptes marque et createur passent par leur studio.
const generateHref = computed(() => {
  if (isContentCreator.value) return '/studio'
  if (isBrand.value) return '/brand-studio'
  return selectedInfluencer.value ? `/profiles/${selectedInfluencer.value.id}/generate` : '/profiles'
})
const contentItems = ref([])
const twitterConnecting = ref(false)
const POLL_FAST_MS = 15_000
const POLL_IDLE_MS = 60_000
const activeRequestId = ref(0)
const activeJobsByContentId = ref({})
let activeJobsTimer = null
let currentPollInterval = POLL_FAST_MS

const { data: influencersData, pending: loadingMeta } = await useFetch('/api/influencers', {
  key: 'plotline-content-influencers',
})

const { data: campaignsData } = await useFetch('/api/campaigns', {
  key: 'plotline-content-campaigns',
})

const influencers = computed(() => influencersData.value || [])
const campaigns = computed(() => Array.isArray(campaignsData.value) ? campaignsData.value : [])
const selectedInfluencer = computed(() => {
  return influencers.value.find((item) => item.id === activeInfluencerId.value) || influencers.value[0] || null
})

const nicheChips = computed(() => splitNiches(selectedInfluencer.value?.niche))
const styleChips = computed(() => splitNiches(selectedInfluencer.value?.style))

// Un carrousel occupe une seule carte: on affiche sa premiere slide comme
// couverture et les autres restent accessibles en faisant defiler dans la
// visionneuse. Les contenus simples sont laisses tels quels.
const displayedContents = computed(() => {
  const shown = []
  const seenCarousels = new Set()

  for (const item of contentItems.value) {
    const carouselId = String(item?.carouselId || '').trim()

    if (!carouselId) {
      shown.push(item)
      continue
    }

    if (seenCarousels.has(carouselId)) continue
    seenCarousels.add(carouselId)

    const slides = contentItems.value
      .filter((row) => String(row?.carouselId || '').trim() === carouselId)
      .sort((a, b) => Number(a.carouselPosition || 0) - Number(b.carouselPosition || 0))

    shown.push(slides[0] || item)
  }

  return shown
})

function carouselSlidesOf(item) {
  const carouselId = String(item?.carouselId || '').trim()
  if (!carouselId) return []

  return contentItems.value
    .filter((row) => String(row?.carouselId || '').trim() === carouselId)
    .sort((a, b) => Number(a.carouselPosition || 0) - Number(b.carouselPosition || 0))
}

const emptyStateLabel = computed(() => {
  if (activeTab.value === 'PENDING') return 'Aucun contenu en attente pour l’instant.'
  if (activeTab.value === 'VALIDATED') return 'Aucun contenu validé pour l’instant.'
  if (activeTab.value === 'PUBLISHED') return 'Aucun contenu publié pour l’instant.'
  return `Aucun contenu trouvé pour cette ${wording.value.ambassador}.`
})

watch(
  [selectedInfluencer, activeTab, selectedCampaignId],
  async ([influencer, tab]) => {
    const requestId = activeRequestId.value + 1
    activeRequestId.value = requestId

    if (!influencer?.id) {
      contentItems.value = []
      return
    }

    loadingContent.value = true
    try {
      const statuses = getStatusesForTab(tab)
      const campaignQuery = selectedCampaignId.value ? `&campaignId=${encodeURIComponent(selectedCampaignId.value)}` : ''
      const response = await $fetch(`/api/influencers/${influencer.id}/content?statuses=${statuses}${campaignQuery}`)
      if (activeRequestId.value === requestId) {
        contentItems.value = (response.contents || []).map((item) => normalizeItem(item, activeJobsByContentId.value))
      }
    } catch {
      if (activeRequestId.value === requestId) {
        contentItems.value = []
      }
    } finally {
      if (activeRequestId.value === requestId) {
        loadingContent.value = false
      }
    }
  },
  { immediate: true },
)

onMounted(() => {
  pollActiveJobsProgress()
  activeJobsTimer = window.setInterval(pollActiveJobsProgress, POLL_FAST_MS)
})

onBeforeUnmount(() => {
  if (activeJobsTimer) {
    window.clearInterval(activeJobsTimer)
  }
})

function getStatusesForTab(tab) {
  if (tab === 'ALL') return 'PENDING,PROCESSING,VALIDATED,PUBLISHED,REJECTED,FAILED'
  if (tab === 'PENDING') return 'PENDING,PROCESSING'
  return tab
}

async function pollActiveJobsProgress() {
  try {
    const jobs = await $fetch('/api/jobs/active')
    const nextMap = {}

    for (const job of jobs || []) {
      const contentId = String(job?.id || '').trim()
      if (!contentId) {
        continue
      }

      const rawProgress = typeof job?.progress === 'number' ? job.progress : Number(job?.progress || 0)
      nextMap[contentId] = Number.isFinite(rawProgress)
        ? Math.max(0, Math.min(100, Math.round(rawProgress)))
        : 0
    }

    activeJobsByContentId.value = nextMap
    contentItems.value = contentItems.value.map((item) => normalizeItem(item, nextMap))

    const targetInterval = Object.keys(nextMap).length > 0 ? POLL_FAST_MS : POLL_IDLE_MS
    if (targetInterval !== currentPollInterval && activeJobsTimer) {
      currentPollInterval = targetInterval
      window.clearInterval(activeJobsTimer)
      activeJobsTimer = window.setInterval(pollActiveJobsProgress, currentPollInterval)
    }
  } catch {
    // Ignore transient polling errors.
  }
}

function normalizeItem(item, progressMap = activeJobsByContentId.value) {
  return reactive({
    ...item,
    _progress: item.status === 'PROCESSING'
      ? Math.max(0, Math.min(100, Number(progressMap?.[item.id] ?? item._progress ?? 0)))
      : 100,
    _loading: false,
    _copied: false,
    _imageMissing: false,
  })
}

function isVideoMedia(item) {
  const format = String(item?.format || '').trim().toUpperCase()
  const imageUrl = String(item?.imageUrl || '').trim().toLowerCase()
  return format === 'STORY' || format === 'REEL' || imageUrl.endsWith('.mp4')
}

function markImageMissing(item) {
  item._imageMissing = true
}

function statusLabel(status) {
  if (status === 'VALIDATED') return 'Validé'
  if (status === 'PUBLISHED') return 'Publié'
  if (status === 'FAILED') return 'Erreur'
  if (status === 'PROCESSING') return 'En cours'
  return 'En attente'
}

function shortModelLabel(model) {
  const normalized = String(model || '').trim().toLowerCase()
  if (!normalized) return ''
  if (normalized.startsWith('gemini')) return 'Gemini'
  if (normalized.startsWith('veo')) return 'Veo'
  if (normalized.startsWith('kling')) return 'Kling'
  if (normalized.startsWith('seedance')) return 'Seedance'
  return model
}

function statusClass(status) {
  if (status === 'VALIDATED') return 'bg-[#E8873A]'
  if (status === 'PUBLISHED') return 'bg-emerald-600'
  if (status === 'FAILED') return 'bg-red-600'
  if (status === 'PROCESSING') return 'bg-[#8B5CF6]'
  return 'bg-[#111111]'
}

function canValidate(item) {
  return item.status === 'PENDING' || item.status === 'PROCESSING' || activeTab.value === 'PENDING'
}

function canModify(item) {
  return (isContentCreator.value || isBrand.value) && item.status === 'PENDING'
}

function modifyHref(item) {
  const studioPath = isBrand.value ? '/brand-studio' : '/studio'
  return `${studioPath}?edit=${item.id}`
}

function canPublish(item) {
  if (activeTab.value === 'VALIDATED') return true
  if (item.status === 'VALIDATED') return true
  return item.status === 'PUBLISHED' && !isInstagramPublished(item)
}

function canPublishTwitter(item) {
  if (activeTab.value === 'VALIDATED') return true
  if (item.status === 'VALIDATED') return true
  return item.status === 'PUBLISHED' && !isTwitterPublished(item)
}

function isInstagramPublished(item) {
  return Boolean(item?.publishedAt)
}

function isTwitterPublished(item) {
  return Boolean(item?.twitterPublishedAt)
}

async function openModal(item) {
  // Un carrousel s ouvre sur sa premiere slide, les autres restent atteignables
  // par les fleches. Un contenu simple n a qu une seule "slide": lui-meme.
  const slides = carouselSlidesOf(item)
  modalSlides.value = slides
  slideIndex.value = Math.max(0, slides.findIndex((slide) => slide.id === item?.id))

  await showContentInModal(item)
}

async function showContentInModal(item) {
  modalMedia.value = item?.imageUrl || null
  modalMediaIsVideo.value = isVideoMedia(item)
  modalContent.value = item
  modalVersions.value = []
  versionIndex.value = 0

  if (!item?.id) return

  try {
    const response = await $fetch(`/api/content/${item.id}/versions`)
    const versions = Array.isArray(response?.versions) ? response.versions : []
    // Ne garde que les versions reellement affichables.
    modalVersions.value = versions.filter((version) => String(version?.imageUrl || '').trim())

    const activeIndex = modalVersions.value.findIndex((version) => version.isActive)
    versionIndex.value = activeIndex >= 0 ? activeIndex : 0

    if (modalVersions.value.length) {
      applyVersionToModal(versionIndex.value)
    }
  } catch {
    // Historique indisponible: la modale reste utilisable en simple apercu.
  }
}

async function goToSlide(index) {
  const slide = modalSlides.value[index]
  if (!slide || index === slideIndex.value) return

  slideIndex.value = index
  await showContentInModal(slide)
}

function closeModal() {
  modalSlides.value = []
  slideIndex.value = 0
  modalMedia.value = null
  modalContent.value = null
  modalVersions.value = []
  versionIndex.value = 0
}

function applyVersionToModal(index) {
  const version = modalVersions.value[index]
  if (!version) return

  modalMedia.value = version.imageUrl
  modalMediaIsVideo.value = String(version.imageUrl || '').toLowerCase().endsWith('.mp4')
    || isVideoMedia(modalContent.value)
}

function goToVersion(index) {
  if (index < 0 || index >= modalVersions.value.length) return
  versionIndex.value = index
  applyVersionToModal(index)
}

async function restoreVersion() {
  const version = currentVersion.value
  const contentId = modalContent.value?.id

  if (!version || !contentId || restoringVersion.value) return

  restoringVersion.value = true
  try {
    await $fetch(`/api/content/${contentId}/restore-version`, {
      method: 'POST',
      body: { versionId: version.id },
    })

    modalVersions.value = modalVersions.value.map((item) => ({
      ...item,
      isActive: item.id === version.id,
    }))

    pushToast({
      title: 'Version restaurée',
      message: 'Ce rendu redevient la version courante du contenu.',
      tone: 'success',
    })

    await reloadContents()
  } catch (err) {
    pushToast({
      title: 'Restauration impossible',
      message: err?.data?.statusMessage || err?.message || 'La version n a pas pu être restaurée.',
      tone: 'error',
      duration: 4500,
    })
  } finally {
    restoringVersion.value = false
  }
}

function timeAgo(dateValue) {
  const diff = Date.now() - new Date(dateValue).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'À l’instant'
  if (mins < 60) return `Il y a ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `Il y a ${hours} h`
  return `Il y a ${Math.floor(hours / 24)} j`
}

async function copyCaption(item) {
  try {
    await navigator.clipboard.writeText(item.caption)
    item._copied = true
    setTimeout(() => {
      item._copied = false
    }, 2000)
  } catch {
    // ignore clipboard errors
  }
}

async function validate(item) {
  item._loading = true
  try {
    await $fetch(`/api/content/${item.id}/validate`, { method: 'PATCH' })
    await reloadContents()
  } finally {
    item._loading = false
  }
}

async function remove(item) {
  item._loading = true
  try {
    await $fetch(`/api/content/${item.id}`, { method: 'DELETE' })
    await reloadContents()
  } finally {
    item._loading = false
  }
}

async function publish(item) {
  item._loading = true
  try {
    await $fetch(`/api/content/${item.id}/publish`, { method: 'POST' })
    pushToast({
      title: 'Publication Instagram lancée',
      message: 'Le contenu a été publié sur Instagram.',
      tone: 'success',
    })
    await reloadContents()
  } finally {
    item._loading = false
  }
}

function extractHttpErrorDetails(err) {
  const statusCode = Number(err?.statusCode || err?.response?.status || err?.data?.statusCode || 0)
  const statusMessage = String(err?.statusMessage || err?.data?.statusMessage || err?.data?.message || err?.message || '')
  return { statusCode, statusMessage }
}

async function connectTwitter() {
  const influencerId = selectedInfluencer.value?.id
  if (!influencerId || twitterConnecting.value) {
    return
  }

  twitterConnecting.value = true
  try {
    const response = await $fetch(`/api/influencers/${influencerId}/twitter-connect`, { method: 'POST' })
    const username = String(response?.username || '').trim()

    pushToast({
      title: 'Twitter connecté',
      message: username
        ? `Compte @${username} prêt pour la publication.`
        : 'Compte connecté, publication prête.',
      tone: 'success',
    })
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

async function publishTwitter(item) {
  item._loading = true
  try {
    await $fetch(`/api/content/${item.id}/publish-twitter`, { method: 'POST' })

    pushToast({
      title: 'Publication X réussie',
      message: 'Le contenu a été publié sur X.',
      tone: 'success',
    })

    await reloadContents()
  } catch (err) {
    const { statusCode, statusMessage } = extractHttpErrorDetails(err)

    if (statusCode === 401 || statusMessage.includes('Session expirée')) {
      pushToast({
        title: 'Session expirée',
        message: 'Session expirée — reconnectez votre compte',
        tone: 'error',
        duration: 8000,
        actionLabel: 'Reconnecter',
        actionCallback: () => {
          connectTwitter()
        },
      })
      return
    }

    pushToast({
      title: 'Publication X impossible',
      message: statusMessage || 'La publication a échoué.',
      tone: 'error',
      duration: 6000,
    })
  } finally {
    item._loading = false
  }
}

async function reloadContents() {
  if (selectedInfluencer.value?.id) {
    const statuses = getStatusesForTab(activeTab.value)
    const campaignQuery = selectedCampaignId.value ? `&campaignId=${encodeURIComponent(selectedCampaignId.value)}` : ''
    const response = await $fetch(`/api/influencers/${selectedInfluencer.value.id}/content?statuses=${statuses}${campaignQuery}`)
    contentItems.value = (response.contents || []).map((item) => normalizeItem(item))
  }
}
</script>
