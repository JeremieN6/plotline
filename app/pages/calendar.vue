<template>
  <div class="space-y-6">
    <header class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p class="text-xs font-semibold uppercase tracking-[0.22em] text-[#E8873A]">Calendrier</p>
        <h1 class="mt-2 text-3xl font-bold tracking-tight text-[#111111]">Vue mensuelle</h1>
        <p class="mt-2 text-sm text-[#666666]">Suivi des contenus planifiés sur le mois sélectionné.</p>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <button class="rounded-[12px] border border-[#E5E3DF] bg-white px-3 py-2 text-sm font-semibold text-[#111111] transition-colors duration-150 hover:bg-[#FAFAF8]" @click="changeMonth(-1)">← Mois précédent</button>
        <button class="rounded-[12px] border border-[#E5E3DF] bg-white px-3 py-2 text-sm font-semibold text-[#111111] transition-colors duration-150 hover:bg-[#FAFAF8]" @click="changeMonth(1)">Mois suivant →</button>
      </div>
    </header>

    <section class="rounded-[20px] border border-[#E5E3DF] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
      <div class="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 class="text-lg font-bold text-[#111111]">{{ monthLabel }}</h2>
          <p class="text-sm text-[#666666]">Les contenus planifiés apparaissent sur leur jour de publication.</p>
        </div>
        <div class="flex flex-wrap gap-3 text-xs font-semibold text-[#666666]">
          <span class="flex items-center gap-2"><span class="h-2.5 w-2.5 rounded-full bg-[#E8873A]" />Feed</span>
          <span class="flex items-center gap-2"><span class="h-2.5 w-2.5 rounded-full bg-[#8B5CF6]" />Reel</span>
          <span class="flex items-center gap-2"><span class="h-2.5 w-2.5 rounded-full bg-emerald-500" />Story</span>
        </div>
      </div>

      <div v-if="loading" class="overflow-x-auto pb-2">
        <div class="grid min-w-[720px] grid-cols-7 gap-2">
          <div v-for="n in 35" :key="n" class="h-28 animate-pulse rounded-[14px] border border-[#E5E3DF] bg-[#FAFAF8]" />
        </div>
      </div>

      <div v-else class="overflow-x-auto pb-2">
        <div class="grid min-w-[720px] grid-cols-7 gap-2">
          <div v-for="day in weekLabels" :key="day" class="px-2 py-1 text-xs font-bold uppercase tracking-[0.12em] text-[#666666]">{{ day }}</div>
          <button
            v-for="cell in calendarCells"
            :key="cell.key"
            type="button"
            class="group flex min-h-[7.5rem] flex-col rounded-[14px] border border-[#E5E3DF] bg-[#FAFAF8] p-2 text-left transition-all duration-150 hover:border-[#E8873A]/35 hover:bg-white"
            :class="cell.isCurrentMonth ? '' : 'opacity-45'"
          >
            <div class="flex items-center justify-between gap-2 text-xs font-semibold text-[#666666]">
              <span>{{ cell.day }}</span>
            </div>
            <div class="mt-2 flex flex-1 flex-col gap-2 overflow-hidden">
              <button
                v-for="content in cell.items"
                :key="content.id"
                type="button"
                class="rounded-[12px] px-2 py-1.5 text-left text-[11px] font-bold text-white shadow-sm transition-opacity duration-150 hover:opacity-90"
                :class="formatClass(content.format)"
                @click.stop="openDrawer(content)"
              >
                <span class="block truncate">{{ content.influencer?.name }}</span>
                <span class="block truncate font-medium opacity-80">{{ content.caption || 'Sans caption' }}</span>
              </button>
            </div>
          </button>
        </div>
      </div>
    </section>

    <Teleport to="body">
      <div v-if="drawerContent" class="fixed inset-0 z-50 bg-black/35" @click.self="drawerContent = null">
        <aside class="absolute right-0 top-0 flex h-full w-full max-w-[460px] flex-col overflow-y-auto border-l border-[#E5E3DF] bg-white p-5 shadow-2xl">
          <div class="mb-5 flex items-start justify-between gap-4">
            <div>
              <p class="text-xs font-semibold uppercase tracking-[0.22em] text-[#E8873A]">Détail</p>
              <h2 class="mt-2 text-2xl font-bold text-[#111111]">{{ drawerContent.influencer?.name }}</h2>
              <p class="mt-1 text-sm text-[#666666]">{{ formatLabel(drawerContent.format) }} · {{ formatDate(drawerContent.scheduledAt) }}</p>
            </div>
            <button class="rounded-full border border-[#E5E3DF] bg-white px-3 py-1.5 text-sm font-bold text-[#111111]" @click="drawerContent = null">✕</button>
          </div>

          <div class="overflow-hidden rounded-[18px] border border-[#E5E3DF] bg-[#FAFAF8]">
            <img v-if="drawerContent.imageUrl && !isVideoContent(drawerContent)" :src="drawerContent.imageUrl" class="h-72 w-full object-cover" alt="Aperçu" />
            <video v-else-if="drawerContent.imageUrl" :src="drawerContent.imageUrl" class="h-72 w-full object-cover" muted playsinline controls />
            <div v-else class="flex h-72 items-center justify-center text-sm text-[#666666]">Aperçu indisponible</div>
          </div>

          <div class="mt-5 space-y-3">
            <p class="rounded-[14px] border border-[#E5E3DF] bg-[#FAFAF8] p-4 text-sm leading-6 text-[#111111]">{{ drawerContent.caption || 'Aucune caption.' }}</p>
            <div class="flex gap-2">
              <button class="flex-1 rounded-[12px] bg-[#E8873A] px-4 py-3 text-sm font-bold text-white transition-colors duration-150 hover:bg-[#d4762f]" @click="scheduleForToday(drawerContent)">Reprogrammer</button>
              <button class="flex-1 rounded-[12px] border border-[#E5E3DF] bg-white px-4 py-3 text-sm font-bold text-[#111111] transition-colors duration-150 hover:bg-[#FAFAF8]" @click="drawerContent = null">Fermer</button>
            </div>
          </div>
        </aside>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'

const activeInfluencerId = useActiveInfluencer()
const { formatLabel } = useWording()
const currentMonth = ref(new Date())
const drawerContent = ref(null)
const weekLabels = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

const { data, pending: loading, refresh } = await useFetch('/api/influencers', {
  key: 'plotline-calendar-source',
})

const selectedInfluencer = computed(() => {
  return data.value?.find((item) => item.id === activeInfluencerId.value) || data.value?.[0] || null
})

const contents = ref([])

watch(
  selectedInfluencer,
  async (value) => {
    if (!value) {
      contents.value = []
      return
    }

    const response = await $fetch(`/api/influencers/${value.id}/content?statuses=PENDING,VALIDATED,PUBLISHED,PROCESSING`)
    contents.value = response.contents || []
  },
  { immediate: true },
)

const monthLabel = computed(() => {
  return new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(currentMonth.value)
})

const calendarCells = computed(() => buildCalendarCells(currentMonth.value, contents.value))

function isVideoContent(content) {
  const format = String(content?.format || '').toUpperCase()
  return format === 'REEL' || format === 'STORY' || String(content?.imageUrl || '').toLowerCase().endsWith('.mp4')
}

function formatClass(format) {
  const normalized = String(format || '').toUpperCase()
  if (normalized === 'REEL') return 'bg-[#8B5CF6]'
  if (normalized === 'STORY') return 'bg-emerald-500'
  return 'bg-[#E8873A]'
}

function formatDate(dateValue) {
  if (!dateValue) return '—'
  return new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: '2-digit', month: 'long' }).format(new Date(dateValue))
}

