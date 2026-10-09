<template>
  <div class="rounded-ui-card border border-dashed border-ui-line-input bg-ui-surface px-6 py-8 text-center font-ui">
    <p class="text-[15px] font-semibold text-ui-ink">{{ title }}</p>
    <p v-if="text" class="mt-1 text-sm text-ui-ink-muted">{{ text }}</p>
    <div v-if="$slots.action" class="mt-4 flex justify-center"><slot name="action" /></div>
  </div>
</template>

<script setup>
defineProps({
  title: { type: String, required: true },
  text: { type: String, default: '' },
})
</script>
