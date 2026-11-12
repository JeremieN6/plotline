<template>
  <UiDrawer :open="open" :title="title" :description="description" @update:open="(value) => !value && emit('close')" @close="emit('close')">
    <div v-if="item" class="space-y-5">
      <div class="flex items-center justify-between gap-2">
        <UiBadge :status="badge.status" :label="badge.label" />
        <div class="flex items-center gap-1">
          <UiIconButton label="Contenu précédent" :disabled="!hasPrev" @click="emit('navigate', -1)">
            <svg class="h-4 w-4" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m10 3-5 5 5 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" /></svg>
          </UiIconButton>
          <UiIconButton label="Contenu suivant" :disabled="!hasNext" @click="emit('navigate', 1)">
            <svg class="h-4 w-4" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m6 3 5 5-5 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" /></svg>
          </UiIconButton>
        </div>
      </div>

      <div class="overflow-hidden rounded-ui-card bg-ui-ink">
        <video v-if="isVideo && item.imageUrl" :key="item.id" :src="item.imageUrl" class="max-h-[380px] w-full object-contain" controls playsinline preload="metadata" />
        <img v-else-if="item.imageUrl" :src="item.imageUrl" alt="Aperçu du contenu" class="max-h-[380px] w-full object-contain" />
        <p v-else class="px-4 py-10 text-center text-sm text-ui-ink-muted">{{ item.errorMessage || 'Pas de média' }}</p>
      </div>

      <UiField label="Légende" :for-id="`${uid}-caption`" :hint="locked ? lockedHint : saveLabel">
        <UiTextarea :id="`${uid}-caption`" v-model="body" :rows="6" :disabled="locked" data-autofocus @update:model-value="scheduleSave" />
      </UiField>

      <UiField label="Hashtags" :hint="locked ? '' : 'Ajoutés à la fin de la légende.'">
        <UiTagInput v-model="tags" :disabled="locked" @update:model-value="scheduleSave" />
      </UiField>

      <section aria-label="Historique">
        <h3 class="text-[13px] font-semibold text-ui-ink">Historique</h3>
        <ul class="mt-2 space-y-1 text-sm text-ui-ink-2">
          <li v-for="entry in history" :key="entry">{{ entry }}</li>
        </ul>
      </section>

      <NuxtLink v-if="calendarHref" :to="calendarHref" class="inline-flex min-h-[44px] items-center text-sm font-semibold text-ui-accent hover:text-ui-accent-hover">
        Voir dans le calendrier
      </NuxtLink>
    </div>

    <template #footer>
      <div v-if="item" class="flex flex-wrap items-center gap-2">
        <UiButton v-if="actions.primary === 'validate'" variant="primary" size="sm" :loading="item._loading" @click="emit('validate', item)">Valider</UiButton>
        <UiButton v-if="actions.secondary === 'reject'" size="sm" :disabled="item._loading" @click="emit('reject', item)">Rejeter</UiButton>
        <UiButton v-if="actions.primary === 'publish'" variant="primary" size="sm" :loading="item._loading" :disabled="!defaultTarget" @click="emit('publish', item, defaultTarget.id)">
          Publier sur {{ defaultTarget?.label || '…' }}
        </UiButton>
        <UiButton v-if="actions.secondary === 'schedule'" size="sm" :disabled="item._loading" @click="emit('schedule', item)">Planifier</UiButton>
        <UiButton size="sm" class="ml-auto" @click="emit('fullscreen', item)">Versions et slides</UiButton>
      </div>
    </template>
  </UiDrawer>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, useId, watch } from 'vue'
import { formatPlatforms, readManualPublication } from '~/utils/manualPlatforms'
import { formatShortDate } from '~/utils/formatDate'
import { actionsFor, plannedPlatformsOf, cardStateOf, defaultPublishTarget, isPublishedOn, joinHashtags, captionHook, scheduledBadgeLabel, splitHashtags } from '~/utils/contentCards'

// Panneau de detail d un contenu : lecteur, legende modifiable (sauvegarde automatique), hashtags, historique,
// memes actions que la carte, navigation precedent / suivant. La plein ecran (versions, slides) reste la visionneuse.
const props = defineProps({
  open: { type: Boolean, default: false },
  item: { type: Object, default: null },
  profile: { type: Object, default: null },
  hasPrev: { type: Boolean, default: false },
  hasNext: { type: Boolean, default: false },
})
const emit = defineEmits(['close', 'navigate', 'validate', 'reject', 'publish', 'schedule', 'fullscreen', 'saved'])

const uid = useId()
const { pushToast } = useUiFeedback()

const body = ref('')
const tags = ref([])
const saveState = ref('idle') // idle | saving | saved | error
let timer = null
let saveSeq = 0
let dirty = false

