<template>
  <div class="font-ui">
    <div v-if="label" class="flex items-baseline justify-between gap-3">
      <span class="text-[15px] font-semibold text-ui-ink">{{ label }}</span>
      <span class="font-ui-mono text-[13px] font-medium text-ui-ink-2">{{ value }} / {{ max }}</span>
    </div>
    <div
      class="h-1.5 overflow-hidden rounded-full bg-ui-line-soft"
      :class="label ? 'mt-2' : ''"
      role="progressbar"
      :aria-valuenow="value"
      :aria-valuemin="0"
      :aria-valuemax="max"
      :aria-label="label || 'Progression'"
    >
      <div class="h-full rounded-full bg-ui-accent transition-all duration-300" :style="{ width: percent + '%' }" />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  value: { type: Number, default: 0 },
  max: { type: Number, default: 100 },
  label: { type: String, default: '' },
})

const percent = computed(() => (props.max > 0 ? Math.min(100, Math.max(0, (props.value / props.max) * 100)) : 0))
</script>
