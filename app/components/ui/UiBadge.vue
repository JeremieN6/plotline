<template>
  <span class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-ui text-xs font-semibold" :class="entry.classes">
    <span v-if="entry.dot" class="h-2 w-2 shrink-0 rounded-full" :class="entry.dot" aria-hidden="true" />
    <svg v-if="entry.spinner" class="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-opacity="0.25" stroke-width="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
    </svg>
    <svg v-if="entry.check" class="h-3 w-3" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="m2.5 6.5 2.2 2.2L9.5 3.8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
    <slot>{{ label || entry.label }}</slot>
  </span>
</template>

<script setup>
import { computed } from 'vue'
import { CONTENT_STATUSES, CONTENT_TYPES } from '../../utils/contentTypes.js'

const STATUSES = {
  ready: { label: 'Prêt', classes: 'bg-ui-success-soft text-ui-success-ink' },
  edited: { label: 'Modifié', classes: 'bg-ui-info-soft text-ui-info-ink' },
  profile: { label: 'Du profil', classes: 'bg-ui-info-soft text-ui-info-ink' },
  review: { label: 'À relire', classes: 'bg-ui-accent-soft text-ui-accent-ink' },
  running: { label: 'En cours', classes: 'bg-ui-accent-soft text-ui-accent-ink' },
  error: { label: 'Échec', classes: 'bg-ui-danger-soft text-ui-danger-ink' },
  empty: { label: 'Vide', classes: 'bg-ui-subtle text-ui-ink-muted' },
  pending: { label: 'En attente', classes: 'bg-ui-subtle text-ui-ink-muted' },
}

const props = defineProps({
  // ready | edited | profile | review | running | error | empty | pending, ou un statut de contenu planifie :
  // draft | approved | generating | published (source : utils/contentTypes.js)
  status: { type: String, default: 'empty' },
  // feed | reel | story : badge de type de contenu (pastille de la couleur du type + libelle)
  type: { type: String, default: '' },
  label: { type: String, default: '' },
})

const entry = computed(() => {
  if (props.type && CONTENT_TYPES[props.type]) {
    const type = CONTENT_TYPES[props.type]
    return { label: type.label, classes: type.badge, dot: type.dot }
  }
  if (CONTENT_STATUSES[props.status]) {
    const status = CONTENT_STATUSES[props.status]
    return { label: status.label, classes: status.badge, spinner: status.spinner, check: status.check }
  }
  return STATUSES[props.status] || STATUSES.empty
})
</script>
