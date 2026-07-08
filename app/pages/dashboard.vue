<template>
  <div class="space-y-6 text-[#F2F5FD]">
    <header class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#F6B37A]">Home</p>
        <h1 class="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">Dashboard</h1>
        <p class="mt-2 text-sm text-[#A5B1C8]">Vue synthèse de la prod, des validations et des contenus planifiés.</p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <button type="button" class="inline-flex items-center rounded-[12px] border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-[#DDE3F3] transition-colors hover:bg-white/10">
          Jul 1, 2026 - Jul 8, 2026
        </button>
        <NuxtLink
          :to="activeGenerateHref"
          class="inline-flex items-center justify-center rounded-[12px] bg-[#E8873A] px-4 py-2.5 text-sm font-black text-[#180D05] shadow-[0_12px_30px_rgba(232,135,58,0.3)] transition-all duration-150 hover:-translate-y-0.5 hover:bg-[#f09d55]"
        >
          Générer
        </NuxtLink>
      </div>
    </header>

    <div v-if="loading" class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <div v-for="n in 4" :key="n" class="h-36 animate-pulse rounded-[18px] border border-white/10 bg-white/5" />
    </div>

    <div v-else class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <article
        v-for="item in kpiCards"
        :key="item.label"
        class="rounded-[18px] border border-white/10 bg-[linear-gradient(160deg,rgba(20,27,40,0.92),rgba(13,18,28,0.95))] p-5 shadow-[0_14px_32px_rgba(0,0,0,0.3)]"
      >
        <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8D9AB5]">{{ item.label }}</p>
        <div class="mt-3 flex items-end justify-between gap-3">
          <p class="text-4xl font-black leading-none text-white">{{ item.value }}</p>
          <span class="rounded-full px-2.5 py-1 text-xs font-bold" :class="item.toneClass">{{ item.delta }}</span>
        </div>
      </article>
    </div>

    <div class="grid grid-cols-1 gap-4 xl:grid-cols-12">
      <section class="rounded-[22px] border border-white/10 bg-[linear-gradient(165deg,rgba(16,23,35,0.96),rgba(10,14,22,0.98))] p-5 shadow-[0_18px_44px_rgba(0,0,0,0.35)] xl:col-span-8">
        <div class="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 class="text-lg font-bold text-white">En attente de validation</h2>
            <p class="text-sm text-[#9CACCB]">Contenus récents à valider avant publication.</p>
          </div>
          <NuxtLink to="/content" class="text-sm font-bold text-[#F6B37A] transition-colors hover:text-[#FFD6AF]">Voir tout</NuxtLink>
        </div>

        <div class="max-h-[34rem] space-y-3 overflow-y-auto pr-1">
          <article
            v-for="content in dashboard.pendingContents"
            :key="content.id"
            class="flex flex-col gap-3 overflow-hidden rounded-[16px] border border-white/10 bg-white/5 p-3 transition-all duration-150 hover:border-[#E8873A]/55 hover:bg-white/10 sm:flex-row sm:items-center"
          >
            <div class="flex h-44 w-full shrink-0 items-center justify-center overflow-hidden rounded-[14px] bg-[#121B29] sm:h-16 sm:w-16">
              <img v-if="content.imageUrl && !isVideoContent(content)" :src="content.imageUrl" class="h-full w-full object-cover" alt="Aperçu" />
              <video v-else-if="content.imageUrl" :src="content.imageUrl" class="h-full w-full object-cover" muted playsinline preload="metadata" />
              <span v-else class="text-xs font-bold text-[#9CABCB]">{{ content.format }}</span>
            </div>
            <div class="min-w-0 w-full flex-1">
              <div class="flex flex-wrap items-center gap-2">
                <span class="rounded-full bg-[#F4B27A]/18 px-2 py-1 text-[11px] font-bold text-[#F5B879]">{{ content.format }}</span>
                <span class="text-xs text-[#8F9DB9]">{{ timeAgo(content.createdAt) }}</span>
              </div>
              <p class="mt-1 truncate text-sm font-semibold text-[#F6F8FD]">{{ content.influencer?.name }}</p>
              <p class="truncate text-xs text-[#AAB6CF]">{{ content.caption || 'Contenu sans caption' }}</p>
            </div>
            <div class="flex w-full shrink-0 items-center gap-2 sm:w-auto">
              <button class="flex-1 rounded-[12px] bg-[#E8873A] px-3 py-2 text-xs font-black text-[#1A0F06] transition-colors duration-150 hover:bg-[#f09d55] sm:flex-none" @click="validateContent(content.id)">
                ✓ Valider
              </button>
              <button class="flex-1 rounded-[12px] border border-white/15 bg-white/5 px-3 py-2 text-xs font-bold text-[#E8ECF7] transition-colors duration-150 hover:bg-white/10 sm:flex-none" @click="removeContent(content.id)">
                ✗ Supprimer
              </button>
            </div>
          </article>
        </div>
      </section>

      <div class="space-y-4 xl:col-span-4">
        <section class="rounded-[22px] border border-white/10 bg-[linear-gradient(165deg,rgba(16,23,35,0.96),rgba(10,14,22,0.98))] p-5 shadow-[0_18px_44px_rgba(0,0,0,0.35)]">
          <h2 class="text-lg font-bold text-white">Influenceuses actives</h2>
          <div class="mt-4 space-y-3">
            <article
              v-for="influencer in dashboard.influencers"
              :key="influencer.id"
              class="rounded-[16px] border border-white/10 bg-white/5 p-4 transition-all duration-150 hover:border-[#E8873A]/45 hover:bg-white/10"
            >
              <div class="flex items-start justify-between gap-3">
                <div>
                  <h3 class="text-sm font-bold text-[#F4F7FD]">{{ influencer.name }}</h3>
                  <p class="mt-1 text-xs text-[#9CABCB]">{{ summarizeNiches(influencer.niche) || 'Sans niche' }}</p>
                </div>
                <span class="rounded-full bg-[#F4B27A]/18 px-2 py-1 text-[11px] font-bold text-[#F5B879]">{{ influencer._count.generatedContents }} contenus</span>
              </div>
              <div class="mt-4 flex gap-2">
                <NuxtLink
                  :to="`/influencers/${influencer.id}/generate`"
                  class="inline-flex rounded-[12px] bg-[#E8873A] px-3 py-2 text-xs font-black text-[#1A0F06] transition-colors duration-150 hover:bg-[#f09d55]"
                >
                  Générer
                </NuxtLink>
                <NuxtLink
                  :to="`/influencers/${influencer.id}`"
                  class="inline-flex rounded-[12px] border border-white/15 bg-white/5 px-3 py-2 text-xs font-bold text-[#E6EBF8] transition-colors duration-150 hover:bg-white/10"
                >
                  Contenu
                </NuxtLink>
              </div>
            </article>
          </div>
        </section>

        <section class="overflow-hidden rounded-[22px] border border-[#E8873A]/30 bg-[linear-gradient(160deg,rgba(232,135,58,0.18),rgba(16,23,35,0.9)_54%)] p-5 shadow-[0_18px_44px_rgba(0,0,0,0.35)]">
          <p class="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#FFD0A3]">Production</p>
          <p class="mt-3 text-3xl font-black text-white">{{ stats[0].value }}</p>
          <p class="mt-1 text-sm text-[#F8D5B6]">contenus générés au total</p>
          <div class="mt-4 grid grid-cols-2 gap-2 text-xs">
            <div class="rounded-[12px] border border-white/20 bg-black/15 p-3">
              <p class="text-[#F8D5B6]">Publiés</p>
              <p class="mt-1 text-lg font-black text-white">{{ stats[1].value }}</p>
            </div>
            <div class="rounded-[12px] border border-white/20 bg-black/15 p-3">
              <p class="text-[#F8D5B6]">En attente</p>
              <p class="mt-1 text-lg font-black text-white">{{ stats[2].value }}</p>
            </div>
          </div>
        </section>
      </div>
    </div>

    <section class="rounded-[22px] border border-white/10 bg-[linear-gradient(165deg,rgba(16,23,35,0.96),rgba(10,14,22,0.98))] p-5 shadow-[0_18px_44px_rgba(0,0,0,0.35)]">
      <div class="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 class="text-lg font-bold text-white">Prochaines publications</h2>
          <p class="text-sm text-[#9CACCB]">Les 5 prochains créneaux planifiés.</p>
        </div>
      </div>

      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <article
          v-for="item in dashboard.upcomingContents"
          :key="item.id"
          class="rounded-[16px] border border-white/10 bg-white/5 p-4"
        >
          <div class="flex items-center justify-between gap-2">
            <span class="rounded-full bg-[#F4B27A]/18 px-2 py-1 text-[11px] font-bold text-[#F5B879]">{{ item.format }}</span>
            <span class="text-xs text-[#8F9DB9]">{{ formatDate(item.scheduledAt) }}</span>
          </div>
          <p class="mt-3 text-sm font-bold text-[#F2F6FE]">{{ item.influencer?.name }}</p>
          <p class="mt-1 line-clamp-3 text-xs text-[#AAB6CF]">{{ item.caption || 'Publication planifiée sans caption' }}</p>
        </article>
      </div>
    </section>
  </div>
