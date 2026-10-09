<template>
  <div class="flex flex-wrap gap-2 font-ui" role="group" :aria-label="label || undefined">
    <button
      v-for="option in normalized"
      :key="option.value"
      type="button"
      :aria-pressed="isOn(option.value) ? 'true' : 'false'"
      :disabled="disabled"
      class="h-9 rounded-full border px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ui-accent/20 disabled:cursor-not-allowed disabled:opacity-60"
      :class="isOn(option.value)
        ? 'border-ui-accent bg-ui-accent-soft text-ui-accent-ink'
        : 'border-ui-line-input bg-ui-surface text-ui-ink-2 hover:bg-ui-subtle'"
      @click="toggle(option.value)"
    >
      {{ option.label }}
    </button>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  modelValue: { type: Array, default: () => [] },
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

const isOn = (value) => props.modelValue.includes(value)

function toggle(value) {
  emit('update:modelValue', isOn(value)
    ? props.modelValue.filter((item) => item !== value)
    : [...props.modelValue, value])
}
</script>
