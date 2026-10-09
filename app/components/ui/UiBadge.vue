<template>
  <span class="inline-flex items-center rounded-full px-2.5 py-0.5 font-ui text-xs font-semibold" :class="entry.classes">
    <slot>{{ label || entry.label }}</slot>
  </span>
</template>

<script setup>
import { computed } from 'vue'

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
  status: { type: String, default: 'empty' }, // ready | edited | profile | review | running | error | empty | pending
  label: { type: String, default: '' },
})

const entry = computed(() => STATUSES[props.status] || STATUSES.empty)
</script>
