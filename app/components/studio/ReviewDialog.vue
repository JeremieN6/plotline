<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex items-center justify-center px-4 py-6"
      role="dialog"
      aria-modal="true"
      :aria-label="title"
      @keydown.esc="emit('cancel')"
    >
      <button
        type="button"
        class="absolute inset-0 bg-black/35"
        aria-label="Fermer"
        @click="emit('cancel')"
      ></button>

      <div class="relative flex max-h-full w-full max-w-2xl flex-col rounded-2xl border border-[#E5E3DF] bg-white p-6 shadow-2xl">
        <div class="mb-4">
          <h2 class="text-lg font-bold text-gray-900">{{ title }}</h2>
          <p v-if="description" class="mt-1 text-sm leading-6 text-gray-500">{{ description }}</p>
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto">
          <slot />
        </div>

        <div class="mt-5 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            class="rounded-lg border border-[#E5E3DF] bg-white px-4 py-2 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-50"
            @click="emit('cancel')"
          >
            {{ cancelLabel }}
          </button>
          <button
            type="button"
            class="rounded-lg bg-[#E8873A] px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-[#d4762f] disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="confirmDisabled"
            @click="emit('confirm')"
          >
            {{ confirmLabel }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
// Fenetre de verification avant une action du Studio (ecriture des prompts par Claude, generation des images).
// Le contenu (texte a relire, recapitulatif) arrive par le slot ; la fenetre ne fait rien d autre que confirmer ou annuler.
defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, default: '' },
  description: { type: String, default: '' },
  confirmLabel: { type: String, default: 'Continuer' },
  cancelLabel: { type: String, default: 'Annuler' },
  confirmDisabled: { type: Boolean, default: false },
})

const emit = defineEmits(['confirm', 'cancel'])
</script>
