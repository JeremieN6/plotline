<template>
  <div
    class="flex min-h-11 flex-wrap items-center gap-2 rounded-ui-ctl border border-ui-line-input bg-ui-surface px-2.5 py-2 font-ui transition-shadow focus-within:border-ui-accent focus-within:ring-[3px] focus-within:ring-ui-accent/20"
    :class="disabled ? 'bg-ui-subtle' : ''"
    @click="focusInput"
  >
    <span
      v-for="(tag, index) in modelValue"
      :key="`${tag}-${index}`"
      class="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm"
      :class="tone === 'danger' ? 'bg-ui-danger-soft text-ui-danger-ink' : 'bg-ui-subtle text-ui-ink'"
    >
      {{ tag }}
      <button
        v-if="!disabled"
        type="button"
        class="inline-flex h-5 w-5 items-center justify-center rounded-full opacity-70 hover:opacity-100 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ui-accent/20"
        :aria-label="`Retirer ${tag}`"
        @click.stop="removeAt(index)"
      >
        <svg class="h-3 w-3" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path d="m3 3 6 6M9 3 3 9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
        </svg>
      </button>
    </span>
    <input
      v-if="!disabled && !full"
      ref="inputRef"
      v-model="draft"
      v-bind="$attrs"
      type="text"
      :maxlength="itemMax || undefined"
      :placeholder="placeholder"
      class="min-w-[8rem] flex-1 bg-transparent py-1 text-sm text-ui-ink outline-none placeholder:text-ui-ink-muted"
      @keydown="onKeydown"
      @blur="commit"
    >
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'

defineOptions({ inheritAttrs: false })

const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  tone: { type: String, default: 'default' }, // default | danger
  placeholder: { type: String, default: 'Ajouter…' },
  maxItems: { type: Number, default: 0 },
  itemMax: { type: Number, default: 0 },
  disabled: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue'])

const draft = ref('')
const inputRef = ref(null)
const full = computed(() => props.maxItems > 0 && props.modelValue.length >= props.maxItems)

function focusInput() {
  inputRef.value?.focus()
}

function commit() {
  const value = draft.value.trim()
  draft.value = ''
  if (!value || full.value) return
  if (props.modelValue.some((tag) => tag.toLowerCase() === value.toLowerCase())) return
  emit('update:modelValue', [...props.modelValue, value])
}

function removeAt(index) {
  emit('update:modelValue', props.modelValue.filter((_, position) => position !== index))
}

function onKeydown(event) {
  if (event.key === 'Enter' || event.key === ',') {
    event.preventDefault()
    commit()
  } else if (event.key === 'Backspace' && !draft.value && props.modelValue.length) {
    removeAt(props.modelValue.length - 1)
  }
}
</script>
