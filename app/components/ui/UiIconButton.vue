<template>
  <button
    type="button"
    :aria-label="label"
    :title="label"
    :disabled="disabled"
    class="inline-flex h-11 w-11 items-center justify-center rounded-ui-ctl border border-ui-line-input bg-ui-surface font-ui text-ui-ink transition-colors hover:bg-ui-subtle focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ui-accent/20 disabled:cursor-not-allowed disabled:bg-ui-subtle disabled:text-ui-ink-muted"
  >
    <slot />
  </button>
</template>

<script setup>
// `label` est obligatoire : c est le nom accessible du bouton.
defineProps({
  label: { type: String, required: true },
  disabled: { type: Boolean, default: false },
})
</script>
