<template>
  <div class="space-y-6 font-ui" :class="selectedIds.size ? 'pb-24' : ''">
    <header class="flex flex-col gap-4 rounded-ui-card border border-ui-line bg-ui-surface p-5 shadow-sm lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p class="text-xs font-semibold uppercase tracking-[0.08em] text-ui-accent">Contenu</p>
        <h1 class="mt-2 text-2xl font-bold tracking-tight text-ui-ink">{{ selectedInfluencer?.name || 'Contenu' }}</h1>
        <p v-if="!selectedInfluencer" class="mt-2 text-sm text-ui-ink-muted">Aucune {{ wording.ambassador }} active pour le moment.</p>
        <div v-if="selectedInfluencer && headerChips.length" class="mt-3 flex flex-wrap items-center gap-2">
          <span
            v-for="chip in headerChips"
            :key="`chip-${chip}`"
            class="rounded-full bg-ui-subtle px-2.5 py-1 text-xs font-semibold text-ui-ink-2"
          >
            {{ chip }}
          </span>
        </div>
      </div>

      <div class="flex flex-wrap gap-2">
        <NuxtLink
          v-if="selectedInfluencer"
          :to="generateHref"
          class="inline-flex h-11 items-center justify-center rounded-ui-ctl bg-ui-accent px-4 text-sm font-semibold text-white transition-colors hover:bg-ui-accent-hover focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ui-accent/20"
        >
          Générer
        </NuxtLink>
      </div>
    </header>

    <ContentPublicationFailures
      :items="failures"
      @manual="manualFromFailure"
      @reschedule="rescheduleFromFailure"
      @keep="recoverFailed"
      @remove="softDelete"
    />

    <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <UiSegmented v-model="activeTab" :options="tabOptions" label="Statut" class="lg:min-w-[440px]" />
      <div class="flex flex-wrap items-center gap-3">
        <UiToggleChips v-model="typeFilter" :options="typeOptions" label="Type de contenu" />
        <div class="w-40"><UiSelect v-model="sortOrder" :options="sortOptions" aria-label="Tri" /></div>
        <UiSegmented v-model="density" :options="densityOptions" label="Affichage" class="w-44" />
      </div>
    </div>

    <div v-if="isBrand" class="flex flex-col gap-3 rounded-ui-card border border-ui-line bg-ui-surface p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p class="text-sm font-semibold text-ui-ink">Filtrer par campagne</p>
        <p class="text-xs text-ui-ink-muted">Affiche uniquement les contenus liés à une campagne précise.</p>
      </div>
      <div class="flex items-center gap-2">
        <div class="min-w-[220px]">
          <UiSelect v-model="selectedCampaignId" :options="campaignOptions" aria-label="Campagne" />
        </div>
        <UiButton size="sm" @click="selectedCampaignId = ''">Réinitialiser</UiButton>
      </div>
    </div>

    <div v-if="loadingMeta || loadingContent" class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      <div v-for="n in 8" :key="n" class="overflow-hidden rounded-ui-card border border-ui-line bg-ui-surface shadow-sm">
        <div class="aspect-[9/16] animate-pulse bg-ui-subtle" />
        <div class="space-y-2 p-3">
          <div class="h-3 w-1/3 animate-pulse rounded bg-ui-line" />
          <div class="h-3 w-full animate-pulse rounded bg-ui-line" />
          <div class="h-3 w-4/5 animate-pulse rounded bg-ui-line" />
        </div>
      </div>
    </div>

    <UiEmptyState
      v-else-if="!selectedInfluencer"
      :title="`Aucune ${wording.ambassador} sélectionnée`"
      :text="`Crée une ${wording.ambassador} ou sélectionne-en une depuis la sidebar.`"
    >
      <template #action>
        <NuxtLink to="/profiles/new" class="inline-flex h-11 items-center rounded-ui-ctl bg-ui-accent px-4 text-sm font-semibold text-white hover:bg-ui-accent-hover">
          Nouvelle {{ wording.ambassador }}
        </NuxtLink>
      </template>
    </UiEmptyState>

    <UiEmptyState v-else-if="!visibleContents.length" :title="emptyStateLabel" :text="emptyStateText">
      <template #action>
        <NuxtLink :to="generateHref" class="inline-flex h-11 items-center rounded-ui-ctl bg-ui-accent px-4 text-sm font-semibold text-white hover:bg-ui-accent-hover">
          Générer
        </NuxtLink>
      </template>
    </UiEmptyState>

    <div v-else :class="density === 'list' ? 'space-y-2' : 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'">
      <ContentCard
        v-for="item in visibleContents"
        :key="item.id"
        :item="item"
        :profile="selectedInfluencer"
        :view="density"
        :selected="selectedIds.has(item.id)"
        :selection-active="selectedIds.size > 0"
        :can-edit="canModify(item)"
        :edit-href="modifyHref(item)"
        :slide-count="carouselSlidesOf(item).length"
        :progress="item._progress"
        @open="openDetail"
        @validate="validate"
        @reject="reject"
        @publish="askPublish"
        @schedule="askSchedule"
        @toggle-select="toggleSelect"
        @menu="onCardMenu"
      />
    </div>

    <!-- Barre d'actions de la selection multiple. -->
    <div
      v-if="selectedIds.size"
      class="fixed bottom-4 left-1/2 z-40 w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 rounded-ui-card border border-ui-line bg-ui-surface px-4 py-3 shadow-lg"
      role="region"
      aria-label="Actions sur la sélection"
    >
      <div class="flex flex-wrap items-center gap-2">
        <p class="mr-auto text-sm font-semibold text-ui-ink" aria-live="polite">{{ selectedIds.size }} sélectionné{{ selectedIds.size > 1 ? 's' : '' }}</p>
        <UiButton variant="primary" size="sm" :disabled="!selectedPendingCount" @click="validateSelected">
          Valider{{ selectedPendingCount ? ` (${selectedPendingCount})` : '' }}
        </UiButton>
        <UiButton variant="danger" size="sm" @click="deleteSelected">Supprimer</UiButton>
        <UiButton variant="ghost" size="sm" @click="selectedIds = new Set()">Annuler la sélection</UiButton>
      </div>
    </div>

    <ContentDetailDrawer
      :open="Boolean(detailItem)"
      :item="detailItem"
      :profile="selectedInfluencer"
      :has-prev="detailIndex > 0"
      :has-next="detailIndex >= 0 && detailIndex < visibleContents.length - 1"
      @close="detailId = ''"
      @navigate="navigateDetail"
      @validate="validate"
      @reject="reject"
      @publish="askPublish"
      @schedule="askSchedule"
      @fullscreen="openFullscreen"
    />

    <ContentPublishDialog
      :open="publishDialog.open"
      :loading="publishDialog.loading"
      :platform-label="publishDialog.platform === 'X' ? 'X' : 'Instagram'"
      :caption="publishDialog.item?.caption || ''"
      :error="publishDialog.error"
      @confirm="confirmPublish"
      @cancel="publishDialog.open = false"
    />

    <ContentScheduleDialog
      :open="scheduleDialog.open"
      :loading="scheduleDialog.loading"
      :initial="scheduleDialog.item?.scheduledAt || ''"
      :initial-auto="scheduleDialog.item?.autoPublish === true"
      :error="scheduleDialog.error"
      :block-reason="scheduleBlockReason"
      :network="scheduleDialog.item ? autoPublishNetwork(scheduleDialog.item) : ''"
      :settings-href="selectedInfluencer ? `/profiles/${selectedInfluencer.id}/edit` : ''"
      @confirm="confirmSchedule"
      @cancel="scheduleDialog.open = false"
    />

    <ContentManualPublishDialog
      :open="manualDialog.open"
      :loading="manualDialog.loading"
      @confirm="confirmManualPublish"
      @cancel="manualDialog.open = false"
    />

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
              :class="index === slideIndex ? 'w-6 bg-ui-accent' : 'w-2 bg-white/40 hover:bg-white/70'"
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
              :class="index === versionIndex ? 'w-5 bg-ui-surface' : 'bg-white/40 hover:bg-white/70'"
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
            class="rounded-full bg-ui-success/40 px-2.5 py-1 text-[11px] font-bold text-white"
          >
            Version actuelle
          </span>
          <button
            v-else
            type="button"
            class="rounded-[10px] bg-ui-accent px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-ui-accent-hover disabled:opacity-60"
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
import { formatShortDate } from '~/utils/formatDate'
import { formatPlatforms, readManualPublication } from '~/utils/manualPlatforms'
import { autoPublishBlockReason, autoPublishNetwork, cardStateOf, countByTab, filterAndSort, isPublicationFailure } from '~/utils/contentCards'

