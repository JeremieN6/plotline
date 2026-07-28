<template>
  <div class="space-y-6">
    <header class="flex flex-col gap-4 rounded-[20px] border border-[#E5E3DF] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)] lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p class="text-xs font-semibold uppercase tracking-[0.22em] text-[#E8873A]">Contenu</p>
        <h1 class="mt-2 text-3xl font-bold tracking-tight text-[#111111]">{{ selectedInfluencer?.name || 'Contenu' }}</h1>
        <p class="mt-2 text-sm text-[#666666]">{{ selectedInfluencer ? 'Par défaut, la vue démarre sur tout puis se filtre par statut.' : 'Aucune influenceuse active pour le moment.' }}</p>
        <div v-if="selectedInfluencer" class="mt-3 flex flex-wrap items-center gap-2 text-sm text-[#666666]">
          <span v-if="selectedInfluencer.niche" class="rounded-full bg-[#FDE7D6] px-2.5 py-1 text-xs font-bold text-[#B45F1D]">{{ selectedInfluencer.niche }}</span>
          <span v-if="selectedInfluencer.style" class="rounded-full border border-[#E5E3DF] bg-[#FAFAF8] px-2.5 py-1 text-xs font-semibold text-[#111111]">{{ selectedInfluencer.style }}</span>
        </div>
      </div>

      <div class="flex flex-wrap gap-2">
        <NuxtLink
          v-if="selectedInfluencer"
          :to="`/influencers/${selectedInfluencer.id}/edit`"
          class="rounded-[12px] border border-[#E5E3DF] bg-white px-4 py-2.5 text-sm font-bold text-[#111111] transition-colors duration-150 hover:bg-[#FAFAF8]"
        >
          Paramètres influenceuse
        </NuxtLink>
        <NuxtLink
          v-if="selectedInfluencer"
          :to="`/influencers/${selectedInfluencer.id}/generate`"
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
      <p class="text-base font-semibold text-[#111111]">Aucune influenceuse sélectionnée</p>
      <p class="mt-2 text-sm text-[#666666]">Crée une influenceuse ou sélectionne-en une depuis la sidebar.</p>
      <NuxtLink to="/influencers/new" class="mt-5 inline-flex rounded-[12px] bg-[#E8873A] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#d4762f]">
        Nouvelle influenceuse
      </NuxtLink>
    </div>

    <div v-else-if="!displayedContents.length" class="rounded-[20px] border border-dashed border-[#E5E3DF] bg-white px-6 py-16 text-center">
      <p class="text-base font-semibold text-[#111111]">{{ emptyStateLabel }}</p>
      <p class="mt-2 text-sm text-[#666666]">Cette influenceuse n’a pas encore de contenu dans cette catégorie.</p>
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
            <div class="flex h-full items-center justify-center p-5 text-sm text-[#666666]">Image indisponible sur ce poste.</div>
          </template>

          <template v-else>
            <div class="flex h-full items-center justify-center text-sm text-[#999999]">Pas d'image</div>
          </template>

          <div class="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/0 to-black/0 opacity-0 transition-opacity duration-150 group-hover:opacity-100" />
          <div class="absolute left-3 right-3 top-3 flex items-start justify-between gap-2">
            <span class="rounded-full px-2.5 py-1 text-[11px] font-bold text-white" :class="statusClass(item.status)">{{ statusLabel(item.status) }}</span>
            <span class="rounded-full border border-white/30 bg-black/35 px-2.5 py-1 text-[11px] font-bold text-white">{{ item.format }}</span>
          </div>

          <div class="absolute inset-x-0 bottom-0 flex gap-2 p-3 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
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
            <span>{{ timeAgo(item.createdAt) }}</span>
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
      <div v-if="modalMedia" class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" @click.self="modalMedia = null">
        <button type="button" class="absolute right-4 top-4 rounded-full bg-white/20 px-3 py-2 text-sm font-bold text-white hover:bg-white/30" @click="modalMedia = null">✕</button>
        <video
          v-if="modalMediaIsVideo"
          :src="modalMedia"
          class="max-h-full max-w-full rounded-[20px] object-contain shadow-2xl"
          controls
          autoplay
          playsinline
        />
        <img v-else :src="modalMedia" class="max-h-full max-w-full rounded-[20px] object-contain shadow-2xl" alt="Aperçu" />
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'

const activeInfluencerId = useActiveInfluencer()
const { pushToast } = useUiFeedback()

const tabs = [
  { label: 'Tout', value: 'ALL' },
  { label: 'En attente', value: 'PENDING' },
  { label: 'Validé', value: 'VALIDATED' },
  { label: 'Publié', value: 'PUBLISHED' },
]

const activeTab = ref('ALL')
const loadingContent = ref(false)
const modalMedia = ref(null)
const modalMediaIsVideo = ref(false)
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

const influencers = computed(() => influencersData.value || [])
const selectedInfluencer = computed(() => {
  return influencers.value.find((item) => item.id === activeInfluencerId.value) || influencers.value[0] || null
})

const displayedContents = computed(() => contentItems.value)

const emptyStateLabel = computed(() => {
  if (activeTab.value === 'PENDING') return 'Aucun contenu en attente pour l’instant.'
  if (activeTab.value === 'VALIDATED') return 'Aucun contenu validé pour l’instant.'
  if (activeTab.value === 'PUBLISHED') return 'Aucun contenu publié pour l’instant.'
  return 'Aucun contenu trouvé pour cette influenceuse.'
})

watch(
  [selectedInfluencer, activeTab],
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
      const response = await $fetch(`/api/influencers/${influencer.id}/content?statuses=${statuses}`)
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

function openModal(item) {
  modalMedia.value = item?.imageUrl || null
  modalMediaIsVideo.value = isVideoMedia(item)
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
    const response = await $fetch(`/api/influencers/${selectedInfluencer.value.id}/content?statuses=${statuses}`)
    contentItems.value = (response.contents || []).map((item) => normalizeItem(item))
  }
}
</script>
