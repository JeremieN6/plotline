<template>
  <Teleport to="body">
    <div
      v-if="confirmState.open"
      class="fixed inset-0 z-50 flex items-center justify-center px-4"
    >
      <button
        class="absolute inset-0 bg-black/35"
        aria-label="Fermer la confirmation"
        @click="resolveConfirmation(false)"
      ></button>

      <div class="relative w-full max-w-md rounded-2xl border border-[#E5E3DF] bg-white p-6 shadow-2xl">
        <div class="mb-4 flex items-start gap-3">
          <div
            class="mt-0.5 flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold"
            :class="toneClass"
          >
            !
          </div>
          <div>
            <h2 class="text-lg font-bold text-gray-900">{{ confirmState.title }}</h2>
            <p class="mt-1 text-sm leading-6 text-gray-500">{{ confirmState.message }}</p>
          </div>
        </div>

        <div class="flex flex-wrap justify-end gap-3">
          <button
            class="rounded-lg border border-[#E5E3DF] bg-white px-4 py-2 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-50"
            @click="resolveConfirmation(false)"
          >
            {{ confirmState.cancelLabel }}
          </button>
          <button
            class="rounded-lg px-4 py-2 text-sm font-bold text-white transition-colors"
            :class="confirmButtonClass"
            @click="resolveConfirmation(true)"
          >
            {{ confirmState.confirmLabel }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
const { confirmState, resolveConfirmation } = useUiFeedback()

const toneClass = computed(() => {
  if (confirmState.value.tone === 'danger') {
    return 'bg-red-50 text-red-600'
  }

  return 'bg-orange-50 text-[#E8873A]'
})

const confirmButtonClass = computed(() => {
  if (confirmState.value.tone === 'danger') {
    return 'bg-red-600 hover:bg-red-700'
  }

  return 'bg-[#E8873A] hover:bg-[#d4762f]'
})
</script>