const activeInfluencerId = useActiveInfluencer()
const { pushToast, requestConfirmation } = useUiFeedback()
const { wording, accountType } = useWording()
// Rendu serveur: un $fetch brut n envoie pas le cookie de session.
const requestFetch = useRequestFetch()
const isContentCreator = computed(() => accountType.value === 'CONTENT_CREATOR')
const isBrand = computed(() => accountType.value === 'BRAND')

// ---- Filtres, tri, densite --------------------------------------------------------------------------------------
const activeTab = ref('ALL')
const typeFilter = ref([])
const sortOrder = ref('recent')
const density = ref('grid')
const selectedCampaignId = ref('')

const typeOptions = [
  { value: 'feed', label: 'Feed' },
  { value: 'reel', label: 'Reel' },
  { value: 'story', label: 'Story' },
]
const sortOptions = [
  { value: 'recent', label: 'Plus récent' },
  { value: 'oldest', label: 'Plus ancien' },
]
const densityOptions = [
  { value: 'grid', label: 'Grille' },
  { value: 'list', label: 'Liste' },
]

const DENSITY_KEY = 'plotline-content-density'
onMounted(() => {
  try {
    const saved = window.localStorage.getItem(DENSITY_KEY)
    if (saved === 'grid' || saved === 'list') density.value = saved
  } catch {
    // Stockage indisponible : on garde la grille.
  }
})
watch(density, (value) => {
  try {
    window.localStorage.setItem(DENSITY_KEY, value)
  } catch {
    // ignore
  }
})

