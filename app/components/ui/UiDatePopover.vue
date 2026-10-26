<template>
  <div ref="rootRef" class="relative inline-block font-ui">
    <!-- Declencheur : le badge par defaut, ou le slot `trigger` (ex. un bouton « Reprogrammer »). -->
    <slot name="trigger" :toggle="toggle" :open="open" :display="display" :disabled="disabled" :set-ref="setTriggerRef">
    <button
      ref="triggerRef"
      type="button"
      :disabled="disabled"
      :aria-expanded="open ? 'true' : 'false'"
      aria-haspopup="dialog"
      :aria-label="`${label} : ${display || 'non définie'}. Modifier`"
      class="inline-flex min-h-11 items-center gap-2 rounded-full bg-ui-subtle px-3.5 text-xs font-semibold text-ui-ink-2 transition-colors hover:bg-ui-line-soft focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ui-accent/20 disabled:cursor-not-allowed disabled:text-ui-ink-muted disabled:hover:bg-ui-subtle"
      @click="toggle"
    >
      <svg class="h-4 w-4 shrink-0" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <rect x="2" y="3" width="12" height="11" rx="2" stroke="currentColor" stroke-width="1.4" />
        <path d="M2 6.5h12M5.5 1.8v2.4M10.5 1.8v2.4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
      </svg>
      <span>{{ display || 'Choisir une date' }}</span>
    </button>
    </slot>

    <div
      v-if="open"
      ref="panelRef"
      role="dialog"
      :aria-label="`Modifier ${label.toLowerCase()}`"
      class="absolute z-30 w-72 rounded-ui-card border border-ui-line bg-ui-surface p-4 shadow-lg"
      :class="[placement === 'top' ? 'bottom-[calc(100%+8px)]' : 'top-[calc(100%+8px)]', align === 'right' ? 'right-0' : 'left-0']"
      @keydown.esc.stop.prevent="close(true)"
    >
      <div class="grid gap-3">
        <div>
          <label :for="`${uid}-date`" class="text-[13px] font-semibold text-ui-ink">Date</label>
          <UiInput :id="`${uid}-date`" ref="dateInput" v-model="draftDate" type="date" class="mt-1.5" />
        </div>
        <div>
          <label :for="`${uid}-time`" class="text-[13px] font-semibold text-ui-ink">Heure</label>
          <UiInput :id="`${uid}-time`" v-model="draftTime" type="time" class="mt-1.5" />
        </div>
      </div>
      <div class="mt-4 flex justify-end gap-2">
        <UiButton size="sm" @click="close(true)">Annuler</UiButton>
        <UiButton variant="dark" size="sm" :disabled="!draftDate" @click="apply">Appliquer</UiButton>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId } from 'vue'
import { formatShortDate, fromLocalDateTimeFields, toLocalDateTimeFields } from '../../utils/formatDate.js'

// Selecteur de date + heure qui s ouvre depuis un badge. `modelValue` et l evenement sont des chaines ISO.
const props = defineProps({
  modelValue: { type: String, default: '' },
  label: { type: String, default: 'Date de publication' },
  disabled: { type: Boolean, default: false },
  placement: { type: String, default: 'bottom' }, // bottom | top
  align: { type: String, default: 'left' }, // left | right
})
const emit = defineEmits(['update:modelValue'])

const uid = useId()
const open = ref(false)
const rootRef = ref(null)
const triggerRef = ref(null)
const panelRef = ref(null)
const customTrigger = ref(null)
// Le slot `trigger` donne son element pour y rendre le focus a la fermeture.
function setTriggerRef(el) { customTrigger.value = el }
const draftDate = ref('')
const draftTime = ref('')

const display = computed(() => formatShortDate(props.modelValue))

async function toggle() {
  if (open.value) return close(true)
  const fields = toLocalDateTimeFields(props.modelValue)
  draftDate.value = fields.date
  draftTime.value = fields.time || '18:00'
  open.value = true
  await nextTick()
  panelRef.value?.querySelector('input')?.focus()
}

function close(returnFocus = false) {
  open.value = false
  if (returnFocus) (triggerRef.value || customTrigger.value)?.focus()
}

function apply() {
  const iso = fromLocalDateTimeFields({ date: draftDate.value, time: draftTime.value })
  if (iso && iso !== props.modelValue) emit('update:modelValue', iso)
  close(true)
}

function onOutside(event) {
  if (open.value && rootRef.value && !rootRef.value.contains(event.target)) close(false)
}

onMounted(() => document.addEventListener('pointerdown', onOutside))
onBeforeUnmount(() => document.removeEventListener('pointerdown', onOutside))
</script>
