<template>
  <div class="space-y-5 pb-20 font-ui md:pb-0">
    <!-- En-tête : un seul titre, la navigation de mois à côté, l'unique action principale à droite. -->
    <header class="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div>
        <p class="text-xs font-semibold uppercase tracking-[0.08em] text-ui-accent">Calendrier</p>
        <div class="mt-1 flex flex-wrap items-center gap-3">
          <h1 class="text-2xl font-bold capitalize tracking-[-0.01em] text-ui-ink">{{ monthLabel }}</h1>
          <div class="flex items-center gap-2">
            <UiIconButton label="Mois précédent" @click="changeMonth(-1)">
              <svg class="h-4 w-4" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m10 3.5-4.5 4.5L10 12.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg>
            </UiIconButton>
            <UiIconButton label="Mois suivant" @click="changeMonth(1)">
              <svg class="h-4 w-4" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m6 3.5 4.5 4.5L6 12.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg>
            </UiIconButton>
            <UiButton size="sm" @click="goToday">Aujourd'hui</UiButton>
          </div>
        </div>
      </div>

      <UiButton class="hidden md:inline-flex" variant="primary" @click="openPlanDrawer()">Planifier une période</UiButton>
    </header>

    <!-- Résumé du mois -->
    <div v-if="!pageLoading" class="space-y-2">
      <p class="text-sm text-ui-ink-2">
        <template v-if="summary.total">
          {{ summary.total }} contenu{{ summary.total > 1 ? 's' : '' }} planifié{{ summary.total > 1 ? 's' : '' }}
          <template v-for="type in typeList" :key="type.key">
            <template v-if="summary[type.key]"> · {{ summary[type.key] }} {{ type.label.toLowerCase() }}{{ summary[type.key] > 1 ? 's' : '' }}</template>
          </template>
        </template>
        <template v-else>Aucun contenu planifié ce mois-ci.</template>
      </p>
      <div v-if="target" class="max-w-md">
        <p class="mb-1.5 text-xs text-ui-ink-muted">Cadence visée : {{ cadence }} publication{{ cadence > 1 ? 's' : '' }} / semaine</p>
        <UiProgress :value="Math.min(summary.total, target)" :max="target" label="Objectif du mois" />
      </div>
    </div>

    <!-- Trou à venir dans le planning -->
    <UiAlert v-if="gap && selectedInfluencer && !pageLoading" tone="info">
      Rien de planifié du {{ gap.start.getDate() }} au {{ gap.end.getDate() }} {{ gapMonthLabel }}.
      <template #action>
        <UiButton size="sm" @click="openPlanDrawer({ start: gap.start, days: presetDays(gap.days) })">Préparer un plan</UiButton>
      </template>
    </UiAlert>

    <UiSkeleton v-if="pageLoading" :lines="6" />

    <template v-else>
      <!-- Légende -->
      <ul class="flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-ui-ink-2" aria-label="Légende des types de contenu">
        <li v-for="type in typeList" :key="type.key" class="flex items-center gap-2">
          <span class="h-2.5 w-2.5 rounded-full" :class="type.dot" aria-hidden="true" />{{ type.label }}
        </li>
        <li class="flex items-center gap-2 text-ui-ink-muted"><span class="h-3 w-5 rounded-[4px] border border-dashed border-ui-ink-muted" aria-hidden="true" />Brouillon</li>
      </ul>

      <!-- Grille (bureau) : une seule carte, filets fins ; les semaines vides sont plus basses. -->
      <UiCard class="hidden overflow-hidden md:block">
        <div class="-m-5">
          <div
            ref="gridRef"
            role="grid"
            :aria-label="`Calendrier de ${monthLabel}`"
            class="bg-ui-line-soft"
            @keydown="onGridKeydown"
          >
            <div role="row" class="grid grid-cols-7 gap-px">
              <div v-for="label in weekLabels" :key="label" role="columnheader" class="bg-ui-surface px-2 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-ui-ink-muted">{{ label }}</div>
            </div>
            <div v-for="week in weeks" :key="week.key" role="row" class="mt-px grid grid-cols-7 gap-px">
              <div
                v-for="cell in week.cells"
                :key="cell.key"
                role="gridcell"
                :aria-hidden="cell.inMonth ? undefined : 'true'"
                :aria-label="cell.inMonth ? cellLabel(cell) : undefined"
                :tabindex="cell.inMonth && cell.index === focusIndex ? 0 : -1"
                :data-index="cell.index"
                class="group relative flex flex-col gap-1 p-1.5 text-left focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-ui-accent/40"
                :class="[
                  !cell.inMonth ? 'bg-ui-subtle' : cell.isPast ? 'bg-ui-subtle/60' : 'bg-ui-surface',
                  week.hasItems ? 'min-h-[132px]' : 'min-h-[72px]',
                  cell.inMonth && (cell.items.length || cell.isFuture) ? 'cursor-pointer' : '',
                ]"
                @click="onCellClick(cell)"
                @focus="cell.inMonth && (focusIndex = cell.index)"
                @keydown.enter.self.prevent="activateCell(cell)"
                @keydown.space.self.prevent="activateCell(cell)"
              >
                <div v-if="cell.inMonth" class="flex items-center justify-between">
                  <span
                    class="inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-semibold"
                    :class="cell.isToday ? 'bg-ui-accent text-white' : cell.isPast ? 'text-ui-ink-muted' : 'text-ui-ink'"
                  >{{ cell.day }}</span>
                  <button
                    v-if="cell.isFuture && !cell.items.length && selectedInfluencer"
                    type="button"
                    class="rounded-ui-tag px-1.5 py-1 text-[11px] font-semibold text-ui-accent opacity-0 transition-opacity hover:bg-ui-accent-soft focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ui-accent/20 group-hover:opacity-100"
                    :aria-label="`Ajouter un contenu le ${dayLabel(cell.date)}`"
                    @click.stop="openPlanDrawer({ start: cell.date })"
                  >+ Ajouter</button>
                </div>

                <div v-if="cell.items.length" class="flex min-w-0 flex-col gap-1">
                  <button
                    v-for="entry in cell.items.slice(0, MAX_CHIPS)"
                    :key="entry.id"
                    type="button"
                    class="flex w-full min-w-0 items-center gap-1.5 rounded-ui-tag border bg-ui-surface px-1.5 py-1 text-left text-[11px] leading-4 text-ui-ink-2 transition-colors hover:bg-ui-subtle focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ui-accent/20"
                    :class="[contentStatusOf(entry.status).outline, entry.id === highlightId ? 'border-ui-accent ring-2 ring-ui-accent/40' : 'border-ui-line-input']"
                    :aria-label="entryLabel(entry)"
                    @click.stop="openEntry(entry)"
                  >
                    <span class="h-2 w-2 shrink-0 rounded-full" :class="contentTypeOf(entry.format).dot" aria-hidden="true" />
                    <svg v-if="entry.status === 'generating'" class="h-3 w-3 shrink-0 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-opacity="0.25" stroke-width="3" /><path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" stroke-width="3" stroke-linecap="round" /></svg>
                    <svg v-else-if="entry.status === 'published'" class="h-3 w-3 shrink-0 text-ui-success" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="m2.5 6.5 2.2 2.2L9.5 3.8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg>
                    <span class="shrink-0 font-ui-mono font-medium text-ui-ink">{{ timeLabel(entry.scheduledAt) }}</span>
                    <span class="min-w-0 truncate">{{ entry.captionText || 'Sans légende' }}</span>
                  </button>
                  <button
                    v-if="cell.items.length > MAX_CHIPS"
                    type="button"
                    class="rounded-ui-tag px-1.5 py-1 text-left text-[11px] font-semibold text-ui-ink-2 hover:bg-ui-subtle focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ui-accent/20"
                    :aria-label="`Voir les ${cell.items.length} contenus du ${dayLabel(cell.date)}`"
                    @click.stop="openDay(cell)"
                  >+{{ cell.items.length - MAX_CHIPS }}</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </UiCard>

      <!-- Liste par jour (mobile) : seuls les jours qui ont du contenu. -->
      <div class="md:hidden">
        <UiEmptyState v-if="!mobileDays.length" title="Rien de planifié ce mois-ci" text="Prépare un plan pour que Claude propose des idées datées.">
          <template #action>
            <UiButton size="sm" @click="openPlanDrawer()">Planifier une période</UiButton>
          </template>
        </UiEmptyState>
        <ol v-else class="space-y-4">
          <li v-for="day in mobileDays" :key="day.key">
            <h2 class="mb-1.5 flex items-center gap-2 text-sm font-semibold" :class="day.isToday ? 'text-ui-accent' : 'text-ui-ink'">
              <span class="inline-block first-letter:uppercase">{{ dayLabel(day.date) }}</span>
              <span v-if="day.isToday" class="rounded-full bg-ui-accent-soft px-2 py-0.5 text-xs text-ui-accent-ink">Aujourd'hui</span>
            </h2>
            <ul class="space-y-1.5">
              <li v-for="entry in day.items" :key="entry.id">
                <button
                  type="button"
                  class="flex min-h-11 w-full items-center gap-2 rounded-ui-ctl border bg-ui-surface px-3 py-2 text-left text-sm text-ui-ink-2 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ui-accent/20"
                  :class="[contentStatusOf(entry.status).outline, entry.id === highlightId ? 'border-ui-accent ring-2 ring-ui-accent/40' : 'border-ui-line-input']"
                  :aria-label="entryLabel(entry)"
                  @click="openEntry(entry)"
                >
                  <span class="h-2.5 w-2.5 shrink-0 rounded-full" :class="contentTypeOf(entry.format).dot" aria-hidden="true" />
                  <span class="shrink-0 font-ui-mono text-xs font-medium text-ui-ink">{{ timeLabel(entry.scheduledAt) }}</span>
                  <span class="min-w-0 flex-1 truncate">{{ entry.captionText || 'Sans légende' }}</span>
                  <UiBadge :status="entry.status" />
                </button>
              </li>
            </ul>
          </li>
        </ol>
      </div>
    </template>

    <!-- Bouton principal en bas de l'écran sur mobile -->
    <div class="fixed inset-x-4 bottom-4 z-30 md:hidden">
      <UiButton class="w-full shadow-lg" variant="primary" @click="openPlanDrawer()">Planifier une période</UiButton>
    </div>

    <!-- Panneau latéral : détail d'un contenu, liste d'un jour, ou préparation d'un plan -->
    <UiDrawer v-model:open="drawerOpen" :title="drawerTitle" :description="drawerDescription" @close="drawerMode = ''">
      <!-- Détail d'un contenu -->
      <div v-if="drawerMode === 'detail' && current" class="space-y-4">
        <div class="flex flex-wrap items-center gap-2">
          <UiBadge :type="contentTypeOf(current.format).key" />
          <UiBadge :status="current.status" />
        </div>

        <div v-if="current.imageUrl" class="overflow-hidden rounded-ui-ctl border border-ui-line bg-ui-subtle">
          <video v-if="isVideo(current)" :src="current.imageUrl" class="h-56 w-full object-cover" muted playsinline controls />
          <img v-else :src="current.imageUrl" class="h-56 w-full object-cover" alt="Aperçu du contenu">
        </div>

        <section>
          <h3 class="text-[13px] font-semibold text-ui-ink">Légende</h3>
          <p class="mt-1.5 whitespace-pre-line rounded-ui-ctl bg-ui-subtle p-3 text-sm leading-6 text-ui-ink">{{ current.captionText || 'Aucune légende.' }}</p>
        </section>

        <section v-if="current.hashtags.length">
          <h3 class="text-[13px] font-semibold text-ui-ink">Hashtags</h3>
          <ul class="mt-1.5 flex flex-wrap gap-2">
            <li v-for="tag in current.hashtags" :key="tag" class="rounded-full bg-ui-subtle px-3 py-1 text-sm text-ui-ink">{{ tag }}</li>
          </ul>
        </section>

        <UiAlert v-if="actionError" title="Action impossible">{{ actionError }}</UiAlert>
      </div>

      <!-- Liste d'un jour -->
      <div v-else-if="drawerMode === 'day' && dayCell" class="space-y-3">
        <ul class="space-y-2">
          <li v-for="entry in dayCell.items" :key="entry.id">
            <button
              type="button"
              class="flex min-h-11 w-full items-center gap-2 rounded-ui-ctl border bg-ui-surface px-3 py-2 text-left text-sm text-ui-ink-2 hover:bg-ui-subtle focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ui-accent/20"
              :class="[contentStatusOf(entry.status).outline, 'border-ui-line-input']"
              @click="openEntry(entry)"
            >
              <span class="h-2.5 w-2.5 shrink-0 rounded-full" :class="contentTypeOf(entry.format).dot" aria-hidden="true" />
              <span class="shrink-0 font-ui-mono text-xs font-medium text-ui-ink">{{ timeLabel(entry.scheduledAt) }}</span>
              <span class="min-w-0 flex-1 truncate">{{ entry.captionText || 'Sans légende' }}</span>
              <UiBadge :status="entry.status" />
            </button>
          </li>
        </ul>
        <UiButton v-if="dayCell.isFuture && selectedInfluencer" @click="openPlanDrawer({ start: dayCell.date })">+ Ajouter un contenu ce jour</UiButton>
      </div>

      <!-- Préparer un plan (aussi : « Ajouter » sur un jour vide) -->
      <div v-else-if="drawerMode === 'plan'" class="space-y-4">
        <p class="text-sm text-ui-ink-2">
          Claude propose des idées datées selon la cadence du profil. Tu les relis avant qu'aucun média ne soit produit.
        </p>
        <UiField label="Début de la période" for-id="plan-start">
          <UiInput id="plan-start" v-model="planStart" type="date" data-autofocus />
        </UiField>
        <UiField label="Durée">
          <UiSegmented v-model="planDays" label="Durée du plan" :options="PLAN_DURATIONS" />
        </UiField>
        <UiAlert v-if="planError" title="Préparation impossible">{{ planError }}</UiAlert>
        <p v-else-if="!selectedInfluencer" class="text-sm text-ui-ink-muted">Sélectionne un profil actif pour préparer un plan.</p>
      </div>

      <template #footer>
        <div v-if="drawerMode === 'detail' && current" class="flex flex-wrap justify-end gap-2">
          <UiButton v-if="current.planId" @click="goToPlan(current)">Ouvrir dans le plan</UiButton>
          <UiButton v-else @click="goToCreations">Ouvrir dans Mes créations</UiButton>
          <UiDatePopover
            v-if="canReschedule(current)"
            :model-value="toIso(current.scheduledAt)"
            label="Date de publication"
            placement="top"
            align="right"
            @update:model-value="(value) => reschedule(current, value)"
          >
            <template #trigger="{ toggle, open: popoverOpen, setRef }">
              <UiButton variant="dark" :aria-expanded="popoverOpen ? 'true' : 'false'" aria-haspopup="dialog" :ref="(el) => setRef(el?.$el)" @click="toggle">Reprogrammer</UiButton>
            </template>
          </UiDatePopover>
        </div>
        <div v-else-if="drawerMode === 'plan'" class="flex justify-end">
          <UiButton variant="primary" :disabled="!selectedInfluencer || !planStart" :loading="creatingPlan" @click="createPlan">Préparer un plan</UiButton>
        </div>
      </template>
    </UiDrawer>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { CONTENT_TYPES, contentStatusOf, contentTypeOf } from '../utils/contentTypes.js'
