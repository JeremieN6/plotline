<template>
  <div class="font-ui">
    <div class="flex items-baseline justify-between gap-3">
      <label :for="id" class="text-[13px] font-semibold text-ui-ink">{{ label }}</label>
      <span class="font-ui-mono text-[13px] font-medium text-ui-ink">{{ modelValue }}</span>
    </div>
    <input
      :id="id"
      type="range"
      :min="min"
      :max="max"
      :step="step"
      :value="modelValue"
      :disabled="disabled"
      class="mt-2 h-6 w-full cursor-pointer accent-ui-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ui-accent/20 disabled:cursor-not-allowed disabled:opacity-60"
      @input="emit('update:modelValue', Number($event.target.value))"
    >
  </div>
</template>

<script setup>
defineProps({
  modelValue: { type: Number, default: 0 },
  label: { type: String, required: true },
  id: { type: String, required: true },
  min: { type: Number, default: 0 },
  max: { type: Number, default: 1 },
  step: { type: Number, default: 0.1 },
  disabled: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue'])
</script>
