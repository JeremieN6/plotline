<template>
  <div class="space-y-6">
    <header class="rounded-[20px] border border-[#E5E3DF] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p class="text-xs font-semibold uppercase tracking-[0.22em] text-[#E8873A]">Brand Studio</p>
          <h1 class="mt-2 text-3xl font-bold tracking-tight text-[#111111]">Créez un visuel pour votre campagne</h1>
          <p class="mt-2 text-sm text-[#666666]">Votre compte BRAND garde une marque unique. Travaillez par campagnes.</p>
        </div>
        <button
          type="button"
          class="inline-flex items-center justify-center rounded-[12px] border border-dashed border-[#E8873A]/45 px-4 py-2.5 text-sm font-bold text-[#E8873A] transition-colors hover:bg-[#FDF3EA]"
          @click="openCampaignModal"
        >
          + Nouvelle campagne
        </button>
      </div>
    </header>

    <div class="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.9fr)]">
      <section class="rounded-[20px] border border-[#E5E3DF] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
        <div class="mb-4">
          <label class="text-xs font-semibold uppercase tracking-[0.08em] text-[#666666]">Campagne active</label>
          <div class="mt-1.5 flex flex-wrap items-center gap-2">
            <select
              v-model="selectedCampaignId"
              class="min-w-[240px] rounded-[10px] border border-[#DFDDD9] bg-white px-3 py-2 text-sm text-[#111111] outline-none focus:border-[#E8873A]"
            >
              <option value="">Sans campagne</option>
              <option v-for="campaign in campaigns" :key="campaign.id" :value="campaign.id">
                {{ campaign.name }}
              </option>
            </select>
            <button type="button" class="rounded-[10px] border border-[#E5E3DF] bg-[#FAFAF8] px-3 py-2 text-xs font-bold text-[#111111]" @click="openCampaignModal">
              Créer
            </button>
          </div>
        </div>

        <label for="brand-prompt" class="text-sm font-bold text-[#111111]">Créez un visuel pour votre campagne</label>
        <textarea
          id="brand-prompt"
          v-model="prompt"
          class="mt-3 w-full rounded-[14px] border border-[#E5E3DF] bg-[#FAFAF8] p-4 text-sm text-[#111111] outline-none focus:border-[#E8873A]"
          style="min-height: 220px;"
          placeholder="Collez votre brief ou décrivez votre scène de campagne..."
        />

        <section class="mt-4 rounded-[12px] border border-[#E5E3DF] bg-[#FAFAF8] p-3.5">
          <p class="text-sm font-bold text-[#111111]">Voulez-vous ajouter une ambassadrice à cette image ?</p>

          <div class="mt-3 flex flex-wrap gap-3">
            <label class="inline-flex items-center gap-2 text-sm font-medium text-[#222]">
              <input
                v-model="generationMode"
                type="radio"
                value="with-ambassador"
                class="accent-[#E8873A]"
                :disabled="!hasAmbassadorProfiles"
              />
              Oui, avec ambassadrice
            </label>
            <label class="inline-flex items-center gap-2 text-sm font-medium text-[#222]">
              <input
                v-model="generationMode"
                type="radio"
                value="without-ambassador"
                class="accent-[#E8873A]"
              />
              Non, générer sans ambassadrice
            </label>
          </div>

          <div v-if="generationMode === 'with-ambassador' && hasAmbassadorProfiles" class="mt-3">
            <label class="text-xs font-semibold uppercase tracking-[0.08em] text-[#666666]">Ambassadrice</label>
            <select
              v-model="selectedAmbassadorId"
              class="mt-1.5 w-full rounded-[10px] border border-[#DFDDD9] bg-white px-3 py-2 text-sm text-[#111111] outline-none focus:border-[#E8873A]"
            >
              <option value="">Sélectionner une ambassadrice</option>
              <option v-for="ambassador in ambassadorProfiles" :key="ambassador.id" :value="ambassador.id">
                {{ ambassador.name }}
              </option>
            </select>
          </div>

          <div v-if="!hasAmbassadorProfiles" class="mt-3 rounded-[10px] border border-[#E5D8C9] bg-white px-3 py-3 text-xs text-[#7B5A3F]">
            <p>Aucune ambassadrice disponible pour le moment.</p>
            <NuxtLink to="/profiles/new" class="mt-2 inline-flex rounded-[8px] border border-dashed border-[#E8873A]/45 px-2.5 py-1.5 text-xs font-bold text-[#B45F1D]">
              Créer une ambassadrice
            </NuxtLink>
          </div>
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

        <div v-if="loading" class="mt-4 flex items-center gap-3 rounded-[14px] border border-[#E5E3DF] bg-[#FAFAF8] px-4 py-3">
          <span class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[#E8873A] border-t-transparent" />
          <span class="text-sm font-semibold text-[#111111]">Génération en cours...</span>
        </div>

        <div v-else-if="lastResult" class="mt-4 space-y-3 rounded-[14px] border border-[#E5E3DF] bg-[#FAFAF8] p-4 text-sm text-[#222]">
          <p><strong>Status :</strong> {{ lastResult.status || '-' }}</p>
          <p><strong>Content ID :</strong> {{ lastResult.contentId || '-' }}</p>
          <p><strong>Job ID :</strong> {{ lastResult.jobId || '-' }}</p>
        </div>

        <p v-else class="mt-4 text-sm text-[#777]">Aucun résultat pour le moment.</p>
      </aside>
    </div>

    <Teleport to="body">
      <div v-if="campaignModalOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" @click.self="closeCampaignModal">
        <div class="w-full max-w-md rounded-[16px] border border-[#E5E3DF] bg-white p-5 shadow-[0_12px_30px_rgba(17,17,17,0.2)]">
          <div class="mb-4 flex items-start justify-between gap-3">
            <div>
              <p class="text-xs font-semibold uppercase tracking-[0.16em] text-[#E8873A]">Nouvelle campagne</p>
              <h2 class="mt-1 text-lg font-bold text-[#111111]">Créer une campagne</h2>
            </div>
            <button type="button" class="rounded-[8px] border border-[#E5E3DF] bg-[#FAFAF8] px-2 py-1 text-xs font-bold" @click="closeCampaignModal">✕</button>
          </div>

          <div class="space-y-3">
            <div>
              <label class="text-sm font-semibold text-[#111111]">Nom de la campagne</label>
              <input v-model="campaignForm.name" class="mt-1.5 w-full rounded-[10px] border border-[#DFDDD9] bg-white px-3 py-2 text-sm outline-none focus:border-[#E8873A]" placeholder="Ex : Lancement rentrée" />
            </div>
            <div>
              <label class="text-sm font-semibold text-[#111111]">Objectif (optionnel)</label>
              <input v-model="campaignForm.objective" class="mt-1.5 w-full rounded-[10px] border border-[#DFDDD9] bg-white px-3 py-2 text-sm outline-none focus:border-[#E8873A]" placeholder="Ex : Acquisition" />
            </div>
            <div>
              <label class="text-sm font-semibold text-[#111111]">Canal principal (optionnel)</label>
              <input v-model="campaignForm.channel" class="mt-1.5 w-full rounded-[10px] border border-[#DFDDD9] bg-white px-3 py-2 text-sm outline-none focus:border-[#E8873A]" placeholder="Ex : Instagram" />
            </div>
          </div>

          <div class="mt-5 flex justify-end gap-2">
            <button type="button" class="rounded-[10px] border border-[#E5E3DF] bg-white px-3 py-2 text-sm font-bold" :disabled="creatingCampaign" @click="closeCampaignModal">Annuler</button>
            <button type="button" class="rounded-[10px] bg-[#E8873A] px-3 py-2 text-sm font-bold text-white disabled:opacity-60" :disabled="creatingCampaign" @click="createCampaign">
              {{ creatingCampaign ? 'Création...' : 'Créer' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const { pushToast } = useUiFeedback()
const route = useRoute()
const router = useRouter()
const activeInfluencerId = useActiveInfluencer()

const prompt = ref('')
const generationMode = ref('without-ambassador')
const selectedAmbassadorId = ref('')
const selectedCampaignId = ref('')
const loading = ref(false)
const creatingCampaign = ref(false)
const errorMessage = ref('')
const lastResult = ref(null)
const campaignModalOpen = ref(false)
const editingContentId = ref('')

const campaignForm = reactive({
  name: '',
  objective: '',
  channel: '',
})

const { data: influencersData } = await useFetch('/api/influencers', {
  key: 'brand-studio-influencers',
})

const { data: campaignsData, refresh: refreshCampaigns } = await useFetch('/api/campaigns', {
  key: 'brand-studio-campaigns',
})

const campaigns = computed(() => Array.isArray(campaignsData.value) ? campaignsData.value : [])

const brandProfiles = computed(() => {
  const list = Array.isArray(influencersData.value) ? influencersData.value : []
  return list.filter((item) => !String(item?.faceRefPath || '').trim())
})

const ambassadorProfiles = computed(() => {
  const list = Array.isArray(influencersData.value) ? influencersData.value : []
  return list.filter((item) => Boolean(String(item?.faceRefPath || '').trim()))
})

const hasAmbassadorProfiles = computed(() => ambassadorProfiles.value.length > 0)

const activeBrandProfile = computed(() => {
  const list = Array.isArray(influencersData.value) ? influencersData.value : []
  const active = brandProfiles.value.find((item) => item.id === activeInfluencerId.value)
  return active || brandProfiles.value[0] || list[0] || null
})

const primaryInfluencerId = computed(() => {
  return activeBrandProfile.value?.id || ''
})

const wantsAmbassador = computed(() => generationMode.value === 'with-ambassador' && hasAmbassadorProfiles.value)
const resolvedAmbassadorId = computed(() => {
  if (!wantsAmbassador.value) return ''
  return String(selectedAmbassadorId.value || '').trim()
})

const canGenerate = computed(() => {
  if (!prompt.value.trim() || !primaryInfluencerId.value) return false
  if (wantsAmbassador.value && !resolvedAmbassadorId.value) return false
  return true
})

watch(
  campaigns,
  (list) => {
    if (!list.length) {
      selectedCampaignId.value = ''
      return
    }

    if (!selectedCampaignId.value || !list.some((item) => item.id === selectedCampaignId.value)) {
      selectedCampaignId.value = list[0].id
    }
  },
  { immediate: true },
)

watch(
  ambassadorProfiles,
  (list) => {
    if (!list.length) {
      generationMode.value = 'without-ambassador'
      selectedAmbassadorId.value = ''
      return
    }

    const activeAmbassador = list.find((item) => item.id === activeInfluencerId.value)
    if (activeAmbassador) {
      selectedAmbassadorId.value = activeAmbassador.id
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
    selectedAmbassadorId.value = ambassadorProfiles.value[0]?.id || ''
  }
})

const editContentIdParam = String(route.query.edit || '').trim()
if (editContentIdParam) {
  try {
    const editContent = await $fetch(`/api/content/${editContentIdParam}`)
    editingContentId.value = editContentIdParam
    prompt.value = String(editContent?.prompt || '')

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

function openCampaignModal() {
  campaignModalOpen.value = true
}

function closeCampaignModal() {
  if (creatingCampaign.value) return
  campaignModalOpen.value = false
}

async function createCampaign() {
  if (creatingCampaign.value) return

  const name = campaignForm.name.trim()
  if (!name) {
    pushToast({
      title: 'Nom requis',
      message: 'Ajoute un nom de campagne pour continuer.',
      tone: 'warning',
    })
    return
  }

  creatingCampaign.value = true
  try {
    const created = await $fetch('/api/campaigns', {
      method: 'POST',
      body: {
        name,
        objective: campaignForm.objective.trim(),
        channel: campaignForm.channel.trim(),
      },
    })

    await refreshCampaigns()
    selectedCampaignId.value = created?.id || ''
    campaignForm.name = ''
    campaignForm.objective = ''
    campaignForm.channel = ''
    campaignModalOpen.value = false

    pushToast({
      title: 'Campagne créée',
      message: 'La nouvelle campagne est prête.',
      tone: 'success',
    })
  } catch (err) {
    pushToast({
      title: 'Création impossible',
      message: err?.data?.statusMessage || err?.message || 'Impossible de créer la campagne.',
      tone: 'error',
    })
  } finally {
    creatingCampaign.value = false
  }
}

if (route.query.newCampaign === '1') {
  campaignModalOpen.value = true
  const query = { ...route.query }
  delete query.newCampaign
  await router.replace({ path: route.path, query })
}

async function submit() {
  if (loading.value || !canGenerate.value) return

  loading.value = true
  errorMessage.value = ''

  try {
    const isEditing = Boolean(editingContentId.value)

    lastResult.value = isEditing
      ? await $fetch(`/api/content/${editingContentId.value}/regenerate`, {
          method: 'POST',
          body: { prompt: prompt.value.trim() },
        })
      : await $fetch('/api/generate/image', {
          method: 'POST',
          body: {
            influencerId: primaryInfluencerId.value,
            ambassadorId: resolvedAmbassadorId.value || null,
            campaignId: selectedCampaignId.value || null,
            workflowType: 'free',
            prompt: prompt.value.trim(),
            contentType: 'feed',
          },
        })

    pushToast({
      title: isEditing ? 'Régénération lancée' : 'Generation lancée',
      message: isEditing ? 'Le contenu a bien été renvoyé au pipeline.' : 'Le contenu image a bien été envoyé au pipeline.',
      tone: 'success',
    })

    editingContentId.value = ''
  } catch (err) {
    errorMessage.value = err?.data?.statusMessage || err?.message || 'Generation impossible.'
  } finally {
    loading.value = false
  }
}
</script>
