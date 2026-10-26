<template>
  <button
    type="button"
    role="switch"
    :aria-checked="modelValue ? 'true' : 'false'"
    :disabled="disabled"
    class="inline-flex min-h-11 items-center gap-3 rounded-ui-ctl pr-1 font-ui text-sm font-semibold text-ui-ink focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ui-accent/20 disabled:cursor-not-allowed disabled:text-ui-ink-muted"
    @click="emit('update:modelValue', !modelValue)"
  >
    <span
      class="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors"
      :class="modelValue ? 'bg-ui-accent' : 'bg-ui-line-input'"
      aria-hidden="true"
    >
      <span
        class="absolute left-0.5 h-5 w-5 rounded-full bg-ui-surface shadow transition-transform"
        :class="modelValue ? 'translate-x-5' : 'translate-x-0'"
      />
    </span>
    <span><slot>{{ label }}</slot></span>
  </button>
</template>

<script setup>
// Interrupteur avec libelle visible (cible >= 44 px : tout le bouton est cliquable).
defineProps({
  modelValue: { type: Boolean, default: false },
  label: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue'])
</script>
