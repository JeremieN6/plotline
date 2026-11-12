<template>
  <!-- Vue grille : media sans bouton dessus, meta + legende, pied d actions selon le statut. -->
  <article
    v-if="view === 'grid'"
    class="group flex flex-col overflow-hidden rounded-ui-card border bg-ui-surface font-ui shadow-sm transition-colors"
    :class="selected ? 'border-ui-accent' : failed ? 'border-ui-danger-line' : 'border-ui-line'"
  >
    <div class="relative aspect-[9/16] w-full overflow-hidden bg-ui-subtle">
      <button type="button" class="absolute inset-0 h-full w-full" :aria-label="`Ouvrir le détail : ${title}`" @click="emit('open', item)">
        <ContentMedia v-if="hasMedia" :src="item.imageUrl" :is-video="isVideo" />
        <span v-else-if="generating" class="flex h-full w-full animate-pulse items-center justify-center bg-ui-subtle text-xs text-ui-ink-muted">Génération en cours…</span>
        <span v-else-if="failed" class="flex h-full w-full items-center justify-center p-4 text-center text-xs text-ui-danger-ink">{{ item.errorMessage || 'Échec de la génération' }}</span>
        <span v-else class="flex h-full w-full items-center justify-center text-xs text-ui-ink-muted">Pas de média</span>
      </button>

      <div class="pointer-events-none absolute left-2 right-2 top-2 flex items-start justify-between gap-2">
        <div class="pointer-events-auto flex items-center gap-1.5">
          <label
            v-if="selectable"
            class="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-[8px] bg-ui-surface/90 shadow-sm transition-opacity focus-within:opacity-100"
            :class="selected || selectionActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'"
          >
            <input
              type="checkbox"
              class="h-4 w-4 accent-ui-accent"
              :checked="selected"
              :aria-label="`Sélectionner : ${title}`"
              @change="emit('toggle-select', item)"
            />
          </label>
          <UiBadge :status="badge.status" :label="badge.label" />
        </div>
        <span class="rounded-full bg-ui-ink/70 px-2 py-0.5 text-[11px] font-semibold text-white">{{ kindLabel }}</span>
      </div>
    </div>

    <div class="flex flex-1 flex-col gap-2 p-3">
      <div class="flex items-center gap-1 text-xs text-ui-ink-muted">
        <span class="min-w-0 flex-1 truncate">{{ metaLine }}</span>
        <button
          v-if="hasCaption"
          type="button"
          class="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-ui-ctl text-ui-ink-2 transition-colors hover:bg-ui-subtle focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ui-accent/20"
          aria-label="Copier la caption"
          title="Copier la caption"
          @click="copy"
        >
          <svg v-if="!copied" class="h-4 w-4" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" stroke="currentColor" stroke-width="1.4" />
            <path d="M10.5 3.5v-.2a1.3 1.3 0 0 0-1.3-1.3H3.3A1.3 1.3 0 0 0 2 3.3v5.9a1.3 1.3 0 0 0 1.3 1.3h.2" stroke="currentColor" stroke-width="1.4" />
          </svg>
          <svg v-else class="h-4 w-4 text-ui-success" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="m3.5 8.5 3 3 6-6.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <span class="sr-only" aria-live="polite">{{ copied ? 'Caption copiée' : '' }}</span>
        </button>
        <UiMenu v-if="menuItems.length" :items="menuItems" @select="onMenu" />
      </div>

      <div v-if="hasCaption" class="min-h-0">
        <p class="line-clamp-2 text-[15px] font-semibold leading-snug text-ui-ink">{{ caption.hook }}</p>
        <p v-if="caption.rest" class="mt-1 line-clamp-2 text-sm leading-relaxed text-ui-ink-2">{{ caption.rest }}</p>
        <button v-if="longCaption" type="button" class="mt-1 text-xs font-semibold text-ui-accent hover:text-ui-accent-hover" @click="emit('open', item)">
          Voir plus
        </button>
      </div>
      <p v-else class="text-sm text-ui-ink-muted">Aucune légende</p>

      <p v-if="platformsLine" class="text-xs text-ui-ink-muted">{{ platformsLine }}</p>
      <p v-if="failed && hasMedia" class="text-xs text-ui-danger-ink">{{ item.errorMessage }}</p>

      <div class="mt-auto flex flex-wrap items-center gap-2 pt-1">
        <div v-if="generating" class="flex items-center gap-2 text-sm text-ui-ink-2" role="status">
          <svg class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-opacity="0.25" stroke-width="3" />
            <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
          </svg>
          En génération… {{ progress }}%
        </div>
        <template v-else>
          <UiButton v-if="actions.primary === 'validate'" variant="primary" size="sm" :loading="item._loading" @click="emit('validate', item)">Valider</UiButton>
          <UiButton v-if="actions.secondary === 'reject'" size="sm" :disabled="item._loading" @click="emit('reject', item)">Rejeter</UiButton>

          <div v-if="actions.primary === 'publish'" class="inline-flex">
            <UiButton
              variant="primary"
              size="sm"
              class="!rounded-r-none"
              :loading="item._loading"
              :disabled="!defaultTarget"
              :title="defaultTarget ? undefined : 'Aucune plateforme connectée'"
              @click="emit('publish', item, defaultTarget.id)"
            >
              Publier
            </UiButton>
            <UiMenu
              :items="publishItems"
              label="Choisir la plateforme"
              trigger-class="h-10 w-10 rounded-r-ui-ctl border-l border-white/30 bg-ui-accent text-white hover:bg-ui-accent-hover"
              @select="onPublishMenu"
            >
              <template #trigger>
                <svg class="h-4 w-4" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m4 6 4 4 4-4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" /></svg>
              </template>
            </UiMenu>
          </div>
          <UiButton v-if="actions.secondary === 'schedule'" size="sm" :disabled="item._loading" @click="emit('schedule', item)">Planifier</UiButton>
          <UiButton v-if="actions.secondary === 'detail'" size="sm" @click="emit('open', item)">Détail</UiButton>
          <UiButton v-if="actions.secondary === 'recover'" size="sm" :loading="item._loading" @click="emit('menu', 'recover', item)">Remettre en « Validé »</UiButton>
        </template>
      </div>
    </div>
  </article>

  <!-- Vue liste : une ligne par contenu. -->
  <article
    v-else
    class="flex items-center gap-3 rounded-ui-card border bg-ui-surface p-2 font-ui shadow-sm"
    :class="selected ? 'border-ui-accent' : failed ? 'border-ui-danger-line' : 'border-ui-line'"
  >
    <label v-if="selectable" class="inline-flex h-11 w-8 shrink-0 cursor-pointer items-center justify-center">
      <input type="checkbox" class="h-4 w-4 accent-ui-accent" :checked="selected" :aria-label="`Sélectionner : ${title}`" @change="emit('toggle-select', item)" />
    </label>
    <button type="button" class="relative h-14 w-14 shrink-0 overflow-hidden rounded-ui-ctl" :aria-label="`Ouvrir le détail : ${title}`" @click="emit('open', item)">
      <ContentMedia v-if="hasMedia" :src="item.imageUrl" :is-video="isVideo" compact />
      <span v-else class="flex h-full w-full items-center justify-center bg-ui-subtle text-[10px] text-ui-ink-muted">—</span>
    </button>
    <div class="min-w-0 flex-1">
      <p class="truncate text-[15px] font-semibold text-ui-ink">{{ title }}</p>
      <p class="truncate text-xs text-ui-ink-muted">{{ metaLine }}<template v-if="platformsLine"> · {{ platformsLine }}</template></p>
    </div>
    <UiBadge class="hidden shrink-0 sm:inline-flex" :status="badge.status" :label="badge.label" />
    <div class="flex shrink-0 items-center gap-2">
      <template v-if="generating">
        <span class="text-xs text-ui-ink-2" role="status">En génération… {{ progress }}%</span>
      </template>
      <template v-else>
        <UiButton v-if="actions.primary === 'validate'" variant="primary" size="sm" :loading="item._loading" @click="emit('validate', item)">Valider</UiButton>
        <UiButton v-if="actions.secondary === 'reject'" size="sm" class="hidden sm:inline-flex" :disabled="item._loading" @click="emit('reject', item)">Rejeter</UiButton>
        <UiButton
          v-if="actions.primary === 'publish'"
          variant="primary"
          size="sm"
          :loading="item._loading"
          :disabled="!defaultTarget"
          @click="emit('publish', item, defaultTarget.id)"
        >
          Publier
        </UiButton>
        <UiButton v-if="actions.secondary === 'schedule'" size="sm" class="hidden sm:inline-flex" :disabled="item._loading" @click="emit('schedule', item)">Planifier</UiButton>
        <UiButton v-if="actions.secondary === 'detail'" size="sm" @click="emit('open', item)">Détail</UiButton>
        <UiButton v-if="actions.secondary === 'recover'" size="sm" :loading="item._loading" @click="emit('menu', 'recover', item)">Remettre en « Validé »</UiButton>
      </template>
      <UiMenu v-if="menuItems.length" :items="menuItems" @select="onMenu" />
    </div>
  </article>