// ---- Donnees ----------------------------------------------------------------------------------------------------
const loadingContent = ref(false)
const contentItems = ref([])
const twitterConnecting = ref(false)
const POLL_FAST_MS = 15_000
const POLL_IDLE_MS = 60_000
const activeRequestId = ref(0)
const activeJobsByContentId = ref({})
let activeJobsTimer = null
let currentPollInterval = POLL_FAST_MS

const { data: influencersData, pending: loadingMeta } = await useFetch('/api/profiles', {
  key: 'plotline-content-influencers',
})

const { data: campaignsData } = await useFetch('/api/campaigns', {
  key: 'plotline-content-campaigns',
})

const influencers = computed(() => influencersData.value || [])
const campaigns = computed(() => Array.isArray(campaignsData.value) ? campaignsData.value : [])
const campaignOptions = computed(() => [{ value: '', label: 'Toutes les campagnes' }, ...campaigns.value.map((campaign) => ({ value: campaign.id, label: campaign.name }))])
const selectedInfluencer = computed(() => {
  return influencers.value.find((item) => item.id === activeInfluencerId.value) || influencers.value[0] || null
})

const headerChips = computed(() => [...splitNiches(selectedInfluencer.value?.niche), ...splitNiches(selectedInfluencer.value?.style)])

