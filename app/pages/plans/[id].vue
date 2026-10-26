<template>
  <div class="space-y-5 font-ui">
    <div>
      <p class="text-xs font-semibold uppercase tracking-[0.08em] text-ui-accent">Plan éditorial</p>
      <h1 class="mt-1 text-2xl font-bold tracking-[-0.01em] text-ui-ink">{{ plan?.profile?.name || 'Plan' }}</h1>
    </div>

    <UiSkeleton v-if="pending && !plan" :lines="4" />

    <UiAlert v-else-if="error && !plan" title="Impossible de charger ce plan">
      Le plan n'a pas pu être lu : il a peut-être été supprimé, ou la connexion a échoué.
      <template #action>
        <UiButton size="sm" @click="refresh()">Réessayer</UiButton>
      </template>
    </UiAlert>

    <template v-else-if="plan">
      <!-- Une seule barre d'action, collante : contexte du plan à gauche, actions à droite. -->
      <div
        class="sticky top-[69px] z-20 -mx-4 border-b border-ui-line bg-ui-bg/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:top-0 lg:-mx-8 lg:px-8"
      >
        <div class="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <div class="min-w-0">
            <p class="text-sm font-semibold text-ui-ink">
              {{ plan.profile?.name }}
              <template v-if="periodLabel"> · {{ periodLabel }}</template>
              · {{ plan.items.length }} idée{{ plan.items.length > 1 ? 's' : '' }}
            </p>
            <p class="mt-0.5 text-xs text-ui-ink-muted">
              <template v-if="discardedCount">{{ discardedCount }} exclue{{ discardedCount > 1 ? 's' : '' }}</template>
              <template v-if="discardedCount && alreadyGeneratedCount"> · </template>
              <template v-if="alreadyGeneratedCount">{{ alreadyGeneratedCount }} déjà générée{{ alreadyGeneratedCount > 1 ? 's' : '' }}, elle{{ alreadyGeneratedCount > 1 ? 's' : '' }} ne {{ alreadyGeneratedCount > 1 ? 'seront' : 'sera' }} pas refaite{{ alreadyGeneratedCount > 1 ? 's' : '' }}</template>
              <template v-if="!discardedCount && !alreadyGeneratedCount">Rien n'est produit tant que tu n'as pas généré.</template>
            </p>
          </div>

          <div class="flex flex-col items-end gap-1">
            <div class="flex flex-wrap items-center justify-end gap-2">
              <UiButton v-if="plan.status === 'DRAFT'" :disabled="approving || discarding" :loading="discarding" @click="discardPlan">
                Jeter ce plan
              </UiButton>
              <UiButton variant="primary" :disabled="approving || discarding || generationRunning || !pendingGenerationCount" :loading="approving" @click="approvePlan">
                {{ primaryLabel }}
              </UiButton>
            </div>
            <p class="max-w-xs text-right text-xs text-ui-ink-muted" aria-live="polite">{{ primaryHint }}</p>
          </div>
        </div>

        <div v-if="generationRunning" class="mt-3">
          <UiProgress :value="generationDone" :max="generationTotal" label="Génération en cours" />
        </div>
      </div>

      <UiAlert v-if="feedback" :tone="feedbackTone === 'error' ? 'error' : 'info'" :title="feedbackTone === 'error' ? 'Action impossible' : undefined">
        {{ feedback }}
        <template v-if="feedbackTone !== 'error' && generationStarted" #action>
          <NuxtLink to="/content" class="text-sm font-semibold text-ui-info-ink underline underline-offset-2">Voir dans Mes créations</NuxtLink>
        </template>
      </UiAlert>

      <!-- Bande des jours du plan : un point de la couleur du type par idée ; un clic fait défiler jusqu'à l'idée. -->
      <nav v-if="weekDays.length" aria-label="Jours du plan">
        <ol class="flex gap-2 overflow-x-auto pb-1">
          <li v-for="day in weekDays" :key="day.key" class="shrink-0">
            <button
              type="button"
              :disabled="!day.items.length"
              class="flex min-h-11 min-w-14 flex-col items-center justify-center gap-1 rounded-ui-ctl border border-ui-line bg-ui-surface px-2 py-1.5 text-xs font-semibold text-ui-ink-2 transition-colors hover:bg-ui-subtle focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ui-accent/20 disabled:cursor-default disabled:border-ui-line-soft disabled:bg-transparent disabled:text-ui-ink-muted disabled:hover:bg-transparent"
              :aria-label="`${day.label}${day.items.length ? ` : ${day.items.length} idée${day.items.length > 1 ? 's' : ''}` : ' : rien de prévu'}`"
              @click="scrollToItem(day.items[0]?.id)"
            >
              <span>{{ day.label }}</span>
              <span class="flex h-2 items-center gap-1" aria-hidden="true">
                <span v-for="entry in day.items" :key="entry.id" class="h-2 w-2 rounded-full" :class="contentTypeOf(entry.format).dot" />
              </span>
            </button>
          </li>
        </ol>
      </nav>

      <UiEmptyState v-if="!plan.items.length" title="Ce plan est vide" text="Aucune idée n'a été proposée pour cette période. Prépare un nouveau plan depuis le calendrier.">
        <template #action>
          <NuxtLink to="/calendar" class="text-sm font-semibold text-ui-accent underline underline-offset-2">Retour au calendrier</NuxtLink>
        </template>
      </UiEmptyState>

      <div class="space-y-4">
        <article
          v-for="item in plan.items"
          :id="`idea-${item.id}`"
          :key="item.id"
          class="scroll-mt-40 rounded-ui-card border border-ui-line p-5 transition-colors duration-500"
          :class="[highlightId === item.id ? 'bg-ui-accent-soft' : 'bg-ui-surface', !item.keep && !item.contentId ? 'opacity-60' : '']"
          :aria-busy="statusOf(item) === 'generating' ? 'true' : undefined"
        >
          <!-- 1. En-tête : numéro, type, format, date modifiable, statut ; interrupteur à droite -->
          <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <div class="flex flex-wrap items-center gap-2">
              <span class="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-ui-subtle px-2 font-ui-mono text-xs font-medium text-ui-ink-2">{{ item.position }}</span>
              <UiBadge :type="contentTypeOf(item.format).key" />
              <span v-if="productionLabels[item.format]" class="text-xs text-ui-ink-muted" title="Comment ce contenu sera produit">
                {{ productionLabels[item.format] }}
              </span>
              <UiDatePopover
                :model-value="toIso(item.scheduledAt)"
                :disabled="isLocked(item)"
                @update:model-value="(value) => changeDate(item, value)"
              />
              <UiBadge :status="statusOf(item)" />
            </div>

            <div class="flex flex-wrap items-center gap-3">
              <span class="text-xs text-ui-ink-muted" aria-live="polite">
                <template v-if="saveState[item.id] === 'saving'">Enregistrement…</template>
                <template v-else-if="saveState[item.id] === 'saved'">Enregistré</template>
              </span>
              <UiSwitch
                v-if="!item.contentId"
                :model-value="item.keep"
                :disabled="approving || generationRunning"
                label="Générer"
                @update:model-value="() => toggleKeep(item)"
              />
              <NuxtLink v-else to="/content" class="inline-flex min-h-11 items-center text-sm font-semibold text-ui-accent underline underline-offset-2">
                Voir dans Mes créations
              </NuxtLink>
            </div>
          </div>

          <UiAlert v-if="saveState[item.id] === 'error'" class="mt-3" title="Enregistrement impossible">
            {{ saveError[item.id] || 'La modification n\'a pas pu être enregistrée.' }}
            <template #action>
              <UiButton size="sm" @click="saveItem(item)">Réessayer</UiButton>
            </template>
          </UiAlert>

          <div class="mt-4 space-y-4">
            <!-- 2. Légende : ce que l'utilisateur relit vraiment -->
            <UiField label="Légende" :for-id="`caption-${item.id}`">
              <UiTextarea
                :id="`caption-${item.id}`"
                v-model="item.caption"
                :rows="3"
                :disabled="isLocked(item)"
                @update:model-value="scheduleSave(item)"
              />
            </UiField>

            <!-- 3. Hashtags -->
            <UiField label="Hashtags" hint="Entrée ou virgule pour ajouter" :for-id="`tags-${item.id}`">
              <UiTagInput
                :id="`tags-${item.id}`"
                :model-value="item.hashtagList || []"
                :disabled="isLocked(item)"
                placeholder="Ajouter un hashtag…"
                @update:model-value="(value) => changeHashtags(item, value)"
              />
            </UiField>

            <!-- 4. Prompt de scène / sujet de la vidéo, replié -->
            <UiAlert v-if="item.format === 'STORY'" tone="info">
              <template v-if="storyKeywordCount > 0">
                Le clip est choisi automatiquement à la génération parmi les {{ storyKeywordCount }} mots-clés de stories de la personnalité. Seule la légende compte.
              </template>
              <template v-else>
                Le clip est choisi automatiquement à la génération dans la banque Pinterest (catégorie : {{ storyCategoryLabel }}). Seule la légende compte.
              </template>
            </UiAlert>
            <UiDisclosure v-else :title="promptLabel(item)">
              <UiTextarea
                :id="`prompt-${item.id}`"
                v-model="item.prompt"
                :rows="4"
                :disabled="isLocked(item)"
                :invalid="!String(item.prompt || '').trim()"
                class="font-ui-mono !text-[13px]"
                :aria-label="promptLabel(item)"
                @update:model-value="scheduleSave(item)"
              />
              <p v-if="!String(item.prompt || '').trim()" class="mt-1 text-xs text-ui-danger-ink">Le prompt ne peut pas être vide : il n'est pas enregistré tant qu'il est vide.</p>
            </UiDisclosure>

            <NuxtLink
              v-if="item.scheduledAt"
              to="/calendar"
              class="inline-flex min-h-11 items-center text-xs font-semibold text-ui-ink-2 underline underline-offset-2 hover:text-ui-ink"
            >
              Voir dans le calendrier
            </NuxtLink>
          </div>
        </article>
      </div>
    </template>
  </div>
