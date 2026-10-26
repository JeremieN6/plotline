<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-50 font-ui">
      <div class="absolute inset-0 bg-ui-ink/35" aria-hidden="true" @click="close" />
      <aside
        ref="panelRef"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
        tabindex="-1"
        class="absolute right-0 top-0 flex h-full w-full max-w-[420px] flex-col border-l border-ui-line bg-ui-surface shadow-2xl focus-visible:outline-none"
        @keydown.esc.stop.prevent="close"
        @keydown.tab="trapFocus"
      >
        <header class="flex items-start justify-between gap-3 border-b border-ui-line-soft px-5 py-4">
          <div class="min-w-0">
            <h2 :id="titleId" class="text-[17px] font-semibold text-ui-ink">{{ title }}</h2>
            <p v-if="description" class="mt-0.5 text-xs text-ui-ink-muted">{{ description }}</p>
          </div>
          <UiIconButton label="Fermer" @click="close">
            <svg class="h-4 w-4" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
            </svg>
          </UiIconButton>
        </header>

        <div class="min-h-0 flex-1 overflow-y-auto px-5 py-4"><slot /></div>

        <footer v-if="$slots.footer" class="border-t border-ui-line-soft bg-ui-surface px-5 py-4"><slot name="footer" /></footer>
      </aside>
    </div>
  </Teleport>
</template>

<script setup>
import { nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'

// Panneau lateral droit (420 px max) : Echap et clic exterieur ferment, le focus reste dans le panneau et revient
// a l'element qui l'a ouvert. `v-model:open`.
const props = defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, required: true },
  description: { type: String, default: '' },
})
const emit = defineEmits(['update:open', 'close'])

const titleId = useId()
const panelRef = ref(null)
let opener = null
let previousOverflow = ''

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

function close() {
  emit('update:open', false)
  emit('close')
}

function trapFocus(event) {
  const items = [...(panelRef.value?.querySelectorAll(FOCUSABLE) || [])].filter((el) => el.offsetParent !== null)
  if (!items.length) {
    event.preventDefault()
    return
  }
  const first = items[0]
  const last = items[items.length - 1]
  if (event.shiftKey && (document.activeElement === first || document.activeElement === panelRef.value)) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

watch(
  () => props.open,
  async (isOpen) => {
    if (!import.meta.client) return
    if (isOpen) {
      opener = document.activeElement
      previousOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      await nextTick()
      const target = panelRef.value?.querySelector('[data-autofocus]') || panelRef.value?.querySelector(FOCUSABLE) || panelRef.value
      target?.focus()
    } else {
      document.body.style.overflow = previousOverflow
      opener?.focus?.()
      opener = null
    }
  },
)

onBeforeUnmount(() => {
  if (import.meta.client && props.open) document.body.style.overflow = previousOverflow
})
</script>
