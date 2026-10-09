<template>
  <div class="relative font-ui">
    <select
      v-bind="$attrs"
      :value="modelValue"
      class="h-11 w-full appearance-none rounded-ui-ctl border border-ui-line-input bg-ui-surface pl-3 pr-10 text-sm text-ui-ink outline-none transition-shadow focus-visible:border-ui-accent focus-visible:ring-[3px] focus-visible:ring-ui-accent/20 disabled:cursor-not-allowed disabled:bg-ui-subtle disabled:text-ui-ink-muted"
      @change="emit('update:modelValue', $event.target.value)"
    >
      <option v-for="option in normalized" :key="option.value" :value="option.value" :disabled="option.disabled">
        {{ option.label }}
      </option>
    </select>
    <svg class="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ui-ink-muted" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="m5 7.5 5 5 5-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  </div>
</template>

<script setup>
import { computed } from 'vue'

defineOptions({ inheritAttrs: false })

const props = defineProps({
  modelValue: { type: [String, Number], default: '' },
  // Chaines ou { value, label, disabled }.
  options: { type: Array, default: () => [] },
})
const emit = defineEmits(['update:modelValue'])

const normalized = computed(() => props.options.map((option) => (
  typeof option === 'object' && option !== null
    ? { value: option.value, label: option.label ?? option.value, disabled: Boolean(option.disabled) }
    : { value: option, label: option, disabled: false }
)))
</script>