import { formatShortDate } from '../utils/formatDate.js'
import {
  addDays, buildMonthWeeks, findTrailingGap, monthKey, monthTarget, parseMonthKey, parseTags, presetDays, splitCaption,
  startOfDay, statusFromContent, summarizeMonth, timeLabel,
} from '../utils/calendarGrid.js'

const route = useRoute()
const router = useRouter()
const requestFetch = useRequestFetch()
const { pushToast } = useUiFeedback()
const activeInfluencerId = useActiveInfluencer()

const MAX_CHIPS = 3
const weekLabels = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const typeList = Object.values(CONTENT_TYPES)
const PLAN_DURATIONS = [{ value: 7, label: '7 jours' }, { value: 14, label: '14 jours' }, { value: 30, label: '30 jours' }]

const currentMonth = ref(parseMonthKey(route.query.month) || new Date(new Date().getFullYear(), new Date().getMonth(), 1))

const { data, pending: loading } = await useFetch('/api/profiles', { key: 'plotline-calendar-source' })

const selectedInfluencer = computed(() => data.value?.find((item) => item.id === activeInfluencerId.value) || data.value?.[0] || null)

// --- Contenus du calendrier : contenus produits + idées des plans brouillons ---
const entries = ref([])
const entriesLoading = ref(true)
const cadence = ref(0)
const pageLoading = computed(() => loading.value || entriesLoading.value)