</template>

<script setup>
import { contentTypeOf } from '../../utils/contentTypes.js'
import { formatDateRange, formatShortDate } from '../../utils/formatDate.js'

const route = useRoute()
const router = useRouter()
const { requestConfirmation } = useUiFeedback()

const planId = computed(() => String(route.params.id || ''))

const { data, pending, error, refresh } = await useFetch(() => `/api/plans/${planId.value}`, {
  key: computed(() => `plan-${planId.value}`),
  // Les idees sont modifiees en place (texte, date, interrupteur) : les compteurs et la bande des jours doivent suivre.
  deep: true,
})

const plan = computed(() => data.value?.plan ?? null)

// Comment chaque format sera produit (libelles fournis par le serveur, qui connait le moteur actif).
const productionLabels = computed(() => data.value?.productionLabels || {})

// Categorie du clip des STORY (devinee depuis la niche du profil par le serveur).
const STORY_CATEGORY_LABELS = { lifestyle: 'lifestyle', beach: 'plage', outfit: 'tenues', other: 'divers' }
const storyKeywordCount = computed(() => Number(data.value?.storyKeywordCount) || 0)
const storyCategoryLabel = computed(() => STORY_CATEGORY_LABELS[data.value?.storyCategory] || 'lifestyle')

function promptLabel(item) {
  // Une video faceless n a pas de scene : l idee est le sujet que la voix va raconter.
  return item.format === 'REEL' && data.value?.reelEngine === 'faceless' ? 'Sujet de la vidéo' : 'Prompt de scène'
}

