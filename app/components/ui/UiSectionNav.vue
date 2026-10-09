<template>
  <nav class="grid gap-0.5 font-ui" :aria-label="label">
    <button
      v-for="item in items"
      :key="item.key"
      type="button"
      class="flex min-h-11 items-center gap-3 rounded-ui-ctl px-3 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ui-accent/20"
      :class="item.key === active ? 'bg-ui-accent-soft font-semibold text-ui-ink' : 'text-ui-ink hover:bg-ui-subtle'"
      :aria-current="item.key === active ? 'true' : undefined"
      @click="emit('update:active', item.key)"
    >
      <span class="flex h-5 w-5 shrink-0 items-center justify-center">
        <svg v-if="item.status === 'running'" class="h-5 w-5 animate-spin text-ui-accent" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="1.8" stroke-dasharray="3 3" />
        </svg>
        <svg v-else-if="item.status === 'error'" class="h-5 w-5 text-ui-danger" viewBox="0 0 20 20" aria-hidden="true">
          <circle cx="10" cy="10" r="9" fill="currentColor" />
          <path d="M10 5.5v5.5M10 13.4v.1" stroke="#fff" stroke-width="1.8" stroke-linecap="round" />
        </svg>
        <svg v-else-if="item.key === active" class="h-5 w-5 text-ui-accent" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <circle cx="10" cy="10" r="8.2" stroke="currentColor" stroke-width="1.8" />
          <circle cx="10" cy="10" r="3.4" fill="currentColor" />
        </svg>
        <svg v-else-if="item.status === 'ready' || item.status === 'edited' || item.status === 'profile'" class="h-5 w-5 text-ui-success" viewBox="0 0 20 20" aria-hidden="true">
          <circle cx="10" cy="10" r="9" fill="currentColor" />
          <path d="m6 10.3 2.7 2.7L14 7.6" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none" />
        </svg>
        <svg v-else class="h-5 w-5 text-ui-line-input" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <circle cx="10" cy="10" r="8.2" stroke="currentColor" stroke-width="1.8" />
        </svg>
      </span>
      <span class="min-w-0 flex-1 truncate" :class="item.status === 'empty' && item.key !== active ? 'text-ui-ink-muted' : ''">{{ item.label }}</span>
      <span class="shrink-0 text-xs font-semibold" :class="statusClass(item.status)">{{ statusLabel(item.status) }}</span>
    </button>
  </nav>
</template>

<script setup>
defineProps({
  // [{ key, label, status: ready | edited | review | running | error | empty }]
  items: { type: Array, default: () => [] },
  active: { type: String, default: '' },
  label: { type: String, default: 'Sections' },
})
const emit = defineEmits(['update:active'])

const LABELS = { ready: 'prêt', edited: 'modifié', review: 'à relire', running: 'en cours', error: 'échec', empty: 'vide', profile: 'du profil', pending: 'en attente' }

const statusLabel = (status) => LABELS[status] || ''
function statusClass(status) {
  if (status === 'ready') return 'text-ui-success'
  if (status === 'edited') return 'text-ui-info-ink'
  if (status === 'error') return 'text-ui-danger'
  if (status === 'review' || status === 'running') return 'text-ui-accent'
  return 'font-normal text-ui-ink-muted'
}
</script>
