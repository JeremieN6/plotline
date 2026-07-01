<template>
  <Teleport to="body">
    <div class="pointer-events-none fixed right-4 top-4 z-50 flex w-[min(92vw,24rem)] flex-col gap-3">
      <TransitionGroup name="toast">
        <div
          v-for="toast in toasts"
          :key="toast.id"
          class="pointer-events-auto overflow-hidden rounded-2xl border bg-white shadow-xl"
          :class="toastClass(toast.tone)"
        >
          <div class="flex items-start gap-3 p-4">
            <div class="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full" :class="dotClass(toast.tone)"></div>
            <div class="min-w-0 flex-1">
              <p v-if="toast.title" class="text-sm font-bold text-gray-900">{{ toast.title }}</p>
              <p class="text-sm leading-6 text-gray-600">{{ toast.message }}</p>
                <button
                  v-if="toast.actionLabel"
                  class="mt-3 inline-flex rounded-[12px] bg-[#111111] px-3 py-2 text-xs font-bold text-white transition-colors duration-150 hover:bg-[#2a2a2a]"
                  @click="handleAction(toast)"
                >
                  {{ toast.actionLabel }}
                </button>
            </div>
            <button
              class="text-sm font-bold text-gray-400 transition-colors hover:text-gray-600"
              @click="removeToast(toast.id)"
            >
              Fermer
            </button>
          </div>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup>
const router = useRouter()
const { toasts, removeToast } = useUiFeedback()

function toastClass(tone) {
  if (tone === 'success') {
    return 'border-emerald-200'
  }

  if (tone === 'error') {
    return 'border-red-200'
  }

  return 'border-[#E5E3DF]'
}

function dotClass(tone) {
  if (tone === 'success') {
    return 'bg-emerald-500'
  }

  if (tone === 'error') {
    return 'bg-red-500'
  }

  return 'bg-[#E8873A]'
}

function handleAction(toast) {
  if (toast.actionHref) {
    router.push(toast.actionHref)
  }

  if (toast.actionCallback) {
    toast.actionCallback()
  }

  removeToast(toast.id)
}
</script>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.2s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>