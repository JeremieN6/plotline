<template>
  <div class="flex gap-1 rounded-ui-ctl bg-ui-subtle p-1 font-ui" role="radiogroup" :aria-label="label || undefined">
    <button
      v-for="option in normalized"
      :key="option.value"
      type="button"
      role="radio"
      :aria-checked="option.value === modelValue ? 'true' : 'false'"
      :disabled="disabled"
      class="h-9 flex-1 rounded-[8px] px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ui-accent/20 disabled:cursor-not-allowed"
      :class="option.value === modelValue ? 'bg-ui-surface font-semibold text-ui-ink shadow-sm' : 'text-ui-ink-muted hover:text-ui-ink'"
      @click="emit('update:modelValue', option.value)"
    >
      {{ option.label }}
    </button>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  modelValue: { type: [String, Number], default: '' },
  // 2 a 4 choix exclusifs ; au-dela, utiliser UiSelect.
  options: { type: Array, default: () => [] },
  label: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue'])

const normalized = computed(() => props.options.map((option) => (
  typeof option === 'object' && option !== null
    ? { value: option.value, label: option.label ?? option.value }
    : { value: option, label: option }
)))
</script>