function toEntry(content) {
  const split = splitCaption(content.caption)
  return {
    id: content.id,
    format: content.format,
    status: statusFromContent(content.status),
    scheduledAt: content.scheduledAt,
    captionText: split.text,
    hashtags: split.tags,
    imageUrl: content.imageUrl || '',
    planId: '',
    itemId: '',
  }
}

// Idées d'un plan brouillon : pas encore générées (pas de contentId), donc absentes de /content. Ce watch s'exécute aussi
// au rendu serveur, où un $fetch brut n'envoie pas le cookie de session : d'où `useRequestFetch`.
async function fetchDraftEntries(profileId) {
  const { plans } = await requestFetch(`/api/plans?profileId=${profileId}`)
  const draftPlans = (plans || []).filter((plan) => plan.status === 'DRAFT')
  const details = await Promise.all(draftPlans.map((plan) => requestFetch(`/api/plans/${plan.id}`)))
  return details.flatMap(({ plan }) => (plan?.items || [])
    .filter((item) => item.keep && !item.contentId)
    .map((item) => ({
      id: `plan-item-${item.id}`,
      format: item.format,
      status: 'draft',
      scheduledAt: item.scheduledAt,
      captionText: item.caption || '',
      hashtags: parseTags(item.hashtags),
      imageUrl: '',
      planId: plan.id,
      itemId: item.id,
    })))
}