</template>

<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'
import { formatShortDate } from '~/utils/formatDate'
import { formatPlatforms, readManualPublication } from '~/utils/manualPlatforms'
import { actionsFor, cardStateOf, defaultPublishTarget, isPublishedOn, isScheduleOverdue, needsConfirmation, publishTargets, captionHook, scheduledBadgeLabel } from '~/utils/contentCards'

// Carte d un contenu (grille ou liste). Elle n execute aucune action : elle emet, la page agit.
const props = defineProps({
  item: { type: Object, required: true },
  profile: { type: Object, default: null },
  view: { type: String, default: 'grid' }, // grid | list
  selected: { type: Boolean, default: false },
  selectable: { type: Boolean, default: true },
  selectionActive: { type: Boolean, default: false },
  canEdit: { type: Boolean, default: false },
  editHref: { type: String, default: '' },
  slideCount: { type: Number, default: 0 },
  progress: { type: Number, default: 0 },
})
const emit = defineEmits(['open', 'validate', 'reject', 'publish', 'schedule', 'toggle-select', 'menu'])

const state = computed(() => cardStateOf(props.item))
const generating = computed(() => state.value === 'generating')
const failed = computed(() => state.value === 'failed')
// Un contenu en erreur garde son media s il en a un (publication ratee : la video existe toujours et doit rester visible).
const hasMedia = computed(() => Boolean(String(props.item.imageUrl || '').trim()) && !generating.value)
const isVideo = computed(() => {
  const format = String(props.item.format || '').toUpperCase()
  const url = String(props.item.imageUrl || '').toLowerCase().split('?')[0]
  return format === 'STORY' || format === 'REEL' || url.endsWith('.mp4')
})
const kindLabel = computed(() => {
  if (props.slideCount > 1) return `Carrousel · ${props.slideCount}`
  return isVideo.value ? 'Vidéo' : 'Image'
})

