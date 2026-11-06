<template>
  <div ref="rootRef" class="relative inline-block font-ui" @keydown.esc.stop.prevent="close(true)">
    <button
      ref="triggerRef"
      type="button"
      :aria-label="label"
      :title="label"
      aria-haspopup="menu"
      :aria-expanded="open ? 'true' : 'false'"
      :disabled="disabled"
      class="inline-flex items-center justify-center font-ui transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ui-accent/20 disabled:cursor-not-allowed"
      :class="triggerClass || 'h-11 w-11 rounded-ui-ctl text-ui-ink-2 hover:bg-ui-subtle disabled:text-ui-ink-muted'"
      @click="toggle"
      @keydown.down.prevent="openAndFocus(0)"
      @keydown.up.prevent="openAndFocus(-1)"
    >
      <slot name="trigger">
        <svg class="h-4 w-4" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <circle cx="3" cy="8" r="1.4" /><circle cx="8" cy="8" r="1.4" /><circle cx="13" cy="8" r="1.4" />
        </svg>
      </slot>
    </button>

    <div
      v-if="open"
      role="menu"
      :aria-label="label"
      class="absolute z-30 mt-1 min-w-[220px] rounded-ui-ctl border border-ui-line bg-ui-surface p-1 shadow-lg"
      :class="align === 'left' ? 'left-0' : 'right-0'"
      @keydown.down.prevent="move(1)"
      @keydown.up.prevent="move(-1)"
      @keydown.home.prevent="focusAt(0)"
      @keydown.end.prevent="focusAt(-1)"
      @keydown.tab="close(false)"
    >
      <template v-for="(item, index) in items" :key="item.key || index">
        <div v-if="item.separator" class="my-1 border-t border-ui-line-soft" role="separator" />
        <NuxtLink
          v-else-if="item.to"
          :to="item.to"
          role="menuitem"
          data-menu-item
          class="flex min-h-[44px] items-center gap-2 rounded-[8px] px-3 py-2 text-sm text-ui-accent transition-colors hover:bg-ui-accent-soft focus-visible:bg-ui-accent-soft focus-visible:outline-none"
          @click="close(false)"
        >
          {{ item.label }}
        </NuxtLink>
        <button
          v-else
          type="button"
          role="menuitem"
          data-menu-item
          :disabled="item.disabled"
          class="flex min-h-[44px] w-full items-center gap-2 rounded-[8px] px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none disabled:cursor-not-allowed disabled:text-ui-ink-muted"
          :class="item.danger
            ? 'text-ui-danger-ink hover:bg-ui-danger-soft focus-visible:bg-ui-danger-soft'
            : 'text-ui-ink hover:bg-ui-subtle focus-visible:bg-ui-subtle'"
          @click="select(item)"
        >
          <span class="min-w-0 flex-1">{{ item.label }}</span>
          <span v-if="item.hint" class="shrink-0 text-xs text-ui-ink-muted">{{ item.hint }}</span>
        </button>
      </template>
    </div>
  </div>
</template>

<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

// Menu d actions (bouton « ⋯ » ou autre declencheur). Fleches, Debut, Fin, Echap et clic exterieur.
// `items` : { key, label, danger?, disabled?, hint?, to?, separator? }. `select` renvoie l entree choisie.
// Une entree `to` est un lien (ex. « Connecter dans les parametres »).
const props = defineProps({
  items: { type: Array, default: () => [] },
  label: { type: String, default: 'Plus d’actions' },
  align: { type: String, default: 'right' }, // right | left
  disabled: { type: Boolean, default: false },
  // Remplace l apparence du declencheur (ex. fleche d un bouton scinde).
  triggerClass: { type: String, default: '' },
})
const emit = defineEmits(['select'])

const open = ref(false)
const rootRef = ref(null)
const triggerRef = ref(null)

function menuItems() {
  return [...(rootRef.value?.querySelectorAll('[data-menu-item]:not([disabled])') || [])]
}

function focusAt(position) {
  const items = menuItems()
  if (!items.length) return
  const index = position < 0 ? items.length + position : position
  items[Math.max(0, Math.min(items.length - 1, index))]?.focus()
}

function move(step) {
  const items = menuItems()
  if (!items.length) return
  const current = items.indexOf(document.activeElement)
  focusAt(current === -1 ? (step > 0 ? 0 : -1) : (current + step + items.length) % items.length)
}

async function openAndFocus(position) {
  open.value = true
  await nextTick()
  focusAt(position)
}

function toggle() {
  open.value = !open.value
}

function close(returnFocus) {
  if (!open.value) return
  open.value = false
  if (returnFocus) triggerRef.value?.focus()
}

function select(item) {
  if (item.disabled) return
  close(true)
  emit('select', item)
}

function onPointerDown(event) {
  if (open.value && rootRef.value && !rootRef.value.contains(event.target)) close(false)
}

onMounted(() => document.addEventListener('pointerdown', onPointerDown))
onBeforeUnmount(() => document.removeEventListener('pointerdown', onPointerDown))
</script>