watch(
  selectedInfluencer,
  async (value) => {
    if (!value) {
      entries.value = []
      cadence.value = 0
      entriesLoading.value = false
      return
    }
    entriesLoading.value = true
    try {
      const [response, drafts, profile] = await Promise.all([
        requestFetch(`/api/profiles/${value.id}/content?statuses=PENDING,VALIDATED,PUBLISHED,PROCESSING`),
        fetchDraftEntries(value.id),
        requestFetch(`/api/profiles/${value.id}`).catch(() => null),
      ])
      entries.value = [...(response.contents || []).filter((content) => content.scheduledAt).map(toEntry), ...drafts]
      cadence.value = Number(profile?.postsPerWeek) || 0
    } catch {
      entries.value = []
      cadence.value = 0
    } finally {
      entriesLoading.value = false
    }
  },
  { immediate: true },
)

// --- Mois affiché ---
const monthLabel = computed(() => new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(currentMonth.value))
const weeks = computed(() => buildMonthWeeks(currentMonth.value, entries.value))
const summary = computed(() => summarizeMonth(currentMonth.value, entries.value))
const target = computed(() => monthTarget(cadence.value, currentMonth.value))
const gap = computed(() => (selectedInfluencer.value ? findTrailingGap(currentMonth.value, entries.value) : null))
// Le mois abrege porte deja son point (« nov. ») : la phrase ajoute le sien.
const gapMonthLabel = computed(() => (gap.value ? new Intl.DateTimeFormat('fr-FR', { month: 'short' }).format(gap.value.end).replace(/\.$/, '') : ''))

