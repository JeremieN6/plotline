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

    <!-- Le panneau est rendu dans <body> en position fixe : une carte ou un conteneur en `overflow: hidden` ne peut pas le couper. -->
    <Teleport to="body">
      <div
        v-if="open"
        ref="menuRef"
        role="menu"
        :aria-label="label"
        class="fixed z-[60] min-w-[220px] rounded-ui-ctl border border-ui-line bg-ui-surface p-1 font-ui shadow-lg"
        :style="menuStyle"
        @keydown.esc.stop.prevent="close(true)"
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
    </Teleport>
  </div>
</template>

<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

// Menu d actions (bouton « ⋯ » ou autre declencheur). Fleches, Debut, Fin, Echap et clic exterieur.
// `items` : { key, label, danger?, disabled?, hint?, to?, separator? }. `select` renvoie l entree choisie.
// Une entree `to` est un lien (ex. « Connecter dans les parametres »).
// Position : sous le declencheur, aligne a droite ou a gauche ; au-dessus s il n y a pas la place en bas ; toujours
// dans l ecran. Un defilement ou un redimensionnement ferme le menu (il serait sinon decale de son declencheur).
const props = defineProps({
  items: { type: Array, default: () => [] },
  label: { type: String, default: 'Plus d’actions' },
  align: { type: String, default: 'right' }, // right | left
  disabled: { type: Boolean, default: false },
  // Remplace l apparence du declencheur (ex. fleche d un bouton scinde).
  triggerClass: { type: String, default: '' },
})
const emit = defineEmits(['select'])

const GAP = 4
const MARGIN = 8

const open = ref(false)
const rootRef = ref(null)
const triggerRef = ref(null)
const menuRef = ref(null)
// Invisible tant que la position n est pas calculee (il faut mesurer le panneau une fois affiche).
const menuStyle = ref({ top: '0px', left: '0px', visibility: 'hidden' })

function menuItems() {
  return [...(menuRef.value?.querySelectorAll('[data-menu-item]:not([disabled])') || [])]
}

function placeMenu() {
  const trigger = triggerRef.value
  const menu = menuRef.value
  if (!trigger || !menu) return
  const rect = trigger.getBoundingClientRect()
  const width = menu.offsetWidth
  const height = menu.offsetHeight
  let left = props.align === 'left' ? rect.left : rect.right - width
  left = Math.max(MARGIN, Math.min(left, window.innerWidth - width - MARGIN))
  let top = rect.bottom + GAP
  if (top + height > window.innerHeight - MARGIN && rect.top - height - GAP >= MARGIN) top = rect.top - height - GAP
  top = Math.max(MARGIN, top)
  menuStyle.value = { top: `${Math.round(top)}px`, left: `${Math.round(left)}px` }
}

watch(open, async (isOpen) => {
  if (!import.meta.client) return
  if (isOpen) {
    menuStyle.value = { top: '0px', left: '0px', visibility: 'hidden' }
    await nextTick()
    placeMenu()
    window.addEventListener('scroll', onViewportChange, true)
    window.addEventListener('resize', onViewportChange)
  } else {
    window.removeEventListener('scroll', onViewportChange, true)
    window.removeEventListener('resize', onViewportChange)
  }
})

function onViewportChange() {
  close(false)
}

function focusAt(position) {
  const items = menuItems()
  if (!items.length) return
  const index = position < 0 ? items.length + position : position
  items[Math.max(0, Math.min(items.length - 1, index))]?.focus({ preventScroll: true })
}

function move(step) {
  const items = menuItems()
  if (!items.length) return
  const current = items.indexOf(document.activeElement)
  focusAt(current === -1 ? (step > 0 ? 0 : -1) : (current + step + items.length) % items.length)
}

async function openAndFocus(position) {
  open.value = true
  // Un element invisible ne prend pas le focus : on attend que le panneau soit place.
  for (let i = 0; i < 5 && (!menuRef.value || menuStyle.value.visibility === 'hidden'); i += 1) await nextTick()
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
  if (!open.value) return
  const target = event.target
  if (rootRef.value?.contains(target) || menuRef.value?.contains(target)) return
  close(false)
}

onMounted(() => document.addEventListener('pointerdown', onPointerDown))
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onPointerDown)
  window.removeEventListener('scroll', onViewportChange, true)
  window.removeEventListener('resize', onViewportChange)
})
</script>
