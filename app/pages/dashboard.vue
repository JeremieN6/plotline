<template>
  <div class="space-y-5 text-[#F2F5FD]">
    <header class="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
      <h1 class="text-2xl font-bold text-white">Home</h1>
      <div class="flex items-center gap-2">
        <button type="button" class="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/5 text-[#DDE3F3] hover:bg-white/10">
          <Icon name="lucide:bell" class="h-4 w-4" />
          <span class="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-[#ff7a7a]" />
        </button>
        <NuxtLink
          :to="activeGenerateHref"
          class="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#74d68f] text-[#072111] shadow-[0_8px_22px_rgba(116,214,143,0.35)] transition-transform hover:scale-105"
        >
          <Icon name="lucide:plus" class="h-4 w-4" />
        </NuxtLink>
      </div>
    </header>

    <div class="flex flex-wrap items-center gap-2 border-b border-white/10 pb-4">
      <button type="button" class="inline-flex items-center gap-2 rounded-[10px] border border-white/15 bg-white/5 px-3 py-2 text-sm text-[#DDE3F3] hover:bg-white/10">
        <Icon name="lucide:calendar" class="h-4 w-4" />
        <span>Jun 24, 2026 - Jul 8, 2026</span>
      </button>
      <button type="button" class="inline-flex items-center gap-2 rounded-[10px] border border-white/15 bg-white/5 px-3 py-2 text-sm text-[#DDE3F3] hover:bg-white/10">
        <span>Daily</span>
        <Icon name="lucide:chevron-down" class="h-4 w-4" />
      </button>
    </div>

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
      <section class="rounded-[22px] border border-white/10 bg-[linear-gradient(165deg,rgba(16,23,35,0.96),rgba(10,14,22,0.98))] p-5 shadow-[0_18px_44px_rgba(0,0,0,0.35)] xl:col-span-9">
        <div>
          <p class="text-xs uppercase text-[#8F9DB9]">Revenue</p>
          <p class="mt-1 text-5xl font-semibold tracking-tight text-white">{{ formatCurrency(chartTotal) }}</p>
        </div>

        <div class="mt-4 h-[22rem] overflow-hidden rounded-[14px] border border-white/10 bg-[#0d1320] p-3">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" class="h-full w-full">
            <defs>
              <linearGradient id="plotlineArea" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stop-color="#74d68f" stop-opacity="0.35" />
                <stop offset="100%" stop-color="#74d68f" stop-opacity="0.03" />
              </linearGradient>
            </defs>
            <g stroke="rgba(255,255,255,0.07)" stroke-width="0.25">
              <line v-for="y in 6" :key="`y-${y}`" x1="0" :y1="(y - 1) * 20" x2="100" :y2="(y - 1) * 20" />
              <line v-for="x in 12" :key="`x-${x}`" :x1="(x - 1) * 9.09" y1="0" :x2="(x - 1) * 9.09" y2="100" />
            </g>
            <polygon :points="chartAreaPoints" fill="url(#plotlineArea)" />
            <polyline :points="chartLinePoints" fill="none" stroke="#74d68f" stroke-width="0.8" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </div>
      </section>

      <div class="space-y-4 xl:col-span-3">
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
        <section class="rounded-[22px] border border-white/10 bg-[linear-gradient(165deg,rgba(16,23,35,0.96),rgba(10,14,22,0.98))] p-5 shadow-[0_18px_44px_rgba(0,0,0,0.35)]">
          <div class="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 class="text-lg font-bold text-white">En attente</h2>
              <p class="text-sm text-[#9CACCB]">Validation rapide.</p>
            </div>
            <NuxtLink to="/content" class="text-sm font-bold text-[#F6B37A]">Voir tout</NuxtLink>
          </div>
          <div class="space-y-2">
            <article v-for="content in dashboard.pendingContents.slice(0, 4)" :key="content.id" class="rounded-[12px] border border-white/10 bg-white/5 p-3">
              <p class="text-xs font-semibold text-[#F5B879]">{{ content.format }}</p>
              <p class="mt-1 truncate text-sm text-white">{{ content.influencer?.name }}</p>
              <p class="text-xs text-[#9CACCB]">{{ timeAgo(content.createdAt) }}</p>
            </article>
          </div>
        </section>
      </div>
    </div>

    <section class="rounded-[22px] border border-white/10 bg-[linear-gradient(165deg,rgba(16,23,35,0.96),rgba(10,14,22,0.98))] p-5 shadow-[0_18px_44px_rgba(0,0,0,0.35)]">
      <div class="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 class="text-lg font-bold text-white">Revenue</h2>
          <p class="text-sm text-[#9CACCB]">Dernières lignes de vente simulées.</p>
        </div>
      </div>

      <div class="overflow-hidden rounded-[14px] border border-white/10">
        <table class="w-full table-fixed border-collapse text-sm">
          <thead class="bg-white/5 text-left text-xs uppercase tracking-[0.08em] text-[#8F9DB9]">
            <tr>
              <th class="px-3 py-2">ID</th>
              <th class="px-3 py-2">Date</th>
              <th class="px-3 py-2">Status</th>
              <th class="px-3 py-2">Email</th>
              <th class="px-3 py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in salesRows" :key="row.id" class="border-t border-white/10 text-[#DBE3F4]">
              <td class="px-3 py-2">#{{ row.id }}</td>
              <td class="px-3 py-2">{{ row.date }}</td>
              <td class="px-3 py-2">
                <span class="rounded-full px-2 py-0.5 text-xs font-semibold" :class="statusClass(row.status)">
                  {{ row.status }}
                </span>
              </td>
              <td class="truncate px-3 py-2">{{ row.email }}</td>
              <td class="px-3 py-2 text-right font-semibold">{{ row.amount }}</td>
            </tr>
          </tbody>
        </table>
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

