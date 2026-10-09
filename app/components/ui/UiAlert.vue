<template>
  <div
    class="rounded-ui-card p-4 font-ui"
    :class="tone === 'error' ? 'border border-ui-danger-line bg-ui-danger-soft' : 'bg-ui-info-soft'"
    :role="tone === 'error' ? 'alert' : 'status'"
  >
    <p v-if="title" class="text-sm font-semibold" :class="tone === 'error' ? 'text-ui-danger-ink' : 'text-ui-info-ink'">{{ title }}</p>
    <div class="text-sm" :class="[title ? 'mt-1' : '', tone === 'error' ? 'text-ui-danger-ink' : 'text-ui-info-ink']"><slot /></div>
    <div v-if="$slots.action" class="mt-3"><slot name="action" /></div>
  </div>
</template>

<script setup>
// Une erreur dit quoi, pourquoi, et propose une action (slot `action`).
defineProps({
  tone: { type: String, default: 'error' }, // error | info
  title: { type: String, default: '' },
})
</script>
