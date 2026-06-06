<template>
  <div class="min-h-screen bg-[#FAFAF8] p-6 md:p-8">
    <div class="mx-auto flex w-full max-w-6xl flex-col gap-5 lg:flex-row">
      <aside class="w-full rounded-2xl border border-[#E5E3DF] bg-white p-5 shadow-sm lg:w-[40%]">
        <div class="mb-5 flex items-center justify-between gap-3">
          <div>
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-[#E8873A]">Generation</p>
            <h1 class="mt-2 text-xl font-bold text-gray-900">Pinterest Workflow</h1>
            <p class="mt-1 text-sm text-gray-500">{{ influencerName }}</p>
          </div>
          <!-- <button
            type="button"
            class="rounded-lg border border-[#E5E3DF] bg-white px-3 py-2 text-xs font-bold text-gray-700 transition-colors hover:bg-gray-50"
            @click="router.push(`/influencers/${id}`)"
          >
            Retour
          </button> -->
          <button
            type="button"
            class="rounded-lg border border-[#E5E3DF] bg-white px-3 py-2 text-xs font-bold text-gray-700 transition-colors hover:bg-gray-50"
            @click="router.push(`/influencers`)"
          >
            Retour
          </button>
        </div>

        <section class="mb-5 rounded-xl border border-[#E5E3DF] bg-[#FCFCFB] p-4">
          <p class="mb-3 text-sm font-bold text-gray-900">Section 1 - Type de contenu</p>
          <div class="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <button
              v-for="item in contentTypeOptions"
              :key="item.value"
              type="button"
              class="rounded-xl border px-3 py-3 text-left transition-all"
              :class="contentType === item.value
                ? 'border-[#E8873A] bg-orange-50 shadow-sm'
                : 'border-[#E5E3DF] bg-white hover:border-[#E8873A]/40'"
              @click="selectContentType(item.value)"
            >
              <p class="text-base font-bold text-gray-900">{{ item.label }}</p>
              <p class="mt-1 text-xs font-medium text-gray-500">{{ item.description }}</p>
            </button>
          </div>
        </section>

        <section v-if="contentType" class="mb-5 rounded-xl border border-[#E5E3DF] bg-[#FCFCFB] p-4">
          <p class="mb-3 text-sm font-bold text-gray-900">Section 2 - Mode de selection</p>

          <div class="flex gap-2">
            <button
              type="button"
              class="flex-1 rounded-lg border px-3 py-2 text-sm font-bold transition-colors"
              :class="selectionMode === 'random'
                ? 'border-[#E8873A] bg-[#E8873A] text-white'
                : 'border-[#E5E3DF] bg-white text-gray-700 hover:bg-gray-50'"
              @click="setMode('random')"
            >
              🎲 Aleatoire
            </button>
            <button
              type="button"
              class="flex-1 rounded-lg border px-3 py-2 text-sm font-bold transition-colors"
              :class="selectionMode === 'manual'
                ? 'border-[#E8873A] bg-[#E8873A] text-white'
                : 'border-[#E5E3DF] bg-white text-gray-700 hover:bg-gray-50'"
              @click="setMode('manual')"
            >
              🎯 Choisir
            </button>
          </div>

          <div
            v-if="selectionMode === 'random' && randomSelection"
            class="mt-3 flex items-center justify-between gap-2 rounded-lg border border-orange-200 bg-orange-50 p-3"
          >
            <p class="text-xs font-semibold text-[#B45F1D]">
              {{ randomSelectionLabel }}
            </p>
            <button
              type="button"
              class="rounded-md border border-orange-200 bg-white px-2 py-1 text-xs font-bold text-[#B45F1D] hover:bg-orange-100"
              @click="rollRandomSelection"
            >
              🔄
            </button>
          </div>
        </section>

        <section
          v-if="contentType && selectionMode === 'manual'"
          class="mb-5 rounded-xl border border-[#E5E3DF] bg-[#FCFCFB] p-4"
        >
          <p class="mb-3 text-sm font-bold text-gray-900">Section 3 - Selection manuelle</p>

          <div v-if="contentType === 'feed'" class="mb-4">
            <p class="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">Source</p>
            <div class="flex gap-2">
              <button
                v-for="source in feedSources"
                :key="source.value"
                type="button"
                class="rounded-lg border px-3 py-2 text-xs font-bold transition-colors"
                :class="manualFeedSource === source.value
                  ? 'border-[#E8873A] bg-orange-50 text-[#B45F1D]'
                  : 'border-[#E5E3DF] bg-white text-gray-600 hover:bg-gray-50'"
                @click="setManualFeedSource(source.value)"
              >
                {{ source.label }}
              </button>
            </div>
          </div>

          <div class="mb-4">
            <p class="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">Categorie</p>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="category in categories"
                :key="category"
                type="button"
                class="rounded-full border px-3 py-1.5 text-xs font-bold capitalize transition-colors"
                :class="manualCategory === category
                  ? 'border-[#E8873A] bg-[#E8873A] text-white'
                  : 'border-[#E5E3DF] bg-white text-gray-700 hover:bg-gray-50'"
                @click="setManualCategory(category)"
              >
                {{ category }}
              </button>
            </div>
          </div>

          <div v-if="manualCategory">
            <p class="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">Mots-cles</p>
            <div class="flex max-h-48 flex-wrap gap-2 overflow-y-auto pr-1">
              <button
                v-for="keyword in manualKeywordOptions"
                :key="`${keyword.label}-${keyword.value}`"
                type="button"
                class="rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors"
                :class="manualKeywordLabel === keyword.label
                  ? 'border-[#E8873A] bg-orange-50 text-[#B45F1D]'
                  : 'border-[#E5E3DF] bg-white text-gray-700 hover:bg-gray-50'"
                @click="selectManualKeyword(keyword)"
              >
                {{ keyword.label }}
              </button>
            </div>
          </div>
        </section>

        <p v-if="formError" class="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {{ formError }}
        </p>

        <button
          type="button"
          class="w-full rounded-lg bg-[#E8873A] px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-[#d4762f] disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="!canGenerate || generating"
          @click="submitGeneration"
        >
          {{ generating ? 'Generation en cours...' : 'Lancer la generation' }}
        </button>
      </aside>

      <main class="w-full rounded-2xl border border-[#E5E3DF] bg-white p-5 shadow-sm lg:w-[60%]">
        <h2 class="text-lg font-bold text-gray-900">Recapitulatif</h2>

        <div class="mt-4 space-y-3 rounded-xl border border-[#E5E3DF] bg-[#FCFCFB] p-4 text-sm text-gray-700">
          <p><span class="font-bold">Type:</span> {{ activeSelection?.contentType || '-' }}</p>
          <p><span class="font-bold">Source:</span> {{ activeSelection?.source || '-' }}</p>
          <p><span class="font-bold">Categorie:</span> {{ activeSelection?.category || '-' }}</p>
          <p><span class="font-bold">Mot-cle affiche:</span> {{ activeSelection?.keywordLabel || '-' }}</p>
          <p><span class="font-bold">Keyword API:</span> {{ activeSelection?.keywordValue || '-' }}</p>
        </div>

        <div class="mt-4 rounded-xl border border-[#E5E3DF] bg-[#FCFCFB] p-4">
          <p class="text-sm font-semibold text-gray-800">Payload envoye</p>
          <pre class="mt-2 overflow-x-auto rounded-lg bg-[#111827] p-3 text-xs text-gray-100">{{ payloadPreview }}</pre>
        </div>

        <div v-if="lastResult" class="mt-4 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          <p class="font-bold">Generation creee</p>
          <p class="mt-1">Status: {{ lastResult.status || '-' }}</p>
          <p>Content ID: {{ lastResult.contentId || '-' }}</p>
          <p>Job ID: {{ lastResult.jobId || 'null' }}</p>
        </div>
      </main>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
const { pushToast } = useUiFeedback()

const id = String(route.params.id || '')

const contentTypeOptions = [
  { value: 'feed', label: '🖼️ Feed', description: 'Publication image' },
  { value: 'reel', label: '🎬 Reel', description: 'Format video court' },
  { value: 'story', label: '📱 Story', description: 'Format vertical' },
]

const feedSources = [
  { value: 'relevant_keywords', label: 'relevant_keywords' },
  { value: 'pinterest_tags', label: 'pinterest_tags' },
]

const categories = ['lifestyle', 'beach', 'outfit']

const contentType = ref('')
const selectionMode = ref('')

const manualFeedSource = ref('relevant_keywords')
const manualCategory = ref('')
const manualKeywordLabel = ref('')
const manualKeywordValue = ref('')

const randomSelection = ref(null)
const generating = ref(false)
const formError = ref('')
const lastResult = ref(null)

const { data: influencerData } = await useFetch(`/api/influencers/${id}`, {
  key: `influencer-generate-${id}`,
})

const { data: variablesData } = await useFetch('/api/variables', {
  key: 'generate-variables',
})

const influencerName = computed(() => {
  return influencerData.value?.name ? `Influenceuse: ${influencerData.value.name}` : `Influenceuse #${id}`
})

const variables = computed(() => {
  return variablesData.value || {
    relevant_keywords: {},
    pinterest_tags: {},
    pinterest_video_tags_reel: {},
    pinterest_video_tags_story: {},
  }
})

const manualSource = computed(() => {
  if (contentType.value === 'feed') {
    return manualFeedSource.value
  }

  if (contentType.value === 'reel') {
    return 'pinterest_video_tags_reel'
  }

  if (contentType.value === 'story') {
    return 'pinterest_video_tags_story'
  }

  return ''
})

const manualKeywordOptions = computed(() => {
  if (!manualCategory.value || !manualSource.value) {
    return []
  }

  if (manualSource.value === 'pinterest_tags') {
    const tagMap = variables.value?.pinterest_tags || {}
    return Object.entries(tagMap).map(([label, value]) => ({
      label,
      value: String(value || ''),
    }))
  }

  const sourceData = variables.value?.[manualSource.value] || {}
  const keywords = Array.isArray(sourceData?.[manualCategory.value]) ? sourceData[manualCategory.value] : []

  return keywords.map((keyword) => ({
    label: String(keyword || ''),
    value: String(keyword || ''),
  }))
})

const randomSelectionLabel = computed(() => {
  if (!randomSelection.value) {
    return ''
  }

  return `${randomSelection.value.source} • ${randomSelection.value.category} • ${randomSelection.value.keywordLabel}`
})

const activeSelection = computed(() => {
  if (!contentType.value) {
    return null
  }

  if (selectionMode.value === 'random') {
    return randomSelection.value
  }

  if (selectionMode.value === 'manual' && manualCategory.value && manualKeywordValue.value) {
    return {
      contentType: contentType.value,
      source: manualSource.value,
      category: manualCategory.value,
      keywordLabel: manualKeywordLabel.value,
      keywordValue: manualKeywordValue.value,
    }
  }

  return null
})

const payloadPreview = computed(() => {
  if (!activeSelection.value) {
    return '{}'
  }

  return JSON.stringify(
    {
      influencerId: id,
      workflowType: 'pinterest',
      contentType: activeSelection.value.contentType,
      source: activeSelection.value.source,
      keyword: activeSelection.value.keywordValue,
    },
    null,
    2,
  )
})

const canGenerate = computed(() => {
  return Boolean(id && activeSelection.value?.source && activeSelection.value?.keywordValue)
})

watch(
  () => contentType.value,
  () => {
    selectionMode.value = ''
    resetManualSelection()
    randomSelection.value = null
    formError.value = ''
  },
)

function resetManualSelection() {
  manualCategory.value = ''
  manualKeywordLabel.value = ''
  manualKeywordValue.value = ''
}

function selectContentType(type) {
  contentType.value = type
}

function setMode(mode) {
  selectionMode.value = mode
  formError.value = ''
  lastResult.value = null

  if (mode === 'random') {
    resetManualSelection()
    rollRandomSelection()
    return
  }

  randomSelection.value = null
}

function setManualFeedSource(source) {
  manualFeedSource.value = source
  resetManualSelection()
}

function setManualCategory(category) {
  manualCategory.value = category
  manualKeywordLabel.value = ''
  manualKeywordValue.value = ''
}

function selectManualKeyword(keyword) {
  manualKeywordLabel.value = keyword.label
  manualKeywordValue.value = keyword.value
}

function randomItem(list) {
  if (!Array.isArray(list) || list.length === 0) {
    return ''
  }

  return list[Math.floor(Math.random() * list.length)] || ''
}

function randomCategoryFromSource(sourceName) {
  const sourceData = variables.value?.[sourceName] || {}
  const sourceCategories = Object.keys(sourceData).filter((key) => categories.includes(key))
  return randomItem(sourceCategories.length ? sourceCategories : categories)
}

function rollRandomSelection() {
  if (!contentType.value) {
    return
  }

  let source = ''
  let category = 'lifestyle'
  let keywordLabel = ''
  let keywordValue = ''

  if (contentType.value === 'feed') {
    source = randomItem(['relevant_keywords', 'pinterest_tags'])

    if (source === 'pinterest_tags') {
      const tagEntries = Object.entries(variables.value?.pinterest_tags || {})
      const picked = randomItem(tagEntries)
      category = randomItem(categories)
      keywordLabel = String(picked?.[0] || '')
      keywordValue = String(picked?.[1] || '')
    } else {
      category = randomCategoryFromSource(source)
      const keywords = variables.value?.relevant_keywords?.[category] || []
      const picked = randomItem(keywords)
      keywordLabel = String(picked || '')
      keywordValue = String(picked || '')
    }
  }

  if (contentType.value === 'reel') {
    source = 'pinterest_video_tags_reel'
    category = randomCategoryFromSource(source)
    const keywords = variables.value?.pinterest_video_tags_reel?.[category] || []
    const picked = randomItem(keywords)
    keywordLabel = String(picked || '')
    keywordValue = String(picked || '')
  }

  if (contentType.value === 'story') {
    source = 'pinterest_video_tags_story'
    category = randomCategoryFromSource(source)
    const keywords = variables.value?.pinterest_video_tags_story?.[category] || []
    const picked = randomItem(keywords)
    keywordLabel = String(picked || '')
    keywordValue = String(picked || '')
  }

  randomSelection.value = {
    contentType: contentType.value,
    source,
    category,
    keywordLabel,
    keywordValue,
  }
}

async function submitGeneration() {
  if (!canGenerate.value || generating.value) {
    return
  }

  formError.value = ''
  generating.value = true
  lastResult.value = null

  try {
    const payload = {
      influencerId: id,
      workflowType: 'pinterest',
      contentType: activeSelection.value.contentType,
      source: activeSelection.value.source,
      keyword: activeSelection.value.keywordValue,
    }

    const response = await $fetch('/api/generate/image', {
      method: 'POST',
      body: payload,
    })

    lastResult.value = response

    pushToast({
      title: 'Generation lancee',
      message: `Content ID ${response?.contentId || '-'}`,
      tone: 'success',
    })
  } catch (err) {
    formError.value = err?.data?.statusMessage || err?.message || 'Erreur pendant la generation'
  } finally {
    generating.value = false
  }
}
</script>
