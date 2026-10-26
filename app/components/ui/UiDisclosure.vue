<template>
  <div class="font-ui">
    <button
      :id="`${uid}-btn`"
      type="button"
      class="flex min-h-11 w-full items-center gap-2 rounded-ui-ctl text-left text-[13px] font-semibold text-ui-ink-2 hover:text-ui-ink focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ui-accent/20"
      :aria-expanded="isOpen ? 'true' : 'false'"
      :aria-controls="`${uid}-panel`"
      @click="toggle"
    >
      <svg class="h-4 w-4 shrink-0 transition-transform" :class="isOpen ? 'rotate-90' : ''" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="m6 3.5 4.5 4.5L6 12.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
      <span><slot name="title">{{ title }}</slot></span>
      <span v-if="hint" class="ml-auto text-xs font-normal text-ui-ink-muted">{{ hint }}</span>
    </button>
    <div v-show="isOpen" :id="`${uid}-panel`" role="region" :aria-labelledby="`${uid}-btn`" class="pb-1 pt-1">
      <slot />
    </div>
  </div>
</template>

<script setup>
import { ref, useId } from 'vue'

// Depliant ferme par defaut ; `v-model:open` facultatif pour piloter l etat depuis la page.
const props = defineProps({
  title: { type: String, default: '' },
  hint: { type: String, default: '' },
  open: { type: Boolean, default: false },
})
const emit = defineEmits(['update:open'])

const uid = useId()
const isOpen = ref(props.open)

function toggle() {
  isOpen.value = !isOpen.value
  emit('update:open', isOpen.value)
}
</script>
