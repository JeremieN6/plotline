<template>
  <div v-if="slides.length > 1" class="mt-3 border-t border-[#F0D9C4] pt-3">
    <p class="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#B45F1D]">
      <template v-if="adding">Carrousel · nouvelle slide</template>
      <template v-else>Carrousel · slide {{ currentIndex + 1 }} / {{ slides.length }}</template>
    </p>
    <div class="mt-2 flex flex-wrap gap-2">
      <button
        v-for="(slide, index) in slides"
        :key="slide.id"
        type="button"
        class="relative h-14 w-14 overflow-hidden rounded-[10px] border-2 bg-white transition-colors"
        :class="!adding && slide.id === currentId ? 'border-[#E8873A]' : 'border-[#E6D7C8] hover:border-[#E6B78E]'"
        :aria-label="`Modifier la slide ${index + 1}`"
        :aria-current="!adding && slide.id === currentId ? 'true' : undefined"
        :disabled="disabled"
        @click="$emit('select', slide.id)"
      >
        <img v-if="slide.imageUrl" :src="slide.imageUrl" :alt="`Slide ${index + 1}`" class="h-full w-full object-cover" />
        <span v-else class="flex h-full w-full items-center justify-center text-[10px] font-semibold text-[#B49A85]">{{ index + 1 }}</span>
        <span class="absolute bottom-0 left-0 rounded-tr-[6px] bg-black/60 px-1 text-[10px] font-bold text-white">{{ index + 1 }}</span>
        <span v-if="slide.status === 'PROCESSING'" class="absolute inset-0 flex items-center justify-center bg-white/70 text-[9px] font-bold text-[#8B5CF6]">…</span>
      </button>
      <button
        v-if="canAdd"
        type="button"
        class="flex h-14 w-14 items-center justify-center rounded-[10px] border-2 border-dashed text-xl font-bold transition-colors"
        :class="adding ? 'border-[#E8873A] bg-white text-[#E8873A]' : 'border-[#E6B78E] text-[#B45F1D] hover:bg-[#FFF2E6]'"
        aria-label="Ajouter une slide"
        :disabled="disabled"
        @click="$emit('add')"
      >
        +
      </button>
    </div>

    <div class="mt-3 flex flex-wrap gap-2">
      <button
        v-if="adding"
        type="button"
        class="rounded-[10px] border border-[#E6B78E] bg-white px-3 py-1.5 text-xs font-bold text-[#B45F1D] transition-colors hover:bg-[#FFF2E6] disabled:opacity-60"
        :disabled="disabled"
        @click="$emit('cancel-add')"
      >
        Annuler l'ajout
      </button>
      <template v-else>
        <button
          type="button"
          class="rounded-[10px] border border-[#E6B78E] bg-white px-3 py-1.5 text-xs font-bold text-[#B45F1D] transition-colors hover:bg-[#FFF2E6] disabled:opacity-50"
          :disabled="disabled || regenerableCount < 1"
          @click="$emit('regenerate-all')"
        >
          Régénérer tout le carrousel ({{ regenerableCount }} · ~{{ costLabel }} $)
        </button>
        <button
          type="button"
          class="rounded-[10px] border border-[#E6B78E] bg-white px-3 py-1.5 text-xs font-bold text-[#B45F1D] transition-colors hover:bg-[#FFF2E6] disabled:opacity-50"
          :disabled="disabled || !canRemove"
          @click="$emit('remove')"
        >
          Retirer cette slide
        </button>
      </template>
    </div>

    <p class="mt-1.5 text-xs text-[#8A6647]">
      <template v-if="adding">Écris le prompt de la nouvelle slide puis clique « Ajouter la slide » : elle est ajoutée à la fin.</template>
      <template v-else>« Régénérer » (en bas) ne refait que la slide choisie ; « Régénérer tout le carrousel » relance toutes les slides depuis leur prompt.</template>
    </p>
  </div>
</template>

<script setup>
const props = defineProps({
  slides: { type: Array, default: () => [] },
  currentId: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  adding: { type: Boolean, default: false },
  canAdd: { type: Boolean, default: false },
  canRemove: { type: Boolean, default: false },
  regenerableCount: { type: Number, default: 0 },
})
defineEmits(['select', 'add', 'cancel-add', 'remove', 'regenerate-all'])

const currentIndex = computed(() => Math.max(0, props.slides.findIndex((slide) => slide.id === props.currentId)))
const costLabel = computed(() => (props.regenerableCount * CAROUSEL_EDIT_IMAGE_COST_USD).toFixed(2).replace('.', ','))
</script>