const BADGES = {
  pending: { status: 'pending', label: 'En attente' },
  generating: { status: 'generating', label: 'En génération' },
  validated: { status: 'approved', label: 'Validé' },
  published: { status: 'published', label: 'Publié' },
  failed: { status: 'error', label: 'Erreur' },
  rejected: { status: 'empty', label: 'Rejeté' },
}
// Un contenu valide dont la publication est planifiee affiche « Programmé le ... » a la place de « Validé ».
const badge = computed(() => {
  const scheduled = scheduledBadgeLabel(props.item)
  if (scheduled) return { status: needsConfirmation(props.item) ? 'pending' : 'running', label: scheduled }
  return BADGES[state.value] || BADGES.pending
})

const actions = computed(() => actionsFor(props.item))
const caption = computed(() => captionHook(props.item.caption))
const hasCaption = computed(() => Boolean(caption.value.hook))
const title = computed(() => caption.value.hook || 'Contenu sans légende')
const longCaption = computed(() => caption.value.hook.length > 70 || caption.value.rest.length > 110)

function timeAgo(value) {
  const diff = Date.now() - new Date(value).getTime()
  const minutes = Math.floor(diff / 60000)
  if (!Number.isFinite(minutes) || minutes < 1) return 'À l’instant'
  if (minutes < 60) return `Il y a ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `Il y a ${hours} h`
  return `Il y a ${Math.floor(hours / 24)} j`
}

const MODEL_LABELS = { gemini: 'Gemini', veo: 'Veo', kling: 'Kling', seedance: 'Seedance', faceless: 'Faceless', 'gemini-omni': 'Omni Flash' }
function modelLabel(model) {
  const value = String(model || '').trim().toLowerCase()
  if (!value) return ''
  const key = Object.keys(MODEL_LABELS).find((name) => value.startsWith(name))
  return key ? MODEL_LABELS[key] : model
}

const metaLine = computed(() => [timeAgo(props.item.createdAt), modelLabel(props.item.generationModel), props.item.campaign?.name].filter(Boolean).join(' · '))

// Plateformes deja publiees (ligne discrete sous la legende, comme l ancien « IG / X »).
const platformsLine = computed(() => {
  if (state.value !== 'published') {
    // Date a venir : deja dans la pastille. Date passee sans publication : on le dit.
    return isScheduleOverdue(props.item) ? `Date de publication dépassée (${formatShortDate(props.item.scheduledAt)})` : ''
  }
  const manual = readManualPublication(props.item.manualPublication)
  const names = []
  if (isPublishedOn(props.item, 'INSTAGRAM')) names.push('INSTAGRAM')
  if (isPublishedOn(props.item, 'X')) names.push('X')
  for (const platform of manual?.platforms || []) if (!names.includes(platform)) names.push(platform)
  return names.length ? `Publié sur ${formatPlatforms(names)}` : ''
})

// Plateformes de publication.
const targets = computed(() => publishTargets(props.profile))
const defaultTarget = computed(() => defaultPublishTarget(props.profile))
const settingsHref = computed(() => (props.profile?.id ? `/profiles/${props.profile.id}/edit` : '/profiles'))
const publishItems = computed(() => {
  const items = targets.value.map((target) => ({
    key: `publish:${target.id}`,
    label: target.label,
    disabled: !target.connected,
    hint: target.connected ? '' : 'Non connecté',
    platform: target.id,
  }))
  if (targets.value.some((target) => !target.connected)) {
    items.push({ key: 'connect', label: 'Connecter dans les paramètres', to: settingsHref.value })
  }
  return items
})

const MENU_LABELS = {
  cancelSchedule: 'Annuler la programmation',
  markPublished: 'Marquer comme publié',
  unvalidate: 'Remettre en attente',
  cancelManual: 'Annuler la publication manuelle',
  copy: 'Copier la caption',
  delete: 'Supprimer',
}

const menuItems = computed(() => {
  const items = []
  for (const key of actions.value.menu) {
    if (key === 'edit') {
      if (props.canEdit && props.editHref) items.push({ key, label: 'Modifier', to: props.editHref })
      continue
    }
    if (key === 'delete') {
      if (items.length) items.push({ key: 'sep', separator: true })
      items.push({ key, label: MENU_LABELS.delete, danger: true })
      continue
    }
    items.push({ key, label: MENU_LABELS[key] || key })
  }
  // Un contenu publie sur une seule plateforme reste publiable sur l autre (si elle est connectee).
  if (state.value === 'published' && !readManualPublication(props.item.manualPublication)) {
    const extra = targets.value
      .filter((target) => target.connected && !isPublishedOn(props.item, target.id))
      .map((target) => ({ key: `publish:${target.id}`, label: `Publier sur ${target.label}`, platform: target.id }))
    items.unshift(...extra)
  }
  return items
})

const copied = ref(false)
let copyTimer = null

async function copy() {
  try {
    await navigator.clipboard.writeText(props.item.caption || '')
    copied.value = true
    clearTimeout(copyTimer)
    copyTimer = setTimeout(() => { copied.value = false }, 1500)
  } catch {
    // Presse-papiers refuse : rien a faire.
  }
}

function onMenu(entry) {
  if (entry.key === 'copy') return copy()
  if (entry.platform) return emit('publish', props.item, entry.platform)
  emit('menu', entry.key, props.item)
}

function onPublishMenu(entry) {
  if (entry.platform) emit('publish', props.item, entry.platform)
}

onBeforeUnmount(() => clearTimeout(copyTimer))
</script>
