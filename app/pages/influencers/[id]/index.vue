<template>
  <div class="min-h-screen bg-[#FAFAF8] p-7 font-sans">
    <div class="mx-auto max-w-5xl">
      <div v-if="loadingInfluencer" class="mb-6 flex items-center justify-between gap-4">
        <div class="flex items-center gap-3">
          <div class="h-8 w-40 animate-pulse rounded bg-gray-200"></div>
          <div class="h-6 w-20 animate-pulse rounded-full bg-gray-200"></div>
          <div class="h-6 w-20 animate-pulse rounded-full bg-gray-200"></div>
        </div>
        <div class="flex gap-2">
          <div class="h-9 w-44 animate-pulse rounded-lg bg-gray-200"></div>
          <div class="h-9 w-44 animate-pulse rounded-lg bg-gray-200"></div>
        </div>
      </div>

      <div v-else-if="influencer" class="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div class="flex flex-wrap items-center gap-3">
          <h1 class="text-2xl font-bold text-gray-900">{{ influencer.name }}</h1>
          <span v-if="influencer.niche" class="rounded-full bg-orange-50 px-2.5 py-0.5 text-xs font-bold text-[#E8873A]">{{ influencer.niche }}</span>
          <span v-if="influencer.style" class="rounded-full border border-[#E5E3DF] bg-white px-2.5 py-0.5 text-xs font-semibold text-gray-600">{{ influencer.style }}</span>
        </div>

        <div class="flex flex-wrap gap-2">
          <button
            class="rounded-lg border border-[#E5E3DF] bg-white px-4 py-2 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-50"
            @click="openInstagramModal"
          >
            ⚙️ Configurer Instagram
          </button>
          <button
            class="rounded-lg bg-[#E8873A] px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-[#d4762f]"
            @click="router.push(`/influencers/${route.params.id}/generate`)"
          >
            Nouvelle génération
          </button>
        </div>
      </div>

      <div v-else-if="fetchError" class="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        Impossible de charger les informations de cette influenceuse. {{ fetchError?.data?.message || fetchError?.message || '' }}
      </div>

      <div class="mb-5 flex w-fit gap-1 rounded-xl border border-[#E5E3DF] bg-white p-1">
        <button
          v-for="tab in tabs"
          :key="tab.value"
          type="button"
          class="rounded-lg px-4 py-2 text-sm font-semibold transition-colors"
          :class="activeTab === tab.value ? 'bg-[#E8873A] text-white' : 'text-gray-600 hover:bg-gray-50'"
          @click="switchTab(tab.value)"
        >
          {{ tab.label }}
        </button>
      </div>

      <div v-if="loadingContent" class="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div v-for="n in 4" :key="n" class="overflow-hidden rounded-xl border border-[#E5E3DF] bg-white shadow-sm">
          <div class="aspect-square animate-pulse bg-gray-200"></div>
          <div class="space-y-2 p-4">
            <div class="h-3 w-1/3 animate-pulse rounded bg-gray-200"></div>
            <div class="h-3 w-full animate-pulse rounded bg-gray-200"></div>
            <div class="h-3 w-4/5 animate-pulse rounded bg-gray-200"></div>
          </div>
        </div>
      </div>

      <div v-else-if="!loadingContent && displayedContents.length === 0" class="flex flex-col items-center gap-3 py-20 text-center">
        <p class="text-base text-gray-500">
          <template v-if="activeTab === 'PENDING'">Aucun contenu en attente — lance une génération.</template>
          <template v-else>Aucun contenu publié pour l'instant.</template>
        </p>
        <button
          v-if="activeTab === 'PENDING'"
          class="rounded-lg bg-[#E8873A] px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-[#d4762f]"
          @click="router.push(`/influencers/${route.params.id}/generate`)"
        >
          Lancer une génération
        </button>
      </div>

      <div v-else class="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div
          v-for="item in displayedContents"
          :key="item.id"
          class="overflow-hidden rounded-xl border shadow-sm transition-shadow hover:shadow-md"
          :class="item.status === 'FAILED'
            ? 'border-red-200 bg-red-50'
            : item.status === 'VALIDATED' && activeTab === 'PENDING'
              ? 'border-blue-200 bg-blue-50/40'
              : 'border-[#E5E3DF] bg-white'"
        >
          <div class="relative aspect-square overflow-hidden bg-gray-100">
            <template v-if="item.status === 'PROCESSING'">
              <div class="absolute inset-0 animate-pulse bg-gray-200"></div>
              <div class="absolute inset-0 flex items-center justify-center">
                <span class="text-sm font-semibold text-gray-500">Génération en cours...</span>
              </div>
            </template>

            <template v-else-if="item.status === 'FAILED'">
              <div class="flex h-full items-center justify-center p-4">
                <p class="text-center text-sm text-red-600">{{ item.errorMessage || 'Échec de la génération' }}</p>
              </div>
            </template>

            <template v-else-if="item.imageUrl">
              <img
                :src="item.imageUrl"
                :alt="`Contenu ${item.format}`"
                class="h-full w-full cursor-pointer object-cover transition-transform hover:scale-105"
                @click="openModal(item.imageUrl)"
              />
            </template>

            <template v-else>
              <div class="flex h-full items-center justify-center text-sm text-gray-400">Pas d'image</div>
            </template>
          </div>

          <div class="p-4">
            <div class="mb-3 flex flex-wrap items-center gap-2">
              <span class="rounded-full border border-[#E5E3DF] px-2.5 py-0.5 text-xs font-bold uppercase text-gray-700">{{ item.format }}</span>
              <span class="rounded-full border border-[#E5E3DF] px-2.5 py-0.5 text-xs font-semibold text-gray-600">{{ item.platform }}</span>
              <span v-if="item.status === 'VALIDATED' && activeTab === 'PENDING'" class="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-700">Prêt à publier</span>
              <span v-if="item.status === 'PUBLISHED'" class="rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-bold text-green-700">Publié</span>
            </div>

            <p v-if="item.caption" class="mb-3 line-clamp-4 text-sm leading-relaxed text-gray-700">{{ item.caption }}</p>

            <button
              v-if="item.caption"
              type="button"
              class="mb-3 text-xs font-semibold text-[#E8873A] hover:underline"
              @click="copyCaption(item)"
            >
              {{ item._copied ? 'Copié !' : 'Copier' }}
            </button>

            <p class="mb-3 text-xs text-gray-400">
              <template v-if="item.status === 'PUBLISHED' && item.publishedAt">Publié {{ timeAgo(item.publishedAt) }}</template>
              <template v-else>Généré {{ timeAgo(item.createdAt) }}</template>
            </p>

            <div v-if="activeTab === 'PENDING' && item.status === 'VALIDATED'" class="flex gap-2">
              <button
                type="button"
                class="flex-1 rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 transition-colors hover:bg-blue-100 disabled:opacity-50"
                :disabled="item._loading"
                @click="publish(item)"
              >
                📤 Publier sur Instagram
              </button>
            </div>

            <div v-if="activeTab === 'PENDING' && item.status !== 'PROCESSING' && item.status !== 'FAILED' && item.status !== 'VALIDATED'" class="flex gap-2">
              <button
                type="button"
                class="flex-1 rounded-lg border border-green-300 bg-green-50 px-3 py-2 text-xs font-bold text-green-700 transition-colors hover:bg-green-100 disabled:opacity-50"
                :disabled="item._loading"
                @click="validate(item)"
              >
                ✓ Valider
              </button>
              <button
                type="button"
                class="flex-1 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-600 transition-colors hover:bg-red-100 disabled:opacity-50"
                :disabled="item._loading"
                @click="remove(item)"
              >
                ✗ Supprimer
              </button>
            </div>

            <div v-if="activeTab === 'PENDING' && item.status === 'FAILED'" class="flex gap-2">
              <button
                type="button"
                class="flex-1 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-600 transition-colors hover:bg-red-100 disabled:opacity-50"
                :disabled="item._loading"
                @click="remove(item)"
              >
                ✗ Supprimer
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <div v-if="modalImage" class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" @click.self="modalImage = null">
        <button type="button" class="absolute right-4 top-4 rounded-full bg-white/20 p-2 text-white hover:bg-white/30" @click="modalImage = null">✕</button>
        <img :src="modalImage" class="max-h-full max-w-full rounded-xl object-contain shadow-2xl" alt="Aperçu" />
      </div>
    </Teleport>

    <Teleport to="body">
      <div v-if="instagramModalOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" @click.self="closeInstagramModal">
        <div class="w-full max-w-lg rounded-2xl border border-[#E5E3DF] bg-white p-6 shadow-2xl">
          <div class="mb-5 flex items-start justify-between gap-4">
            <div>
              <p class="text-sm font-semibold uppercase tracking-[0.18em] text-[#E8873A]">Instagram</p>
              <h2 class="mt-2 text-xl font-bold text-gray-900">Configurer les credentials</h2>
            </div>
            <button type="button" class="rounded-full border border-[#E5E3DF] bg-white px-3 py-1 text-sm font-semibold text-gray-600 hover:bg-gray-50" @click="closeInstagramModal">✕</button>
          </div>

          <div class="space-y-4">
            <div>
              <label class="mb-1.5 block text-sm font-semibold text-gray-800">Account ID</label>
              <input
                v-model="instagramForm.instagramAccountId"
                type="text"
                class="w-full rounded-xl border border-[#E5E3DF] px-3 py-3 text-sm focus:border-[#E8873A] focus:outline-none"
                placeholder="17841400000000000"
              />
            </div>
            <div>
              <label class="mb-1.5 block text-sm font-semibold text-gray-800">Access Token</label>
              <textarea
                v-model="instagramForm.instagramAccessToken"
                rows="4"
                class="w-full rounded-xl border border-[#E5E3DF] px-3 py-3 text-sm focus:border-[#E8873A] focus:outline-none"
                placeholder="EAAG..."
              ></textarea>
            </div>
          </div>

          <div class="mt-6 flex justify-end gap-2">
            <button type="button" class="rounded-lg border border-[#E5E3DF] bg-white px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50" @click="closeInstagramModal">Annuler</button>
            <button
              type="button"
              class="rounded-lg bg-[#E8873A] px-4 py-2 text-sm font-bold text-white hover:bg-[#d4762f] disabled:opacity-50"
              :disabled="savingInstagram"
              @click="saveInstagramCredentials"
            >
              {{ savingInstagram ? 'Sauvegarde...' : 'Sauvegarder' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
const { pushToast } = useUiFeedback()

const tabs = [
  { label: 'En attente', value: 'PENDING' },
  { label: 'Publié', value: 'PUBLISHED' },
]

const activeTab = ref('PENDING')
const modalImage = ref(null)
const instagramModalOpen = ref(false)
const savingInstagram = ref(false)
const loadingContent = ref(false)

const contentByTab = reactive({
  PENDING: [],
  PUBLISHED: [],
})

const loadedTabs = reactive({
  PENDING: false,
  PUBLISHED: false,
})

const instagramForm = reactive({
  instagramAccountId: '',
  instagramAccessToken: '',
})

const { data: influencer, pending: loadingInfluencer, error: fetchError, refresh: refreshInfluencer } = await useFetch(
  `/api/influencers/${route.params.id}`,
)

const displayedContents = computed(() => contentByTab[activeTab.value] || [])

function normalizeItem(item) {
  return reactive({
    ...item,
    _loading: false,
    _copied: false,
  })
}

async function loadContent(tab = activeTab.value) {
  loadingContent.value = true
  try {
    const statusQuery = tab === 'PENDING' ? 'PENDING,VALIDATED' : tab
    const data = await $fetch(`/api/influencers/${route.params.id}/content?statuses=${statusQuery}`)
    contentByTab[tab] = (data.contents || []).map((item) => normalizeItem(item))
    loadedTabs[tab] = true
  } catch {
    contentByTab[tab] = []
  } finally {
    loadingContent.value = false
  }
}

async function ensureTabLoaded(tab) {
  if (!loadedTabs[tab]) {
    await loadContent(tab)
  }
}

async function switchTab(tab) {
  activeTab.value = tab
  await ensureTabLoaded(tab)
}

await loadContent('PENDING')

function openModal(url) {
  modalImage.value = url
}

function openInstagramModal() {
  instagramForm.instagramAccountId = influencer.value?.instagramAccountId || ''
  instagramForm.instagramAccessToken = influencer.value?.instagramAccessToken || ''
  instagramModalOpen.value = true
}

function closeInstagramModal() {
  instagramModalOpen.value = false
}

async function saveInstagramCredentials() {
  savingInstagram.value = true
  try {
    await $fetch(`/api/influencers/${route.params.id}/instagram`, {
      method: 'PATCH',
      body: {
        instagramAccountId: instagramForm.instagramAccountId,
        instagramAccessToken: instagramForm.instagramAccessToken,
      },
    })

    pushToast?.({ type: 'success', title: 'Instagram', message: 'Credentials sauvegardés.' })
    await refreshInfluencer()
    closeInstagramModal()
  } catch {
    pushToast?.({ type: 'error', title: 'Instagram', message: 'Sauvegarde impossible.' })
  } finally {
    savingInstagram.value = false
  }
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "à l'instant"
  if (mins < 60) return `il y a ${mins}min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `il y a ${hours}h`
  const days = Math.floor(hours / 24)
  return `il y a ${days}j`
}

async function copyCaption(item) {
  try {
    await navigator.clipboard.writeText(item.caption)
    item._copied = true
    setTimeout(() => {
      item._copied = false
    }, 2000)
  } catch {}
}

async function validate(item) {
  item._loading = true
  try {
    await $fetch(`/api/content/${item.id}/validate`, { method: 'PATCH' })
    item.status = 'VALIDATED'
  } catch {
    item._loading = false
  }
}

async function remove(item) {
  item._loading = true
  try {
    await $fetch(`/api/content/${item.id}`, { method: 'DELETE' })
    const index = contentByTab.PENDING.findIndex((content) => content.id === item.id)
    if (index !== -1) contentByTab.PENDING.splice(index, 1)
  } catch {
    item._loading = false
  }
}

async function publish(item) {
  item._loading = true
  try {
    const response = await $fetch(`/api/content/${item.id}/publish`, { method: 'POST' })
    const pendingIndex = contentByTab.PENDING.findIndex((content) => content.id === item.id)
    if (pendingIndex !== -1) contentByTab.PENDING.splice(pendingIndex, 1)

    const publishedContent = normalizeItem(
      response.content || {
        ...item,
        status: 'PUBLISHED',
        publishedAt: new Date().toISOString(),
      },
    )

    const existingPublishedIndex = contentByTab.PUBLISHED.findIndex((content) => content.id === publishedContent.id)
    if (existingPublishedIndex !== -1) {
      contentByTab.PUBLISHED.splice(existingPublishedIndex, 1, publishedContent)
    } else {
      contentByTab.PUBLISHED.unshift(publishedContent)
    }

    pushToast?.({ type: 'success', title: 'Publication', message: 'Contenu publié sur Instagram.' })
  } catch {
    item._loading = false
  }
}
</script>
