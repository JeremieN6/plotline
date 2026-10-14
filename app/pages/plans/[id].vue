<template>
  <div class="space-y-6">
    <header class="rounded-[20px] border border-[#E5E3DF] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
      <p class="text-xs font-semibold uppercase tracking-[0.22em] text-[#E8873A]">Plan éditorial</p>
      <h1 class="mt-2 text-3xl font-bold tracking-tight text-[#111111]">
        {{ plan?.profile?.name || 'Plan' }}
      </h1>
      <p class="mt-2 text-sm text-[#666666]">
        Relis chaque idée avant génération. Rien n'est produit tant que tu n'as pas approuvé.
      </p>
    </header>

    <p v-if="pending" class="rounded-[20px] border border-[#E5E3DF] bg-white p-5 text-sm text-[#666666]">
      Chargement du plan...
    </p>

    <p v-else-if="error" class="rounded-[20px] border border-[#F0C7C7] bg-[#FDF3F3] p-5 text-sm text-[#A33A3A]">
      Impossible de charger ce plan.
    </p>

    <template v-else-if="plan">
      <div class="rounded-[20px] border border-[#E5E3DF] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p class="text-sm font-bold text-[#111111]">
              {{ keptCount }} idée{{ keptCount > 1 ? 's' : '' }} à générer
              <span v-if="discardedCount" class="font-semibold text-[#999999]">
                · {{ discardedCount }} écartée{{ discardedCount > 1 ? 's' : '' }}
              </span>
            </p>
            <p class="mt-1 text-xs text-[#8A8A8A]">
              <template v-if="alreadyGeneratedCount">
                {{ alreadyGeneratedCount }} déjà générée{{ alreadyGeneratedCount > 1 ? 's' : '' }} — elles ne seront pas refaites.
              </template>
              <template v-else>
                C'est ici que les crédits de génération sont engagés.
              </template>
            </p>
            <p v-if="dirtyItems.length" class="mt-1 text-xs font-semibold text-[#B45F1D]">
              {{ dirtyItems.length }} modification{{ dirtyItems.length > 1 ? 's' : '' }} en attente — elles seront enregistrées avant génération.
            </p>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <button
              v-if="plan.status === 'DRAFT'"
              type="button"
              class="rounded-[12px] border border-[#E5E3DF] bg-white px-4 py-2.5 text-sm font-bold text-[#666666] transition-colors hover:bg-[#FAFAF8] disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="approving || discarding"
              @click="discardPlan"
            >
              {{ discarding ? 'Abandon...' : 'Jeter ce plan' }}
            </button>

            <button
              type="button"
              class="rounded-[12px] bg-[#E8873A] px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#D97A2F] disabled:cursor-not-allowed disabled:opacity-60"
              :disabled="approving || discarding || !pendingGenerationCount"
              @click="approvePlan"
            >
              {{ approving ? 'Lancement...' : `Générer ${pendingGenerationCount} contenu${pendingGenerationCount > 1 ? 's' : ''}` }}
            </button>
          </div>
        </div>

        <p v-if="feedback" class="mt-3 text-sm" :class="feedbackTone === 'error' ? 'text-[#A33A3A]' : 'text-[#2F7A4F]'">
          {{ feedback }}
        </p>
      </div>

      <div class="space-y-4">
        <article
          v-for="item in plan.items"
          :key="item.id"
          class="rounded-[20px] border bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)] transition-opacity"
          :class="item.keep ? 'border-[#E5E3DF]' : 'border-[#E5E3DF] opacity-55'"
        >
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="flex items-center gap-2.5">
              <span class="rounded-full bg-[#F5F2ED] px-2.5 py-1 text-xs font-bold text-[#666666]">
                {{ item.position }}
              </span>
              <span class="rounded-full bg-[#FDF0E4] px-2.5 py-1 text-xs font-bold text-[#B45F1D]">
                {{ item.format }}
              </span>
              <span
                v-if="productionLabels[item.format]"
                class="text-[11px] font-medium text-[#AAAAAA]"
                title="Comment ce contenu sera produit"
              >
                {{ productionLabels[item.format] }}
              </span>
              <span class="text-xs font-semibold text-[#8A8A8A]">{{ formatDate(item.scheduledAt) }}</span>
              <span
                v-if="item.contentId"
                class="rounded-full bg-[#E7F3EC] px-2.5 py-1 text-xs font-bold text-[#2F7A4F]"
              >
                Généré
              </span>
            </div>

            <button
              v-if="!item.contentId"
              type="button"
              class="text-xs font-bold underline underline-offset-2 transition-colors"
              :class="item.keep ? 'text-[#B45F1D] hover:text-[#8E4B16]' : 'text-[#666666] hover:text-[#111111]'"
              @click="toggleKeep(item)"
            >
              {{ item.keep ? 'Écarter' : 'Réintégrer' }}
            </button>
          </div>

          <div class="mt-4 space-y-3">
            <div>
              <label class="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#AAAAAA]">{{ promptLabel(item) }}</label>
              <textarea
                v-model="item.prompt"
                :disabled="Boolean(item.contentId)"
                class="mt-1.5 w-full rounded-[10px] border border-[#E5E3DF] bg-[#FAFAF8] p-3 text-sm text-[#111111] outline-none focus:border-[#E8873A] disabled:opacity-60"
                style="min-height: 90px;"
              />
            </div>

            <div>
              <label class="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#AAAAAA]">Légende</label>
              <textarea
                v-model="item.caption"
                :disabled="Boolean(item.contentId)"
                class="mt-1.5 w-full rounded-[10px] border border-[#E5E3DF] bg-[#FAFAF8] p-3 text-sm text-[#111111] outline-none focus:border-[#E8873A] disabled:opacity-60"
                style="min-height: 60px;"
              />
            </div>

            <div>
              <label class="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#AAAAAA]">Hashtags</label>
              <input
                v-model="item.hashtags"
                :disabled="Boolean(item.contentId)"
                class="mt-1.5 w-full rounded-[10px] border border-[#E5E3DF] bg-[#FAFAF8] px-3 py-2 text-sm text-[#111111] outline-none focus:border-[#E8873A] disabled:opacity-60"
              >
            </div>

            <div v-if="!item.contentId" class="flex items-center gap-3">
              <button
                type="button"
                class="rounded-[10px] border px-3 py-2 text-xs font-bold transition-colors disabled:opacity-60"
                :class="isDirty(item)
                  ? 'border-[#E8873A] bg-[#FDF3EA] text-[#B45F1D] hover:bg-[#FAE7D6]'
                  : 'border-[#E5E3DF] bg-white text-[#111111] hover:bg-[#FAFAF8]'"
                :disabled="savingIds.includes(item.id)"
                @click="saveItem(item)"
              >
                {{ savingIds.includes(item.id) ? 'Enregistrement...' : 'Enregistrer' }}
              </button>
              <span v-if="isDirty(item)" class="text-xs font-semibold text-[#B45F1D]">
                Modifications non enregistrées
              </span>
              <span v-else-if="savedIds.includes(item.id)" class="text-xs font-semibold text-[#2F7A4F]">
                Enregistré
              </span>
            </div>
          </div>
        </article>
      </div>
    </template>
  </div>
</template>

<script setup>
const route = useRoute()
const router = useRouter()

const planId = computed(() => String(route.params.id || ''))

const { data, pending, error, refresh } = await useFetch(() => `/api/plans/${planId.value}`, {
  key: computed(() => `plan-${planId.value}`),
})

const plan = computed(() => data.value?.plan ?? null)

// Comment chaque format sera produit (libelles fournis par le serveur, qui connait le moteur actif).
const productionLabels = computed(() => data.value?.productionLabels || {})

function promptLabel(item) {
  // Une video faceless n a pas de scene : l idee est le sujet que la voix va raconter.
  return item.format === 'REEL' && data.value?.reelEngine === 'faceless' ? 'Sujet de la vidéo' : 'Scène à générer'
}

const savingIds = ref([])
const savedIds = ref([])
const approving = ref(false)
const discarding = ref(false)
const feedback = ref('')
const feedbackTone = ref('success')

/**
 * Empreinte du dernier texte enregistre, par idee. Les champs sont modifies
 * localement: sans ce reperage, une scene reecrite puis envoyee directement en
 * generation partait avec l ancien texte, et les credits etaient depenses pour
 * un contenu que l utilisateur ne voulait plus.
 */
const savedSnapshots = ref({})

function snapshotOf(item) {
  return `${item.prompt || ''} ${item.caption || ''} ${item.hashtags || ''}`
}

watch(
  plan,
  (value) => {
    const next = {}
    for (const item of value?.items || []) {
      next[item.id] = snapshotOf(item)
    }
    savedSnapshots.value = next
  },
  { immediate: true },
)

function isDirty(item) {
  if (item.contentId) return false
  const saved = savedSnapshots.value[item.id]
  return saved !== undefined && saved !== snapshotOf(item)
}

const dirtyItems = computed(() => (plan.value?.items || []).filter((item) => isDirty(item)))

const keptCount = computed(() => (plan.value?.items || []).filter((item) => item.keep).length)
const discardedCount = computed(() => (plan.value?.items || []).filter((item) => !item.keep).length)
const alreadyGeneratedCount = computed(() => (plan.value?.items || []).filter((item) => item.contentId).length)

// Seules les idées conservées et pas encore générées engagent des crédits.
const pendingGenerationCount = computed(
  () => (plan.value?.items || []).filter((item) => item.keep && !item.contentId).length,
)

function formatDate(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

async function patchItem(item, body) {
  return await $fetch(`/api/plans/${planId.value}/items/${item.id}`, {
    method: 'PATCH',
    body,
  })
}

async function saveItem(item) {
  savingIds.value = [...savingIds.value, item.id]
  savedIds.value = savedIds.value.filter((id) => id !== item.id)

  try {
    await patchItem(item, {
      prompt: item.prompt,
      caption: item.caption || '',
      hashtags: item.hashtags || '',
    })
    savedSnapshots.value = { ...savedSnapshots.value, [item.id]: snapshotOf(item) }
    savedIds.value = [...savedIds.value, item.id]
    return true
  } catch (err) {
    feedbackTone.value = 'error'
    feedback.value = err?.statusMessage || 'Enregistrement impossible.'
    return false
  } finally {
    savingIds.value = savingIds.value.filter((id) => id !== item.id)
  }
}

async function toggleKeep(item) {
  const next = !item.keep

  try {
    await patchItem(item, { keep: next })
    item.keep = next
  } catch (err) {
    feedbackTone.value = 'error'
    feedback.value = err?.statusMessage || 'Modification impossible.'
  }
}

async function approvePlan() {
  approving.value = true
  feedback.value = ''

  try {
    // Les modifications en attente sont enregistrees d abord: generer a partir
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
    await refresh()
    feedbackTone.value = 'success'
    feedback.value = `${result.launched} génération(s) lancée(s). Les contenus arrivent dans Mes créations, à valider avant publication.`
  } catch (err) {
    feedbackTone.value = 'error'
    feedback.value = err?.statusMessage || 'Approbation impossible.'
  } finally {
    approving.value = false
  }
}

async function discardPlan() {
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
</script>