const state = computed(() => (props.item ? cardStateOf(props.item) : 'pending'))
const actions = computed(() => (props.item ? actionsFor(props.item) : { primary: null, secondary: null, menu: [] }))
const defaultTarget = computed(() => defaultPublishTarget(props.profile))
const locked = computed(() => state.value === 'published' || state.value === 'generating')
const lockedHint = computed(() => (state.value === 'published' ? 'Un contenu publié ne peut plus être modifié.' : 'Génération en cours.'))
const isVideo = computed(() => {
  const url = String(props.item?.imageUrl || '').toLowerCase().split('?')[0]
  return ['STORY', 'REEL'].includes(String(props.item?.format || '').toUpperCase()) || url.endsWith('.mp4')
})

const BADGES = {
  pending: { status: 'pending', label: 'En attente' },
  generating: { status: 'generating', label: 'En génération' },
  validated: { status: 'approved', label: 'Validé' },
  published: { status: 'published', label: 'Publié' },
  failed: { status: 'error', label: 'Erreur' },
  rejected: { status: 'empty', label: 'Rejeté' },
}
const badge = computed(() => {
  const scheduled = props.item ? scheduledBadgeLabel(props.item) : ''
  if (scheduled) return { status: 'running', label: scheduled }
  return BADGES[state.value] || BADGES.pending
})
const title = computed(() => captionHook(props.item?.caption).hook.slice(0, 60) || 'Contenu')
const description = computed(() => (props.item ? formatShortDate(props.item.createdAt) : ''))
const saveLabel = computed(() => ({
  saving: 'Enregistrement…',
  saved: 'Enregistré',
  error: 'Échec de l’enregistrement : modifie le texte pour réessayer.',
}[saveState.value] || 'Enregistré automatiquement.'))

const history = computed(() => {
  const item = props.item
  if (!item) return []
  const lines = [`Généré le ${formatShortDate(item.createdAt)}`]
  if (sourceArticle.value) lines.push(`Article d’origine : ${sourceArticle.value}`)
  if (state.value === 'validated' && item.scheduledAt) {
    const networks = formatPlatforms(plannedPlatformsOf(item))
    lines.push(`Planifié le ${formatShortDate(item.scheduledAt)}${networks ? ` sur ${networks}` : ''}`)
  }
  const manual = readManualPublication(item.manualPublication)
  if (manual) lines.push(`Publié à la main sur ${formatPlatforms(manual.platforms)} le ${formatShortDate(manual.at)}`)
  if (isPublishedOn(item, 'INSTAGRAM') && !manual?.platforms.includes('INSTAGRAM')) lines.push(`Publié sur Instagram le ${formatShortDate(item.publishedAt)}`)
  if (isPublishedOn(item, 'X') && !manual?.platforms.includes('X')) lines.push(`Publié sur X le ${formatShortDate(item.twitterPublishedAt)}`)
  return lines
})

const calendarHref = computed(() => {
  const value = props.item?.scheduledAt || props.item?.publishedAt || props.item?.twitterPublishedAt
  const date = value ? new Date(value) : null
  if (!date || Number.isNaN(date.getTime())) return ''
  return `/calendar?month=${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
})

// Article d origine d une video faceless (repere facultatif) : lu a l ouverture, uniquement pour ce type de contenu.
const sourceArticle = ref('')
async function loadSourceArticle() {
  sourceArticle.value = ''
  const item = props.item
  if (!import.meta.client || !item?.id || item.generationModel !== 'faceless') return
  try {
    const info = await $fetch(`/api/content/${item.id}/faceless`)
    if (props.item?.id === item.id) sourceArticle.value = String(info?.sourceArticle || '')
  } catch {
    // repere facultatif : sans consequence
  }
}

let pendingItem = null

function load() {
  clearTimeout(timer)
  const parts = splitHashtags(props.item?.caption)
  body.value = parts.body
  tags.value = parts.tags
  saveState.value = 'idle'
  dirty = false
  pendingItem = null
  loadSourceArticle()
}

// Changer de contenu avec une frappe en attente : on enregistre d abord l ancien (rien n est perdu), puis on charge.
watch(() => props.item?.id, () => {
  flush()
  load()
}, { immediate: true })

function scheduleSave() {
  if (locked.value || !props.item) return
  dirty = true
  pendingItem = props.item
  saveState.value = 'saving'
  clearTimeout(timer)
  timer = setTimeout(save, 800)
}

async function save() {
  const item = pendingItem
  if (!item || !dirty) return
  const caption = joinHashtags(body.value, tags.value)
  const seq = ++saveSeq
  dirty = false
  try {
    await $fetch(`/api/content/${item.id}/caption`, { method: 'PATCH', body: { caption } })
    item.caption = caption
    if (seq === saveSeq && props.item?.id === item.id) saveState.value = 'saved'
    emit('saved', item)
  } catch (err) {
    dirty = true
    if (seq === saveSeq && props.item?.id === item.id) saveState.value = 'error'
    pushToast({
      title: 'Légende non enregistrée',
      message: err?.data?.statusMessage || err?.statusMessage || 'La légende n’a pas pu être enregistrée.',
      tone: 'error',
      duration: 5000,
    })
  }
}

function flush() {
  if (!dirty) return
  clearTimeout(timer)
  save()
}

watch(() => props.open, (value) => { if (!value) flush() })
onBeforeUnmount(flush)
</script>
