<template>
  <div class="space-y-6">
    <header class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p class="text-xs font-semibold uppercase tracking-[0.22em] text-[#E8873A]">Accueil</p>
        <h1 class="mt-2 text-3xl font-bold tracking-tight text-[#111111]">Dashboard</h1>
        <p class="mt-2 text-sm text-[#666666]">Vue globale des contenus, de la production et des prochaines publications.</p>
      </div>
      <NuxtLink
        :to="activeGenerateHref"
        class="inline-flex items-center justify-center rounded-[12px] bg-[#E8873A] px-4 py-3 text-sm font-bold text-white shadow-[0_1px_3px_rgba(0,0,0,0.08)] transition-all duration-150 hover:-translate-y-0.5 hover:bg-[#d4762f]"
      >
        Générer
      </NuxtLink>
    </header>

    <section v-if="!isContentCreator" class="flex flex-col gap-3 rounded-[20px] border border-[#E5E3DF] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)] sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p class="text-sm font-semibold text-[#111111]">Filtrer par campagne</p>
        <p class="text-xs text-[#666666]">Le dashboard se cale sur une seule campagne si besoin.</p>
      </div>
      <div class="flex items-center gap-2">
        <select v-model="selectedCampaignId" class="min-w-[220px] rounded-[12px] border border-[#E5E3DF] bg-white px-3 py-2 text-sm text-[#111111] outline-none focus:border-[#E8873A]">
          <option value="">Toutes les campagnes</option>
          <option v-for="campaign in dashboard.campaigns" :key="campaign.id" :value="campaign.id">
            {{ campaign.name }}
          </option>
        </select>
        <button type="button" class="rounded-[12px] border border-[#E5E3DF] bg-[#FAFAF8] px-3 py-2 text-xs font-bold text-[#111111]" @click="selectedCampaignId = ''">
          Réinitialiser
        </button>
      </div>
    </section>

    <div class="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      <article
        v-for="item in bentoStats"
        :key="item.label"
        class="rounded-[16px] border border-[#E5E3DF] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
      >
        <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#999999]">{{ item.label }}</p>
        <div class="mt-3 flex items-center justify-between gap-2">
          <p class="text-2xl font-bold leading-none text-[#111111]">{{ item.value }}</p>
          <span class="rounded-full px-2.5 py-1 text-[11px] font-bold" :class="item.chipClass">{{ item.delta }}</span>
        </div>
      </article>
    </div>

    <div v-if="loading" class="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.9fr)]">
      <div class="h-[32rem] animate-pulse rounded-[20px] border border-[#E5E3DF] bg-white" />
      <div class="space-y-5">
        <div class="h-64 animate-pulse rounded-[20px] border border-[#E5E3DF] bg-white" />
        <div class="h-40 animate-pulse rounded-[20px] border border-[#E5E3DF] bg-white" />
      </div>
    </div>

    <div v-else class="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.9fr)]">
      <section class="rounded-[20px] border border-[#E5E3DF] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
        <div class="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 class="text-lg font-bold text-[#111111]">En attente de validation</h2>
            <p class="text-sm text-[#666666]">Contenus récents à vérifier avant publication.</p>
          </div>
          <NuxtLink to="/content" class="text-sm font-bold text-[#E8873A] transition-colors hover:text-[#d4762f]">Voir tout</NuxtLink>
        </div>

        <div class="max-h-[30rem] space-y-3 overflow-y-auto pr-1">
          <article
            v-for="content in dashboard.pendingContents"
            :key="content.id"
            class="flex flex-col gap-3 overflow-hidden rounded-[16px] border border-[#E5E3DF] bg-[#FAFAF8] p-3 transition-all duration-150 hover:border-[#E8873A]/35 hover:bg-white sm:flex-row sm:items-center"
          >
            <div class="flex h-44 w-full shrink-0 items-center justify-center overflow-hidden rounded-[14px] bg-[#F2EEE8] sm:h-16 sm:w-16">
              <img v-if="content.imageUrl && !isVideoContent(content)" :src="content.imageUrl" class="h-full w-full object-cover" alt="Aperçu" />
              <video v-else-if="content.imageUrl" :src="content.imageUrl" class="h-full w-full object-cover" muted playsinline preload="metadata" />
              <span v-else class="text-xs font-bold text-[#666666]">{{ content.format }}</span>
            </div>
            <div class="min-w-0 w-full flex-1">
              <div class="flex flex-wrap items-center gap-2">
                <span class="rounded-full bg-[#FDE7D6] px-2 py-1 text-[11px] font-bold text-[#B45F1D]">{{ content.format }}</span>
                <span class="text-xs text-[#666666]">{{ timeAgo(content.createdAt) }}</span>
                <span v-if="content.campaign?.name" class="rounded-full bg-[#F4EFE8] px-2 py-1 text-[11px] font-bold text-[#B45F1D]">{{ content.campaign.name }}</span>
              </div>
              <p class="mt-1 truncate text-sm font-semibold text-[#111111]">{{ content.influencer?.name }}</p>
              <p class="truncate text-xs text-[#666666]">{{ content.caption || 'Contenu sans caption' }}</p>
            </div>
            <div class="flex w-full shrink-0 items-center gap-2 sm:w-auto">
              <button class="flex-1 rounded-[12px] bg-[#111111] px-3 py-2 text-xs font-bold text-white transition-colors duration-150 hover:bg-[#2a2a2a] sm:flex-none" @click="validateContent(content.id)">
                ✓ Valider
              </button>
              <button class="flex-1 rounded-[12px] border border-[#E5E3DF] bg-white px-3 py-2 text-xs font-bold text-[#111111] transition-colors duration-150 hover:bg-[#FAFAF8] sm:flex-none" @click="removeContent(content.id)">
                ✗ Supprimer
              </button>
            </div>
          </article>
        </div>
      </section>

      <div class="space-y-5">
        <section v-if="ambassadorProfiles.length" class="rounded-[20px] border border-[#E5E3DF] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
          <h2 class="text-lg font-bold text-[#111111]">{{ wording.ambassadorPlural }} actives</h2>
          <div class="mt-4 space-y-3">
            <article
              v-for="influencer in ambassadorProfiles"
              :key="influencer.id"
              class="rounded-[16px] border border-[#E5E3DF] bg-[#FAFAF8] p-4 transition-all duration-150 hover:border-[#E8873A]/35 hover:bg-white"
            >
              <div class="flex items-start justify-between gap-3">
                <div>
                  <h3 class="text-sm font-bold text-[#111111]">{{ influencer.name }}</h3>
                  <p class="mt-1 text-xs text-[#666666]">{{ summarizeNiches(influencer.niche) || 'Sans niche' }}</p>
                </div>
                <span class="rounded-full bg-[#F4EFE8] px-2 py-1 text-[11px] font-bold text-[#B45F1D]">{{ influencer._count.generatedContents }} contenus</span>
              </div>
              <div class="mt-4 flex gap-2">
                <NuxtLink
                  :to="generateHrefFor(influencer)"
                  class="inline-flex rounded-[12px] bg-[#E8873A] px-3 py-2 text-xs font-bold text-white transition-colors duration-150 hover:bg-[#d4762f]"
                  @click="activeInfluencerId = influencer.id"
                >
                  Générer
                </NuxtLink>
                <NuxtLink
                  :to="`/influencers/${influencer.id}`"
                  class="inline-flex rounded-[12px] border border-[#E5E3DF] bg-white px-3 py-2 text-xs font-bold text-[#111111] transition-colors duration-150 hover:bg-[#FAFAF8]"
                >
                  Contenu
                </NuxtLink>
              </div>
            </article>
          </div>
        </section>

        <section v-if="brandProfiles.length" class="rounded-[20px] border border-[#E5E3DF] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
          <h2 class="text-lg font-bold text-[#111111]">Profils marque</h2>
          <div class="mt-4 space-y-3">
            <article
              v-for="influencer in brandProfiles"
              :key="influencer.id"
              class="rounded-[16px] border border-[#E5E3DF] bg-[#FAFAF8] p-4 transition-all duration-150 hover:border-[#E8873A]/35 hover:bg-white"
            >
              <div class="flex items-start justify-between gap-3">
                <div>
                  <h3 class="text-sm font-bold text-[#111111]">{{ influencer.name }}</h3>
                  <p class="mt-1 text-xs text-[#666666]">{{ summarizeNiches(influencer.niche) || 'Sans niche' }}</p>
                </div>
                <span class="rounded-full bg-[#F4EFE8] px-2 py-1 text-[11px] font-bold text-[#B45F1D]">{{ influencer._count.generatedContents }} contenus</span>
              </div>
              <div class="mt-4 flex gap-2">
                <NuxtLink
                  :to="generateHrefFor(influencer)"
                  class="inline-flex rounded-[12px] bg-[#E8873A] px-3 py-2 text-xs font-bold text-white transition-colors duration-150 hover:bg-[#d4762f]"
                  @click="activeInfluencerId = influencer.id"
                >
                  Générer
                </NuxtLink>
                <NuxtLink
                  :to="`/influencers/${influencer.id}`"
                  class="inline-flex rounded-[12px] border border-[#E5E3DF] bg-white px-3 py-2 text-xs font-bold text-[#111111] transition-colors duration-150 hover:bg-[#FAFAF8]"
                >
                  Contenu
                </NuxtLink>
              </div>
            </article>
          </div>
        </section>
      </div>
    </div>

    <section class="rounded-[20px] border border-[#E5E3DF] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
      <div class="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 class="text-lg font-bold text-[#111111]">Prochaines publications</h2>
          <p class="text-sm text-[#666666]">Les 5 prochains créneaux planifiés.</p>
        </div>
      </div>

      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <article
          v-for="item in dashboard.upcomingContents"
          :key="item.id"
          class="rounded-[16px] border border-[#E5E3DF] bg-[#FAFAF8] p-4"
        >
          <div class="flex items-center justify-between gap-2">
            <span class="rounded-full bg-[#FDE7D6] px-2 py-1 text-[11px] font-bold text-[#B45F1D]">{{ item.format }}</span>
            <span class="text-xs text-[#666666]">{{ formatDate(item.scheduledAt) }}</span>
          </div>
          <p v-if="item.campaign?.name" class="mt-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[#B45F1D]">{{ item.campaign.name }}</p>
          <p class="mt-3 text-sm font-bold text-[#111111]">{{ item.influencer?.name }}</p>
          <p class="mt-1 line-clamp-3 text-xs text-[#666666]">{{ item.caption || 'Publication planifiée sans caption' }}</p>
        </article>
      </div>
    </section>
  </div>
</template>

<script setup>
const activeInfluencerId = useActiveInfluencer()
const { wording, accountType } = useWording()
const isContentCreator = computed(() => accountType.value === 'CONTENT_CREATOR')
const isBrand = computed(() => accountType.value === 'BRAND')
const selectedCampaignId = ref('')

const dashboardUrl = computed(() => {
  const campaignQuery = selectedCampaignId.value ? `?campaignId=${encodeURIComponent(selectedCampaignId.value)}` : ''
  return `/api/dashboard${campaignQuery}`
})

const { data, pending: loading, refresh } = await useFetch(dashboardUrl, {
  key: 'plotline-dashboard',
})
const { pushToast } = useUiFeedback()
const dashboard = computed(() => data.value || {
  campaigns: [],
  influencers: [],
  pendingContents: [],
  upcomingContents: [],
  stats: {},
})

watch(selectedCampaignId, () => {
  refresh()
})

const activeGenerateHref = computed(() => {
  if (isContentCreator.value) return '/studio'
  if (isBrand.value) return '/brand-studio'
  const firstInfluencer = data.value?.influencers?.[0]
  const influencerId = activeInfluencerId.value || firstInfluencer?.id
  return influencerId ? `/influencers/${influencerId}/generate` : '/influencers/new'
})

function generateHrefFor(influencer) {
  if (isContentCreator.value) return '/studio'
  if (isBrand.value) return '/brand-studio'
  return `/influencers/${influencer.id}/generate`
}

const ambassadorProfiles = computed(() => {
  return (dashboard.value.influencers || []).filter((item) => Boolean(String(item.faceRefPath || '').trim()))
})

const brandProfiles = computed(() => {
  return (dashboard.value.influencers || []).filter((item) => !String(item.faceRefPath || '').trim())
})

const stats = computed(() => {
  const summary = data.value?.stats || {}
  return [
    { label: 'Contenus générés', value: summary.totalGenerated || 0 },
    { label: 'Contenus publiés', value: summary.publishedCount || 0 },
    { label: 'En attente', value: summary.pendingCount || 0 },
  ]
})

const bentoStats = computed(() => {
  const summary = data.value?.stats || {}

  return [
    {
      label: 'Contenus',
      value: summary.totalGenerated || 0,
      delta: 'Total',
      chipClass: 'bg-[#F4EFE8] text-[#B45F1D]',
    },
    {
      label: 'Publiés',
      value: summary.publishedCount || 0,
      delta: 'Live',
      chipClass: 'bg-[#E9F7EF] text-[#1A7A44]',
    },
    {
      label: 'En attente',
      value: summary.pendingCount || 0,
      delta: 'Pending',
      chipClass: 'bg-[#FDE7D6] text-[#B45F1D]',
    },
    {
      label: wording.value.ambassadorPlural,
      value: ambassadorProfiles.value.length,
      delta: 'Actives',
      chipClass: 'bg-[#F2F2F2] text-[#555555]',
    },
    {
      label: 'Marques',
      value: brandProfiles.value.length,
      delta: 'Profils',
      chipClass: 'bg-[#F2F2F2] text-[#555555]',
    },
  ]
})

function timeAgo(dateValue) {
  const diff = Date.now() - new Date(dateValue).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'À l’instant'
  if (mins < 60) return `Il y a ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `Il y a ${hours} h`
  return `Il y a ${Math.floor(hours / 24)} j`
}

function formatDate(dateValue) {
  if (!dateValue) return '—'
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(dateValue))
}

function isVideoContent(content) {
  const format = String(content?.format || '').toUpperCase()
  return format === 'REEL' || format === 'STORY' || String(content?.imageUrl || '').toLowerCase().endsWith('.mp4')
}

async function validateContent(contentId) {
  await $fetch(`/api/content/${contentId}/validate`, { method: 'PATCH' })
  pushToast({ title: 'Contenu validé', message: 'Le contenu a été déplacé vers les éléments prêts.', tone: 'success' })
  await refresh()
}

async function removeContent(contentId) {
  await $fetch(`/api/content/${contentId}`, { method: 'DELETE' })
  pushToast({ title: 'Contenu supprimé', message: 'Le contenu a été retiré du dashboard.', tone: 'success' })
  await refresh()
}
</script>