// Le Workflow Pinterest (/profiles/[id]/generate) est reserve au compte influenceur ; marque et createur ont leur studio.
const generateHref = computed(() => {
  if (isContentCreator.value) return '/studio'
  if (isBrand.value) return '/brand-studio'
  return selectedInfluencer.value ? `/profiles/${selectedInfluencer.value.id}/generate` : '/profiles'
})

// Un carrousel occupe une seule carte (sa premiere slide) ; les autres restent atteignables dans la visionneuse.
// Les contenus supprimes en attente d annulation (8 s) sont masques tout de suite.
const hiddenIds = ref(new Set())
const cards = computed(() => {
  const shown = []
  const seenCarousels = new Set()

  for (const item of contentItems.value) {
    const carouselId = String(item?.carouselId || '').trim()

    if (!carouselId) {
      if (!hiddenIds.value.has(item.id)) shown.push(item)
      continue
    }

    if (seenCarousels.has(carouselId)) continue
    seenCarousels.add(carouselId)

    const slides = carouselSlidesOf(item)
    const cover = slides[0] || item
    if (!hiddenIds.value.has(cover.id)) shown.push(cover)
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

const counts = computed(() => countByTab(cards.value))
const tabOptions = computed(() => [
  { value: 'ALL', label: `Tout ${counts.value.ALL}` },
  { value: 'PENDING', label: `En attente ${counts.value.PENDING}` },
  { value: 'VALIDATED', label: `Validé ${counts.value.VALIDATED}` },
  { value: 'PUBLISHED', label: `Publié ${counts.value.PUBLISHED}` },
])
const visibleContents = computed(() => filterAndSort(cards.value, { tab: activeTab.value, types: typeFilter.value, sort: sortOrder.value }))

const emptyStateLabel = computed(() => {
  if (typeFilter.value.length && cards.value.length) return 'Aucun contenu de ce type ici.'
  if (activeTab.value === 'PENDING') return 'Rien en attente.'
  if (activeTab.value === 'VALIDATED') return 'Aucun contenu validé.'
  if (activeTab.value === 'PUBLISHED') return 'Aucun contenu publié.'
  return `Aucun contenu pour cette ${wording.value.ambassador}.`
})
const emptyStateText = computed(() => (typeFilter.value.length && cards.value.length ? 'Décoche un type pour tout afficher.' : 'Génère de nouveaux contenus.'))

// Une seule requete : tous les statuts, filtres et compteurs se calculent cote page.
const ALL_STATUSES = 'PENDING,PROCESSING,VALIDATED,PUBLISHED,REJECTED,FAILED'

watch(
  [selectedInfluencer, selectedCampaignId],
  async ([influencer]) => {
    const requestId = activeRequestId.value + 1
    activeRequestId.value = requestId

    if (!influencer?.id) {
      contentItems.value = []
      return
    }

    loadingContent.value = true
    try {
      const campaignQuery = selectedCampaignId.value ? `&campaignId=${encodeURIComponent(selectedCampaignId.value)}` : ''
      const response = await requestFetch(`/api/profiles/${influencer.id}/content?statuses=${ALL_STATUSES}${campaignQuery}`)
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
  })
}

async function reloadContents() {
  if (selectedInfluencer.value?.id) {
    const campaignQuery = selectedCampaignId.value ? `&campaignId=${encodeURIComponent(selectedCampaignId.value)}` : ''
    const response = await $fetch(`/api/profiles/${selectedInfluencer.value.id}/content?statuses=${ALL_STATUSES}${campaignQuery}`)
    contentItems.value = (response.contents || []).map((item) => normalizeItem(item))
    // La pastille du menu (publications ratees) suit les actions de cette page sans attendre un changement de page.
    refreshNuxtData('plotline-shell-publication-failures')
  }
}

function errorMessageOf(err, fallback) {
  return err?.data?.statusMessage || err?.statusMessage || err?.data?.message || fallback
}

// ---- Modification ---------------------------------------------------------------------------------------------
function canModify(item) {
  if (item.status !== 'PENDING') return false
  // La retouche d une video faceless est ouverte a tous les types de compte.
  if (item.generationModel === 'faceless') return true
  return isContentCreator.value || isBrand.value
}

function modifyHref(item) {
  // Une video faceless se retouche en langage naturel sur son propre ecran.
  if (item.generationModel === 'faceless') return `/studio/faceless?content=${item.id}`
  const studioPath = isBrand.value ? '/brand-studio' : '/studio'
  return `${studioPath}?edit=${item.id}`
}

// ---- Actions simples --------------------------------------------------------------------------------------------
async function runAction(item, request, { success, failure }) {
  item._loading = true
  try {
    await request()
    if (success) pushToast({ ...success, tone: 'success' })
    await reloadContents()
    return true
  } catch (err) {
    pushToast({ title: failure, message: errorMessageOf(err, 'L’action a échoué.'), tone: 'error', duration: 5000 })
    return false
  } finally {
    item._loading = false
  }
}

function validate(item) {
  return runAction(item, () => $fetch(`/api/content/${item.id}/validate`, { method: 'PATCH' }), { failure: 'Validation impossible' })
}

function reject(item) {
  return runAction(item, () => $fetch(`/api/content/${item.id}/reject`, { method: 'PATCH' }), {
    success: { title: 'Contenu rejeté', message: 'Il reste dans « Tout ». « Remettre en attente » le récupère.' },
    failure: 'Rejet impossible',
  })
}

function unvalidate(item) {
  return runAction(item, () => $fetch(`/api/content/${item.id}/unvalidate`, { method: 'PATCH' }), {
    success: { title: 'Remis en attente', message: 'Tu peux de nouveau le modifier.' },
    failure: 'Impossible de remettre en attente',
  })
}

function cancelSchedule(item) {
  return runAction(item, () => $fetch(`/api/content/${item.id}/schedule`, { method: 'DELETE' }), {
    success: { title: 'Programmation annulée', message: 'Le contenu reste validé, sans date de publication.' },
    failure: 'Impossible d’annuler la programmation',
  })
}

function recoverFailed(item) {
  return runAction(item, () => $fetch(`/api/content/${item.id}/recover`, { method: 'PATCH' }), {
    success: { title: 'Remis en « Validé »', message: 'La date de publication a été retirée : tu peux le publier ou le reprogrammer.' },
    failure: 'Impossible de remettre en « Validé »',
  })
}

// ---- Publications automatiques ratees (bandeau) ---------------------------------------------------------------
const failures = computed(() => (loadingContent.value ? [] : cards.value.filter(isPublicationFailure)))

// « Marquer comme publie » et « Planifier » ne marchent que sur un contenu valide : on le remet d abord en « Valide »
// (ce qui efface aussi la date et le message d erreur), puis on ouvre la fenetre voulue.
async function recoverThen(item, next) {
  if (item._loading) return
  item._loading = true
  let fresh = null
  try {
    await $fetch(`/api/content/${item.id}/recover`, { method: 'PATCH' })
    await reloadContents()
    fresh = contentItems.value.find((row) => row.id === item.id) || null
  } catch (err) {
    pushToast({ title: 'Action impossible', message: errorMessageOf(err, 'Le contenu n’a pas pu être remis en « Validé ».'), tone: 'error', duration: 5000 })
  } finally {
    item._loading = false
  }
  if (fresh) next(fresh)
}

const manualFromFailure = (item) => recoverThen(item, openManualPublish)
const rescheduleFromFailure = (item) => recoverThen(item, askSchedule)

async function onCardMenu(key, item) {
  if (key === 'recover') return recoverFailed(item)
  if (key === 'cancelSchedule') return cancelSchedule(item)
  if (key === 'markPublished') return openManualPublish(item)
  if (key === 'unvalidate') return unvalidate(item)
  if (key === 'cancelManual') return cancelManualPublish(item)
  if (key === 'delete') return softDelete(item)
}

// ---- Suppression douce : le contenu disparait, 8 s pour annuler, puis suppression reelle ------------------------
const UNDO_MS = 8000

function softDelete(item) {
  const targets = carouselSlidesOf(item).length > 1 ? carouselSlidesOf(item) : [item]
  const ids = targets.map((row) => row.id)
  hiddenIds.value = new Set([...hiddenIds.value, ...ids])
  if (detailId.value && ids.includes(detailId.value)) detailId.value = ''
  const next = new Set(selectedIds.value)
  ids.forEach((id) => next.delete(id))
  selectedIds.value = next

  let undone = false
  const timer = window.setTimeout(async () => {
    if (undone) return
    try {
      for (const id of ids) await $fetch(`/api/content/${id}`, { method: 'DELETE' })
    } catch (err) {
      pushToast({ title: 'Suppression impossible', message: errorMessageOf(err, 'Le contenu n’a pas pu être supprimé.'), tone: 'error', duration: 5000 })
    } finally {
      hiddenIds.value = new Set([...hiddenIds.value].filter((id) => !ids.includes(id)))
      await reloadContents()
    }
  }, UNDO_MS)

  pushToast({
    title: 'Contenu supprimé',
    message: ids.length > 1 ? `Le carrousel (${ids.length} slides) sera supprimé.` : '',
    tone: 'success',
    duration: UNDO_MS,
    actionLabel: 'Annuler',
    actionCallback: () => {
      undone = true
      window.clearTimeout(timer)
      hiddenIds.value = new Set([...hiddenIds.value].filter((id) => !ids.includes(id)))
    },
  })
}

// ---- Selection multiple -----------------------------------------------------------------------------------------
const selectedIds = ref(new Set())
const selectedItems = computed(() => cards.value.filter((item) => selectedIds.value.has(item.id)))
const selectedPendingCount = computed(() => selectedItems.value.filter((item) => cardStateOf(item) === 'pending').length)

function toggleSelect(item) {
  const next = new Set(selectedIds.value)
  if (next.has(item.id)) next.delete(item.id)
  else next.add(item.id)
  selectedIds.value = next
}

async function validateSelected() {
  const targets = selectedItems.value.filter((item) => cardStateOf(item) === 'pending')
  let done = 0
  for (const item of targets) {
    try {
      await $fetch(`/api/content/${item.id}/validate`, { method: 'PATCH' })
      done += 1
    } catch {
      // Les echecs sont comptes ci-dessous.
    }
  }
  selectedIds.value = new Set()
  await reloadContents()
  pushToast({
    title: done === targets.length ? 'Contenus validés' : 'Validation partielle',
    message: `${done} sur ${targets.length} validé${done > 1 ? 's' : ''}.`,
    tone: done === targets.length ? 'success' : 'error',
    duration: 4000,
  })
}

function deleteSelected() {
  // Une suppression douce par contenu : la derniere annulation visible ne couvre que la derniere, d ou une seule
  // annulation pour toute la selection.
  const targets = [...selectedItems.value]
  if (!targets.length) return
  const ids = targets.flatMap((item) => (carouselSlidesOf(item).length > 1 ? carouselSlidesOf(item) : [item]).map((row) => row.id))
  hiddenIds.value = new Set([...hiddenIds.value, ...ids])
  selectedIds.value = new Set()
  if (detailId.value && ids.includes(detailId.value)) detailId.value = ''

  let undone = false
  const timer = window.setTimeout(async () => {
    if (undone) return
    let failed = 0
    for (const id of ids) {
      try {
        await $fetch(`/api/content/${id}`, { method: 'DELETE' })
      } catch {
        failed += 1
      }
    }
    if (failed) pushToast({ title: 'Suppression partielle', message: `${failed} contenu${failed > 1 ? 's' : ''} n’a pas pu être supprimé.`, tone: 'error', duration: 5000 })
    hiddenIds.value = new Set([...hiddenIds.value].filter((id) => !ids.includes(id)))
    await reloadContents()
  }, UNDO_MS)

  pushToast({
    title: `${targets.length} contenu${targets.length > 1 ? 's' : ''} supprimé${targets.length > 1 ? 's' : ''}`,
    tone: 'success',
    duration: UNDO_MS,
    actionLabel: 'Annuler',
    actionCallback: () => {
      undone = true
      window.clearTimeout(timer)
      hiddenIds.value = new Set([...hiddenIds.value].filter((id) => !ids.includes(id)))
    },
  })
}

// ---- Panneau de detail ------------------------------------------------------------------------------------------
const detailId = ref('')
const detailItem = computed(() => visibleContents.value.find((item) => item.id === detailId.value) || null)
const detailIndex = computed(() => visibleContents.value.findIndex((item) => item.id === detailId.value))

function openDetail(item) {
  detailId.value = item.id
}

function navigateDetail(step) {
  const target = visibleContents.value[detailIndex.value + step]
  if (target) detailId.value = target.id
}

function openFullscreen(item) {
  detailId.value = ''
  openModal(item)
}

// ---- Publication (confirmation obligatoire) ----------------------------------------------------------------------
const publishDialog = reactive({ open: false, loading: false, item: null, platform: 'INSTAGRAM', error: '' })

function askPublish(item, platform) {
  publishDialog.item = item
  publishDialog.platform = platform === 'X' ? 'X' : 'INSTAGRAM'
  publishDialog.error = ''
  publishDialog.open = true
}

async function confirmPublish() {
  const item = publishDialog.item
  if (!item || publishDialog.loading) return
  publishDialog.loading = true
  publishDialog.error = ''
  const isX = publishDialog.platform === 'X'
  try {
    await $fetch(`/api/content/${item.id}/${isX ? 'publish-twitter' : 'publish'}`, { method: 'POST' })
    publishDialog.open = false
    pushToast({
      title: isX ? 'Publié sur X' : 'Publié sur Instagram',
      message: 'Le contenu a été publié.',
      tone: 'success',
    })
    await reloadContents()
  } catch (err) {
    const statusCode = Number(err?.statusCode || err?.response?.status || err?.data?.statusCode || 0)
    const message = errorMessageOf(err, 'La publication a échoué.')
    if (isX && (statusCode === 401 || message.includes('Session expirée'))) {
      publishDialog.error = 'Ta session X a expiré : reconnecte le compte, puis réessaie.'
      pushToast({
        title: 'Session X expirée',
        message: 'Reconnecte ton compte X.',
        tone: 'error',
        duration: 8000,
        actionLabel: 'Reconnecter',
        actionCallback: () => connectTwitter(),
      })
    } else {
      publishDialog.error = message
    }
  } finally {
    publishDialog.loading = false
  }
}

async function connectTwitter() {
  const influencerId = selectedInfluencer.value?.id
  if (!influencerId || twitterConnecting.value) {
    return
  }

  twitterConnecting.value = true
  try {
    const response = await $fetch(`/api/profiles/${influencerId}/twitter-connect`, { method: 'POST' })
    const username = String(response?.username || '').trim()

    pushToast({
      title: 'Twitter connecté',
      message: username
        ? `Compte @${username} prêt pour la publication.`
        : 'Compte connecté, publication prête.',
      tone: 'success',
    })
  } catch (err) {
    pushToast({
      title: 'Connexion Twitter impossible',
      message: errorMessageOf(err, 'La connexion n’a pas pu être finalisée.'),
      tone: 'error',
      duration: 6000,
    })
  } finally {
    twitterConnecting.value = false
  }
}

// ---- Planification ----------------------------------------------------------------------------------------------
const scheduleDialog = reactive({ open: false, loading: false, item: null, error: '' })
// Planifier est bloque quand la publication automatique echouerait forcement (Instagram non connecte, contenu TikTok).
const scheduleBlockReason = computed(() => (scheduleDialog.item ? autoPublishBlockReason(scheduleDialog.item, selectedInfluencer.value) : ''))

function askSchedule(item) {
  scheduleDialog.item = item
  scheduleDialog.error = ''
  scheduleDialog.open = true
}

async function confirmSchedule(iso, auto) {
  const item = scheduleDialog.item
  if (!item || scheduleDialog.loading) return
  scheduleDialog.loading = true
  scheduleDialog.error = ''
  try {
    await $fetch(`/api/content/${item.id}/schedule`, { method: 'PATCH', body: { scheduledAt: iso, autoPublish: auto === true } })
    scheduleDialog.open = false
    pushToast({
      title: auto ? 'Publication planifiée' : 'Contenu placé au calendrier',
      message: auto ? `Prévue le ${formatShortDate(iso)}. Elle apparaît au calendrier.` : `Prévu le ${formatShortDate(iso)}. Rien ne sera publié automatiquement.`,
      tone: 'success',
    })
    await reloadContents()
  } catch (err) {
    scheduleDialog.error = errorMessageOf(err, 'La planification a échoué.')
  } finally {
    scheduleDialog.loading = false
  }
}

// ---- Contenu poste a la main (hors de l outil) ------------------------------------------------------------------
const manualDialog = reactive({ open: false, loading: false, item: null })

function openManualPublish(item) {
  manualDialog.item = item
  manualDialog.open = true
}

async function confirmManualPublish(payload) {
  const item = manualDialog.item
  if (!item || manualDialog.loading) return
  manualDialog.loading = true
  try {
    await $fetch(`/api/content/${item.id}/manual-publish`, { method: 'POST', body: payload })
    manualDialog.open = false
    pushToast({
      title: 'Marqué comme publié',
      message: `Publié sur ${formatPlatforms(payload.platforms)} le ${formatShortDate(payload.publishedAt)}. Il apparaît au calendrier à cette date.`,
      tone: 'success',
    })
    await reloadContents()
  } catch (err) {
    pushToast({
      title: 'Enregistrement impossible',
      message: errorMessageOf(err, 'La publication n’a pas pu être enregistrée.'),
      tone: 'error',
      duration: 5000,
    })
  } finally {
    manualDialog.loading = false
  }
}

async function cancelManualPublish(item) {
  const confirmed = await requestConfirmation({
    title: 'Annuler la publication manuelle ?',
    message: 'Le contenu redevient « Validé » et disparaît du calendrier. Ça ne supprime rien sur la plateforme où tu l’as posté.',
    confirmLabel: 'Annuler la publication',
    cancelLabel: 'Garder',
  })
  if (!confirmed) return
  await runAction(item, () => $fetch(`/api/content/${item.id}/manual-publish`, { method: 'DELETE' }), {
    success: { title: 'Publication annulée', message: 'Le contenu est de nouveau « Validé ».' },
    failure: 'Annulation impossible',
  })
}

// ---- Visionneuse plein ecran (versions, slides) -----------------------------------------------------------------
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

function isVideoMedia(item) {
  const format = String(item?.format || '').trim().toUpperCase()
  const imageUrl = String(item?.imageUrl || '').trim().toLowerCase()
  return format === 'STORY' || format === 'REEL' || imageUrl.endsWith('.mp4')
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

async function openModal(item) {
  // Un carrousel s ouvre sur sa premiere slide, les autres restent atteignables par les fleches.
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
    // Historique indisponible: la visionneuse reste utilisable en simple apercu.
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
      message: errorMessageOf(err, 'La version n’a pas pu être restaurée.'),
      tone: 'error',
      duration: 4500,
    })
  } finally {
    restoringVersion.value = false
  }
}
</script>