function changeMonth(delta) {
  currentMonth.value = new Date(currentMonth.value.getFullYear(), currentMonth.value.getMonth() + delta, 1)
}
function goToday() {
  const now = new Date()
  currentMonth.value = new Date(now.getFullYear(), now.getMonth(), 1)
  nextTick(() => { focusIndex.value = todayIndex() })
}

const mobileDays = computed(() => weeks.value
  .flatMap((week) => week.cells)
  .filter((cell) => cell.inMonth && cell.items.length)
  .map((cell) => ({ key: cell.key, date: cell.date, isToday: cell.isToday, items: cell.items })))

// --- Libellés accessibles ---
const dayLabel = (date) => new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(date)
function cellLabel(cell) {
  const base = dayLabel(cell.date)
  if (!cell.items.length) return cell.isFuture ? `${base}, rien de planifié` : base
  return `${base}, ${cell.items.length} contenu${cell.items.length > 1 ? 's' : ''}`
}
const entryLabel = (entry) => `${contentTypeOf(entry.format).label}, ${contentStatusOf(entry.status).label}, ${formatShortDate(entry.scheduledAt)}. ${entry.captionText || 'Sans légende'}`
const toIso = (value) => (Number.isNaN(new Date(value).getTime()) ? '' : new Date(value).toISOString())
const isVideo = (entry) => ['REEL', 'STORY'].includes(String(entry?.format || '').toUpperCase()) || String(entry?.imageUrl || '').toLowerCase().endsWith('.mp4')