function changeMonth(delta) {
  const next = new Date(currentMonth.value)
  next.setMonth(next.getMonth() + delta)
  currentMonth.value = next
}

function openDrawer(content) {
  drawerContent.value = content
}

async function scheduleForToday(content) {
  const now = new Date()
  await $fetch(`/api/content/${content.id}/schedule`, {
    method: 'PATCH',
    body: {
      scheduledAt: now.toISOString(),
    },
  })
  content.scheduledAt = now.toISOString()
  drawerContent.value = null
}

function buildCalendarCells(monthDate, items) {
  const start = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1)
  const end = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0)
  const firstWeekday = (start.getDay() + 6) % 7
  const totalDays = end.getDate()
  const cells = []

  for (let i = 0; i < firstWeekday; i += 1) {
    cells.push({ key: `pad-${i}`, day: '', items: [], isCurrentMonth: false })
  }

  for (let day = 1; day <= totalDays; day += 1) {
    const date = new Date(monthDate.getFullYear(), monthDate.getMonth(), day)
    const itemsForDay = (items || []).filter((item) => isSameDay(item.scheduledAt, date))
    cells.push({
      key: `${monthDate.getFullYear()}-${monthDate.getMonth()}-${day}`,
      day,
      items: itemsForDay,
      isCurrentMonth: true,
    })
  }

  while (cells.length % 7 !== 0) {
    cells.push({ key: `tail-${cells.length}`, day: '', items: [], isCurrentMonth: false })
  }

  return cells
}

function isSameDay(dateValue, date) {
  if (!dateValue) return false
  const left = new Date(dateValue)
  return left.getFullYear() === date.getFullYear()
    && left.getMonth() === date.getMonth()
    && left.getDate() === date.getDate()
}
</script>
