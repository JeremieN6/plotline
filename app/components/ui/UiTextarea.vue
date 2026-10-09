<template>
  <div class="font-ui">
    <textarea
      v-bind="$attrs"
      :value="modelValue"
      :rows="rows"
      :maxlength="maxlength || undefined"
      :aria-invalid="invalid ? 'true' : undefined"
      class="w-full resize-y rounded-ui-ctl border bg-ui-surface px-3 py-2.5 text-sm leading-6 text-ui-ink outline-none transition-shadow placeholder:text-ui-ink-muted focus-visible:border-ui-accent focus-visible:ring-[3px] focus-visible:ring-ui-accent/20 disabled:cursor-not-allowed disabled:bg-ui-subtle disabled:text-ui-ink-muted"
      :class="invalid ? 'border-ui-danger' : 'border-ui-line-input'"
      @input="emit('update:modelValue', $event.target.value)"
    />
    <!-- Compteur visible seulement a partir de 80 % de la limite. -->
    <p v-if="showCounter" class="mt-1 text-right font-ui-mono text-xs" :class="length >= maxlength ? 'text-ui-danger' : 'text-ui-accent'">
      {{ length }} / {{ maxlength }}
    </p>
  </div>
</template>

<script setup>
import { computed } from 'vue'

defineOptions({ inheritAttrs: false })

const props = defineProps({
  modelValue: { type: String, default: '' },
  maxlength: { type: Number, default: 0 },
  rows: { type: Number, default: 3 },
  invalid: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue'])

const length = computed(() => String(props.modelValue || '').length)
const showCounter = computed(() => props.maxlength > 0 && length.value >= props.maxlength * 0.8)
</script>