// --- Navigation au clavier : flèches, Début, Fin ; Entrée ouvre ---
const gridRef = ref(null)
const focusIndex = ref(-1)

function todayIndex() {
  const cells = weeks.value.flatMap((week) => week.cells)
  return (cells.find((cell) => cell.isToday) || cells.find((cell) => cell.inMonth))?.index ?? 0
}
watch(weeks, () => {
  const cells = weeks.value.flatMap((week) => week.cells)
  if (!cells[focusIndex.value]?.inMonth) focusIndex.value = todayIndex()
}, { immediate: true })

function moveFocus(from, step) {
  const cells = weeks.value.flatMap((week) => week.cells)
  let next = from + step
  while (next >= 0 && next < cells.length && !cells[next].inMonth) next += Math.sign(step)
  if (next < 0 || next >= cells.length) return
  focusIndex.value = next
  nextTick(() => gridRef.value?.querySelector(`[data-index="${next}"]`)?.focus())
}

function onGridKeydown(event) {
  const cell = event.target.closest?.('[role=gridcell]')
  if (!cell || event.target !== cell) return
  const index = Number(cell.dataset.index)
  const steps = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 7, ArrowUp: -7 }
  if (steps[event.key]) {
    event.preventDefault()
    moveFocus(index, steps[event.key])
  } else if (event.key === 'Home' || event.key === 'End') {
    event.preventDefault()
    const row = Math.floor(index / 7) * 7
    const inRow = weeks.value.flatMap((week) => week.cells).slice(row, row + 7).filter((c) => c.inMonth)
    const target = event.key === 'Home' ? inRow[0] : inRow[inRow.length - 1]
    if (target) {
      focusIndex.value = target.index
      nextTick(() => gridRef.value?.querySelector(`[data-index="${target.index}"]`)?.focus())
    }
  }
}

// --- Panneau latéral ---
const drawerOpen = ref(false)
const drawerMode = ref('') // detail | day | plan
const current = ref(null)
const dayCell = ref(null)
const actionError = ref('')

const drawerTitle = computed(() => {
  if (drawerMode.value === 'detail' && current.value) return `${contentTypeOf(current.value.format).label} · ${formatShortDate(current.value.scheduledAt)}`
  if (drawerMode.value === 'day' && dayCell.value) return dayLabel(dayCell.value.date).replace(/^./, (c) => c.toUpperCase())
  return 'Planifier une période'
})
const drawerDescription = computed(() => {
  if (drawerMode.value === 'day' && dayCell.value) return `${dayCell.value.items.length} contenu${dayCell.value.items.length > 1 ? 's' : ''}`
  if (drawerMode.value === 'plan' && selectedInfluencer.value) return selectedInfluencer.value.name
  return ''
})