const chartSeries = computed(() => {
  const total = Number(data.value?.stats?.totalGenerated || 0)
  const pending = Number(data.value?.stats?.pendingCount || 0)
  const published = Number(data.value?.stats?.publishedCount || 0)
  const seed = Math.max(8, total + pending + published)

  return [
    Math.max(12, seed * 0.35),
    Math.max(18, seed * 0.6),
    Math.max(16, seed * 0.5),
    Math.max(20, seed * 0.68),
    Math.max(22, seed * 0.74),
    Math.max(19, seed * 0.55),
    Math.max(17, seed * 0.5),
    Math.max(21, seed * 0.72),
    Math.max(26, seed * 0.9),
    Math.max(22, seed * 0.66),
  ]
})

const chartTotal = computed(() => {
  return chartSeries.value.reduce((sum, value) => sum + value, 0) * 1250
})

const chartLinePoints = computed(() => {
  const points = chartSeries.value
  const max = Math.max(...points, 1)
  const stepX = 100 / (points.length - 1)

  return points
    .map((value, index) => {
      const x = Number((index * stepX).toFixed(2))
      const y = Number((100 - (value / max) * 88).toFixed(2))
      return `${x},${y}`
    })
    .join(' ')
})

const chartAreaPoints = computed(() => {
  return `0,100 ${chartLinePoints.value} 100,100`
})

const salesRows = computed(() => {
  const pool = [...(dashboard.value.pendingContents || []), ...(dashboard.value.upcomingContents || [])]
  const top = pool.slice(0, 6)

  return top.map((item, index) => {
    const status = index % 5 === 0 ? 'refunded' : index % 3 === 0 ? 'failed' : 'paid'

    return {
      id: String(4600 - index),
      date: formatDate(item.createdAt || item.scheduledAt),
      status,
      email: `${String(item.influencer?.name || 'creator').toLowerCase().replace(/\s+/g, '.')}@plotline.app`,
      amount: formatCurrency(180 + index * 77),
    }
  })
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
  return new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(dateValue))
}

function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Number(value || 0))
}

function statusClass(status) {
  if (status === 'paid') {
    return 'bg-emerald-500/20 text-emerald-300'
  }
  if (status === 'failed') {
    return 'bg-red-500/20 text-red-300'
  }
  return 'bg-zinc-500/25 text-zinc-200'
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
