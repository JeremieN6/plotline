<template>
  <div class="space-y-6">
    <header class="rounded-[20px] border border-[#E5E3DF] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
      <div class="flex items-start justify-between gap-3">
        <div>
          <p class="text-xs font-semibold uppercase tracking-[0.22em] text-[#E8873A]">Génération</p>
          <h1 class="mt-2 text-3xl font-bold tracking-tight text-[#111111]">Pinterest Workflow</h1>
          <p class="mt-2 text-sm text-[#666666]">{{ influencerName }}</p>
        </div>
        <button
          type="button"
          class="rounded-lg border border-[#E5E3DF] bg-white px-3 py-2 text-xs font-bold text-gray-700 transition-colors hover:bg-gray-50"
          @click="router.push('/content')"
        >
          Retour
        </button>
      </div>
    </header>

    <div class="grid gap-5 lg:grid-cols-[minmax(320px,0.95fr)_minmax(0,1.25fr)]">
      <aside class="w-full rounded-[20px] border border-[#E5E3DF] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
        <div class="mb-5 flex items-center justify-between gap-3">
          <div>
            <p class="text-sm font-bold text-gray-900">Configuration</p>
            <p class="mt-1 text-sm text-gray-500">Sélectionne le format puis lance la génération.</p>
          </div>
        </div>

        <section class="mb-5 rounded-[18px] border border-[#E5E3DF] bg-[#FCFCFB] p-4">
          <p class="mb-3 text-sm font-bold text-gray-900">Section 1 - Type de contenu</p>
          <div class="grid grid-cols-1 gap-2 sm:grid-cols-4">
            <button
              v-for="item in contentTypeOptions"
              :key="item.value"
              type="button"
              class="rounded-[16px] border px-3 py-3 text-left transition-all duration-150"
              :class="contentType === item.value
                ? 'border-[#E8873A] bg-[#FFF8F2] shadow-[0_1px_3px_rgba(0,0,0,0.08)]'
                : 'border-[#E5E3DF] bg-white hover:border-[#E8873A]/40 hover:bg-[#FFF8F2]'"
              @click="selectContentType(item.value)"
            >
              <p class="text-base font-bold text-gray-900">{{ item.label }}</p>
              <p class="mt-1 text-xs font-medium text-gray-500">{{ item.description }}</p>
            </button>
          </div>
        </section>

        <section
          v-if="contentType === 'free'"
          class="mb-5 rounded-[18px] border border-[#E5E3DF] bg-[#FCFCFB] p-4"
        >
          <p class="mb-3 text-sm font-bold text-gray-900">Génération libre</p>
          <label for="free-prompt" class="mb-2 block text-sm font-semibold text-gray-900">
            Décris la scene que tu veux générer
          </label>
          <textarea
            id="free-prompt"
            v-model="freePrompt"
            class="w-full resize-y border border-[#E5E3DF] p-4 text-sm text-gray-900 outline-none focus:border-[#E8873A]"
            style="min-height: 120px; border-radius: 12px; font-family: Inter, sans-serif;"
            placeholder="Ex : Madison dans un cafe parisien, lumiere doree, tenue casual chic, sourire naturel..."
          />

          <div class="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              class="rounded-[12px] border border-[#E8873A] bg-white px-4 py-2.5 text-sm font-bold text-[#E8873A] transition-colors hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="!canOptimizePrompt || optimizingPrompt || generating"
              @click="optimizePrompt"
            >
              {{ optimizingPrompt ? 'Optimisation...' : '✨ Optimiser le prompt' }}
            </button>
            <button
              type="button"
              class="rounded-[12px] bg-[#E8873A] px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#d4762f] disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="!canGenerate || generating || optimizingPrompt"
              @click="submitGeneration"
            >
              {{ generating ? 'Generation en cours...' : 'Generer' }}
            </button>
          </div>
        </section>

        <section v-if="contentType && contentType !== 'free'" class="mb-5 rounded-[18px] border border-[#E5E3DF] bg-[#FCFCFB] p-4">
          <p class="mb-3 text-sm font-bold text-gray-900">Section 2 - Mode de selection</p>

          <div class="flex gap-2">
            <button
              type="button"
              class="flex-1 rounded-[12px] border px-3 py-2 text-sm font-bold transition-colors duration-150"
              :class="selectionMode === 'random'
                ? 'border-[#E8873A] bg-[#E8873A] text-white'
                : 'border-[#E5E3DF] bg-white text-gray-700 hover:bg-gray-50'"
              @click="setMode('random')"
            >
              🎲 Aleatoire
            </button>
            <button
              type="button"
              class="flex-1 rounded-[12px] border px-3 py-2 text-sm font-bold transition-colors duration-150"
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
            class="mt-3 flex items-center justify-between gap-2 rounded-[14px] border border-orange-200 bg-[#FFF8F2] p-3"
          >
            <p class="text-xs font-semibold text-[#B45F1D]">
              {{ randomSelectionLabel }}
            </p>
            <button
              type="button"
              class="rounded-[10px] border border-orange-200 bg-white px-2 py-1 text-xs font-bold text-[#B45F1D] hover:bg-orange-100"
              @click="rollRandomSelection"
            >
              🔄
            </button>
          </div>
        </section>

        <section
          v-if="contentType && contentType !== 'free' && selectionMode === 'manual'"
          class="mb-5 rounded-[18px] border border-[#E5E3DF] bg-[#FCFCFB] p-4"
        >
          <p class="mb-3 text-sm font-bold text-gray-900">Section 3 - Selection manuelle</p>

          <div v-if="contentType === 'feed'" class="mb-4">
            <p class="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">Source</p>
            <div class="flex gap-2">
              <button
                v-for="source in feedSources"
                :key="source.value"
                type="button"
                class="rounded-[12px] border px-3 py-2 text-xs font-bold transition-colors duration-150"
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
                v-for="category in categoryOptions"
                :key="category"
                type="button"
                class="rounded-full border px-3 py-1.5 text-xs font-bold capitalize transition-colors duration-150"
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
                class="rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors duration-150"
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
          v-if="contentType !== 'free'"
          type="button"
          class="w-full rounded-[14px] bg-[#E8873A] px-4 py-3 text-sm font-bold text-white transition-all duration-150 hover:bg-[#d4762f] disabled:cursor-not-allowed disabled:opacity-60"
          :class="generating ? 'animate-pulse shadow-[0_0_0_4px_rgba(232,135,58,0.12)]' : 'shadow-[0_1px_3px_rgba(0,0,0,0.08)]'"
          :disabled="!canGenerate || generating"
          @click="submitGeneration"
        >
          {{ generating ? 'Generation en cours...' : 'Lancer la génération' }}
        </button>
      </aside>

        <main class="w-full rounded-[20px] border border-[#E5E3DF] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
        <h2 class="text-lg font-bold text-gray-900">Recapitulatif</h2>

        <div class="mt-4 space-y-3 rounded-[18px] border border-[#E5E3DF] bg-[#FCFCFB] p-4 text-sm text-gray-700">
          <p><span class="font-bold">Type:</span> {{ activeSelection?.contentType || '-' }}</p>
          <p><span class="font-bold">Source:</span> {{ activeSelection?.source || '-' }}</p>
          <p><span class="font-bold">Categorie:</span> {{ activeSelection?.category || '-' }}</p>
          <p><span class="font-bold">mot-clé affiche:</span> {{ activeSelection?.keywordLabel || '-' }}</p>
          <p><span class="font-bold">Keyword API:</span> {{ activeSelection?.keywordValue || '-' }}</p>
          <p><span class="font-bold">Prompt libre:</span> {{ activeSelection?.prompt || '-' }}</p>
        </div>

        <div class="mt-4 rounded-[18px] border border-[#E5E3DF] bg-[#FCFCFB] p-4">
          <p class="text-sm font-semibold text-gray-800">Payload envoyé</p>
          <pre class="mt-2 overflow-x-auto rounded-lg bg-[#111827] p-3 text-xs text-gray-100">{{ payloadPreview }}</pre>
        </div>

        <div v-if="lastResult" class="mt-4 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          <p class="font-bold">Génération créée</p>
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
const activeInfluencerId = useActiveInfluencer()

const id = computed(() => String(route.params.id || ''))

watch(
  id,
  (value) => {
    if (value) {
      activeInfluencerId.value = value
    }
  },
  { immediate: true },
)

const contentTypeOptions = [
  { value: 'feed', label: '🖼️ Feed', description: 'Publication image' },
  { value: 'reel', label: '🎬 Reel', description: 'Format vidéo court' },
  { value: 'story', label: '📱 Story', description: 'Format vertical' },
  { value: 'free', label: '✏️ Libre', description: 'Décris ce que tu veux' },
]

const feedSources = [
  { value: 'relevant_keywords', label: 'relevant_keywords' },
  { value: 'pinterest_tags', label: 'pinterest_tags' },
]

const defaultCategories = ['lifestyle', 'beach', 'outfit']

const contentType = ref('')
const selectionMode = ref('')

const manualFeedSource = ref('relevant_keywords')
const manualCategory = ref('')
const manualKeywordLabel = ref('')
const manualKeywordValue = ref('')

const randomSelection = ref(null)
const freePrompt = ref('')
const generating = ref(false)
const optimizingPrompt = ref(false)
const formError = ref('')
const lastResult = ref(null)

const { data: influencerData } = await useFetch(() => `/api/influencers/${id.value}`, {
  key: computed(() => `influencer-generate-${id.value}`),
})

const { data: variablesData } = await useFetch('/api/variables', {
  key: 'generate-variables',
})

const influencerName = computed(() => {
  return influencerData.value?.name ? `Influenceuse: ${influencerData.value.name}` : `Influenceuse #${id.value}`
})

const influencerNameRaw = computed(() => String(influencerData.value?.name || '').trim())
const influencerStyle = computed(() => String(influencerData.value?.style || '').trim())
const influencerNiche = computed(() => String(influencerData.value?.niche || '').trim())

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

function getSourceCategories(sourceName) {
  if (sourceName === 'pinterest_tags') {
    return getSourceCategories('relevant_keywords')
  }

  const sourceData = variables.value?.[sourceName]
  if (!sourceData || typeof sourceData !== 'object') {
    return []
  }

  return Object.keys(sourceData).filter((key) => {
    const values = sourceData[key]
    return Array.isArray(values) && values.length > 0
  })
}

const categoryOptions = computed(() => {
  if (!manualSource.value) {
    return defaultCategories
  }

  const categories = getSourceCategories(manualSource.value)
  return categories.length ? categories : defaultCategories
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

  if (contentType.value === 'free') {
    return {
      contentType: 'free',
      source: 'custom_prompt',
      category: '-',
      keywordLabel: '-',
      keywordValue: '-',
      prompt: freePrompt.value.trim(),
    }
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
  if (contentType.value === 'free') {
    return JSON.stringify(
      {
        influencerId: id.value,
        workflowType: 'free',
        contentType: 'feed',
        prompt: freePrompt.value.trim(),
      },
      null,
      2,
    )
  }

  if (!activeSelection.value) {
    return '{}'
  }

  return JSON.stringify(
    {
      influencerId: id.value,
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
  if (contentType.value === 'free') {
    return Boolean(id.value && freePrompt.value.trim())
  }

  return Boolean(id.value && activeSelection.value?.source && activeSelection.value?.keywordValue)
})

const canOptimizePrompt = computed(() => {
  return Boolean(freePrompt.value.trim())
})

watch(
  () => contentType.value,
  () => {
    selectionMode.value = ''
    resetManualSelection()
    randomSelection.value = null
    formError.value = ''
    lastResult.value = null
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
  const sourceCategories = getSourceCategories(sourceName)
  return randomItem(sourceCategories.length ? sourceCategories : defaultCategories)
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
      category = randomItem(defaultCategories)
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
    const payload = contentType.value === 'free'
      ? {
          influencerId: id.value,
          workflowType: 'free',
          prompt: freePrompt.value.trim(),
          contentType: 'feed',
        }
      : {
          influencerId: id.value,
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
      message: `Content ID ${response?.contentId || '-'} · La generation est en cours dans l'onglet Contenu.`,
      tone: 'success',
      actionLabel: 'Voir dans Contenu',
      actionHref: '/content',
      duration: 7000,
    })
  } catch (err) {
    formError.value = err?.data?.statusMessage || err?.message || 'Erreur pendant la generation'
  } finally {
    generating.value = false
  }
}

async function optimizePrompt() {
  if (!canOptimizePrompt.value || optimizingPrompt.value || generating.value) {
    return
  }

  formError.value = ''
  optimizingPrompt.value = true

  try {
    const response = await $fetch('/api/generate/optimize-prompt', {
      method: 'POST',
      body: {
        rawPrompt: freePrompt.value.trim(),
        influencerName: influencerNameRaw.value,
        influencerStyle: influencerStyle.value,
        influencerNiche: influencerNiche.value,
      },
    })

    const optimized = String(response?.optimizedPrompt || '').trim()
    if (optimized) {
      freePrompt.value = optimized
    }
  } catch (err) {
    formError.value = err?.data?.statusMessage || err?.message || 'Erreur pendant l\'optimisation du prompt'
  } finally {
    optimizingPrompt.value = false
  }
}
</script>
