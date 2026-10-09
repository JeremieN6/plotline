<template>
  <div class="font-ui">
    <div class="flex items-baseline justify-between gap-3">
      <label v-if="label" :for="forId" class="text-[13px] font-semibold text-ui-ink">{{ label }}</label>
      <slot name="meta" />
    </div>
    <div :class="label || $slots.meta ? 'mt-1.5' : ''">
      <slot />
    </div>
    <p v-if="error" class="mt-1.5 text-xs text-ui-danger" role="alert">{{ error }}</p>
    <p v-else-if="hint" class="mt-1.5 text-xs text-ui-ink-muted">{{ hint }}</p>
  </div>
</template>

<script setup>
// Label (casse normale) + controle + aide ou erreur. `for` relie le label au champ.
defineProps({
  label: { type: String, default: '' },
  hint: { type: String, default: '' },
  error: { type: String, default: '' },
  forId: { type: String, default: undefined },
})
</script>
