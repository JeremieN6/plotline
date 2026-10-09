<template>
  <input
    v-bind="$attrs"
    :type="type"
    :value="modelValue"
    :aria-invalid="invalid ? 'true' : undefined"
    class="h-11 w-full rounded-ui-ctl border bg-ui-surface px-3 font-ui text-sm text-ui-ink outline-none transition-shadow placeholder:text-ui-ink-muted focus-visible:border-ui-accent focus-visible:ring-[3px] focus-visible:ring-ui-accent/20 disabled:cursor-not-allowed disabled:bg-ui-subtle disabled:text-ui-ink-muted"
    :class="invalid ? 'border-ui-danger' : 'border-ui-line-input'"
    @input="emit('update:modelValue', $event.target.value)"
  >
</template>

<script setup>
defineOptions({ inheritAttrs: false })

defineProps({
  modelValue: { type: [String, Number], default: '' },
  type: { type: String, default: 'text' },
  invalid: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue'])
</script>