</template>

<script setup>
const activeInfluencerId = useActiveInfluencer()

const { data, pending: loading, refresh } = await useFetch('/api/dashboard', {
  key: 'plotline-dashboard',
})
const { pushToast } = useUiFeedback()
const dashboard = computed(() => data.value || {
  influencers: [],
  pendingContents: [],
  upcomingContents: [],
  stats: {},
})

const activeGenerateHref = computed(() => {
  const firstInfluencer = data.value?.influencers?.[0]
  const influencerId = activeInfluencerId.value || firstInfluencer?.id
  return influencerId ? `/influencers/${influencerId}/generate` : '/influencers/new'
})

const stats = computed(() => {
  const summary = data.value?.stats || {}
  return [
    { label: 'Contenus générés', value: summary.totalGenerated || 0 },
    { label: 'Contenus publiés', value: summary.publishedCount || 0 },
    { label: 'En attente', value: summary.pendingCount || 0 },
  ]
})

const kpiCards = computed(() => {
  const summary = data.value?.stats || {}
  const influencerCount = data.value?.influencers?.length || 0

  return [
    {
      label: 'Contenus',
      value: summary.totalGenerated || 0,
      delta: '+12%',
      toneClass: 'bg-emerald-500/20 text-emerald-300',
    },
    {
      label: 'Publiés',
      value: summary.publishedCount || 0,
      delta: '+8%',
      toneClass: 'bg-sky-500/20 text-sky-300',
    },
    {
      label: 'En attente',
      value: summary.pendingCount || 0,
      delta: 'Live',
      toneClass: 'bg-amber-500/20 text-amber-200',
    },
    {
      label: 'Influenceuses',
      value: influencerCount,
      delta: 'Actives',
      toneClass: 'bg-cyan-500/20 text-cyan-300',
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