function openEntry(entry) {
  current.value = entry
  actionError.value = ''
  drawerMode.value = 'detail'
  drawerOpen.value = true
}
function openDay(cell) {
  dayCell.value = cell
  drawerMode.value = 'day'
  drawerOpen.value = true
}
function activateCell(cell) {
  if (!cell.inMonth) return
  if (cell.items.length === 1) openEntry(cell.items[0])
  else if (cell.items.length > 1) openDay(cell)
  else if (cell.isFuture && selectedInfluencer.value) openPlanDrawer({ start: cell.date })
}
function onCellClick(cell) {
  if (cell.inMonth && cell.items.length) openDay(cell)
}

// --- Préparer un plan ---
const planStart = ref('')
const planDays = ref(7)
const creatingPlan = ref(false)
const planError = ref('')
const toDateInput = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

function openPlanDrawer({ start = new Date(), days = 7 } = {}) {
  planStart.value = toDateInput(start)
  planDays.value = days
  planError.value = ''
  drawerMode.value = 'plan'
  drawerOpen.value = true
}

async function createPlan() {
  if (!selectedInfluencer.value || !planStart.value) return
  creatingPlan.value = true
  planError.value = ''
  try {
    const startsToday = planStart.value === toDateInput(new Date())
    const result = await $fetch('/api/plans', {
      method: 'POST',
      body: {
        profileId: selectedInfluencer.value.id,
        days: planDays.value,
        // Aujourd'hui : le serveur part de « maintenant » (les créneaux déjà passés sont écartés).
        ...(startsToday ? {} : { startDate: new Date(`${planStart.value}T00:00`).toISOString() }),
      },
    })
    drawerOpen.value = false
    await router.push(`/plans/${result.plan.id}`)
  } catch (err) {
    planError.value = err?.statusMessage || 'Préparation du plan impossible. Réessaie dans un instant.'
  } finally {
    creatingPlan.value = false
  }
}

// --- Actions du détail ---
const canReschedule = (entry) => entry.status === 'draft' || entry.status === 'approved'

function goToPlan(entry) {
  drawerOpen.value = false
  router.push({ path: `/plans/${entry.planId}`, query: { idea: entry.itemId } })
}
function goToCreations() {
  drawerOpen.value = false
  router.push('/content')
}

async function reschedule(entry, iso) {
  if (!iso) return
  actionError.value = ''
  try {
    if (entry.planId) {
      await $fetch(`/api/plans/${entry.planId}/items/${entry.itemId}`, { method: 'PATCH', body: { scheduledAt: iso } })
    } else {
      await $fetch(`/api/content/${entry.id}/schedule`, { method: 'PATCH', body: { scheduledAt: iso } })
    }
    entry.scheduledAt = iso
    pushToast({ title: 'Date mise à jour', message: formatShortDate(iso), tone: 'success' })
  } catch (err) {
    actionError.value = err?.statusMessage || 'La date n\'a pas pu être modifiée.'
  }
}

// --- Arrivée depuis le plan : ?month=2026-10&idea=<idée> met la puce en surbrillance 2 s ---
const highlightId = ref('')
let highlightTimer = null
watch(entriesLoading, (isLoading) => {
  if (isLoading || !route.query.idea) return
  const id = `plan-item-${route.query.idea}`
  const entry = entries.value.find((item) => item.id === id)
  if (!entry) return
  if (!route.query.month) currentMonth.value = new Date(new Date(entry.scheduledAt).getFullYear(), new Date(entry.scheduledAt).getMonth(), 1)
  highlightId.value = id
  clearTimeout(highlightTimer)
  highlightTimer = setTimeout(() => { highlightId.value = '' }, 2000)
}, { immediate: true })
onBeforeUnmount(() => clearTimeout(highlightTimer))

onMounted(() => { if (focusIndex.value < 0) focusIndex.value = todayIndex() })
</script>