const toIso = (value) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString()
}

// --- Hashtags : l'API stocke une chaine separee par des espaces, l'ecran travaille sur une liste. ---
const normalizeTag = (tag) => {
  const clean = String(tag || '').replace(/\s+/g, '').replace(/^#+/, '')
  return clean ? `#${clean}` : ''
}
const parseHashtags = (text) => String(text || '').split(/\s+/).map(normalizeTag).filter(Boolean)
const serializeHashtags = (tags) => (tags || []).map(normalizeTag).filter(Boolean).join(' ')

// --- Enregistrement automatique (800 ms apres la derniere frappe), mises a jour partielles par idee. ---
const SAVE_DELAY = 800
const FIELDS = ['prompt', 'caption', 'hashtags', 'scheduledAt']

const saveState = ref({}) // id -> saving | saved | error
const saveError = ref({})
const savedSnapshots = ref({})
const timers = {}

const valueOf = (item, field) => (field === 'scheduledAt' ? toIso(item.scheduledAt) : String(item[field] ?? ''))

watch(
  plan,
  (value) => {
    const next = {}
    for (const item of value?.items || []) {
      if (!item.hashtagList) item.hashtagList = parseHashtags(item.hashtags)
      next[item.id] = Object.fromEntries(FIELDS.map((field) => [field, valueOf(item, field)]))
    }
    savedSnapshots.value = next
  },
  { immediate: true },
)

function changedFields(item) {
  const saved = savedSnapshots.value[item.id]
  if (!saved || item.contentId) return {}
  const changes = {}
  for (const field of FIELDS) {
    const current = valueOf(item, field)
    if (current === saved[field]) continue
    // Un prompt vide serait refuse par le serveur : on ne l'envoie pas (l'ecran l'indique).
    if (field === 'prompt' && !current.trim()) continue
    changes[field] = current
  }
  return changes
}

const dirtyItems = computed(() => (plan.value?.items || []).filter((item) => Object.keys(changedFields(item)).length))

function scheduleSave(item) {
  clearTimeout(timers[item.id])
  timers[item.id] = setTimeout(() => saveItem(item), SAVE_DELAY)
}

async function saveItem(item) {
  clearTimeout(timers[item.id])
  const body = changedFields(item)
  if (!Object.keys(body).length) {
    if (saveState.value[item.id] === 'error') saveState.value = { ...saveState.value, [item.id]: undefined }
    return true
  }

  saveState.value = { ...saveState.value, [item.id]: 'saving' }
  try {
    await $fetch(`/api/plans/${planId.value}/items/${item.id}`, { method: 'PATCH', body })
    savedSnapshots.value = { ...savedSnapshots.value, [item.id]: { ...savedSnapshots.value[item.id], ...body } }
    // Une frappe est arrivee pendant l'envoi : on repart pour un tour.
    if (Object.keys(changedFields(item)).length) {
      scheduleSave(item)
    } else {
      saveState.value = { ...saveState.value, [item.id]: 'saved' }
    }
    return true
  } catch (err) {
    saveError.value = { ...saveError.value, [item.id]: err?.statusMessage || '' }
    saveState.value = { ...saveState.value, [item.id]: 'error' }
    return false
  }
}

function changeHashtags(item, tags) {
  item.hashtagList = (tags || []).map(normalizeTag).filter(Boolean)
  item.hashtags = serializeHashtags(item.hashtagList)
  scheduleSave(item)
}

function changeDate(item, iso) {
  if (!iso) return
  item.scheduledAt = iso
  saveItem(item)
}

onBeforeUnmount(() => Object.values(timers).forEach((timer) => clearTimeout(timer)))

// --- Inclure / exclure ---
const feedback = ref('')
const feedbackTone = ref('success')
const generationStarted = ref(false)

async function toggleKeep(item) {
  const next = !item.keep
  item.keep = next
  try {
    await $fetch(`/api/plans/${planId.value}/items/${item.id}`, { method: 'PATCH', body: { keep: next } })
  } catch (err) {
    item.keep = !next
    feedbackTone.value = 'error'
    feedback.value = err?.statusMessage || 'Modification impossible.'
  }
}

// --- Compteurs ---
const keptCount = computed(() => (plan.value?.items || []).filter((item) => item.keep).length)
const discardedCount = computed(() => (plan.value?.items || []).filter((item) => !item.keep && !item.contentId).length)
const alreadyGeneratedCount = computed(() => (plan.value?.items || []).filter((item) => item.contentId).length)

// Seules les idees conservees et pas encore generees engagent des credits.
const pendingGenerationCount = computed(
  () => (plan.value?.items || []).filter((item) => item.keep && !item.contentId).length,
)

// --- Generation : suivi des contenus lances ---
const approving = ref(false)
const discarding = ref(false)
const contentDone = ref({}) // contentId -> true quand le contenu a fini (ou echoue)
const watchedIds = ref([])

const generationTotal = computed(() => watchedIds.value.length)
const generationDone = computed(() => watchedIds.value.filter((id) => contentDone.value[id]).length)
const generationRunning = computed(() => watchedIds.value.length > 0 && generationDone.value < watchedIds.value.length)

function statusOf(item) {
  if (item.contentId) return watchedIds.value.includes(item.contentId) && !contentDone.value[item.contentId] ? 'generating' : 'approved'
  if (approving.value && item.keep) return 'generating'
  return 'draft'
}

const isLocked = (item) => Boolean(item.contentId) || statusOf(item) === 'generating'

let pollTimer = null
async function pollContents() {
  clearTimeout(pollTimer)
  const waiting = watchedIds.value.filter((id) => !contentDone.value[id])
  if (!waiting.length) return
  await Promise.all(waiting.map(async (id) => {
    try {
      const status = await $fetch(`/api/content/${id}/status`)
      if (status?.done) contentDone.value = { ...contentDone.value, [id]: true }
    } catch {
      // Une lecture ratee ne bloque pas le suivi : on reessaie au prochain tour.
    }
  }))
  if (watchedIds.value.some((id) => !contentDone.value[id])) pollTimer = setTimeout(pollContents, 4000)
}

onBeforeUnmount(() => clearTimeout(pollTimer))

const primaryLabel = computed(() => {
  if (approving.value) return 'Lancement…'
  if (generationRunning.value) return `Génération ${Math.min(generationDone.value + 1, generationTotal.value)} / ${generationTotal.value}…`
  return `Générer ${pendingGenerationCount.value} contenu${pendingGenerationCount.value > 1 ? 's' : ''}`
})

const primaryHint = computed(() => {
  if (generationRunning.value) return 'Les contenus arrivent dans Mes créations, à valider avant publication.'
  if (!pendingGenerationCount.value) {
    if (alreadyGeneratedCount.value && !keptCount.value) return 'Tout est déjà généré.'
    if (alreadyGeneratedCount.value && keptCount.value === alreadyGeneratedCount.value) return 'Tout est déjà généré.'
    return 'Aucune idée à générer : réactive au moins une idée avec l\'interrupteur « Générer ».'
  }
  if (dirtyItems.value.length) return 'Engage tes crédits de génération. Les modifications en attente seront enregistrées avant.'
  return 'Engage tes crédits de génération'
})

async function approvePlan() {
  approving.value = true
  feedback.value = ''

  try {
    // Les modifications en attente sont enregistrees d abord : generer a partir
    // d un texte perime coute des credits pour un contenu deja abandonne.
    for (const item of dirtyItems.value) {
      const ok = await saveItem(item)
      if (!ok) {
        feedbackTone.value = 'error'
        feedback.value = 'Génération annulée : une modification n\'a pas pu être enregistrée.'
        return
      }
    }

    const result = await $fetch(`/api/plans/${planId.value}/approve`, { method: 'POST' })
    watchedIds.value = Array.isArray(result.contentIds) ? result.contentIds : []
    await refresh()
    generationStarted.value = true
    feedbackTone.value = 'success'
    feedback.value = `${result.launched} génération(s) lancée(s). Les contenus arrivent dans Mes créations, à valider avant publication.`
    pollContents()
  } catch (err) {
    feedbackTone.value = 'error'
    feedback.value = err?.statusMessage || 'Approbation impossible.'
  } finally {
    approving.value = false
  }
}

async function discardPlan() {
  const confirmed = await requestConfirmation({
    title: 'Jeter ce plan ?',
    message: 'Aucune de ces idées ne sera générée. Cette action est définitive.',
    confirmLabel: 'Jeter le plan',
    tone: 'danger',
  })
  if (!confirmed) return

  discarding.value = true
  feedback.value = ''

  try {
    await $fetch(`/api/plans/${planId.value}/discard`, { method: 'POST' })
    await router.push('/calendar')
  } catch (err) {
    feedbackTone.value = 'error'
    feedback.value = err?.statusMessage || 'Abandon du plan impossible.'
  } finally {
    discarding.value = false
  }
}

// --- Periode et bande des jours ---
const dates = computed(() => (plan.value?.items || []).map((item) => new Date(item.scheduledAt)).filter((date) => !Number.isNaN(date.getTime())).sort((a, b) => a - b))
const periodLabel = computed(() => (dates.value.length ? formatDateRange(dates.value[0], dates.value[dates.value.length - 1]) : ''))

const weekDays = computed(() => {
  if (!dates.value.length) return []
  const first = new Date(dates.value[0])
  first.setHours(0, 0, 0, 0)
  const last = new Date(dates.value[dates.value.length - 1])
  last.setHours(0, 0, 0, 0)
  const days = []
  for (let cursor = new Date(first); cursor <= last && days.length < 31; cursor.setDate(cursor.getDate() + 1)) {
    const start = new Date(cursor)
    const end = new Date(cursor)
    end.setDate(end.getDate() + 1)
    days.push({
      key: start.toISOString(),
      label: new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric' }).format(start),
      items: (plan.value?.items || []).filter((item) => {
        const date = new Date(item.scheduledAt)
        return date >= start && date < end
      }),
    })
  }
  return days
})

// --- Defilement et surbrillance (lien depuis le calendrier : /plans/<id>?idea=<idee>) ---
const highlightId = ref('')
let highlightTimer = null

function scrollToItem(id) {
  if (!id || !import.meta.client) return
  document.getElementById(`idea-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  highlightId.value = id
  clearTimeout(highlightTimer)
  highlightTimer = setTimeout(() => { highlightId.value = '' }, 2000)
}

onMounted(() => {
  const idea = String(route.query.idea || '')
  if (idea) nextTick(() => scrollToItem(idea))
  // Un plan deja approuve : on verifie si ses contenus ont fini de se generer.
  const launched = (plan.value?.items || []).map((item) => item.contentId).filter(Boolean)
  if (plan.value?.status === 'APPROVED' && launched.length) {
    watchedIds.value = launched
    pollContents()
  }
})
onBeforeUnmount(() => clearTimeout(highlightTimer))
</script>
