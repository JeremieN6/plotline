<template>
  <button
    :type="type"
    :disabled="disabled || loading"
    :aria-busy="loading ? 'true' : undefined"
    class="inline-flex items-center justify-center gap-2 rounded-ui-ctl border border-transparent px-4 font-ui text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ui-accent/20 disabled:cursor-not-allowed disabled:border-ui-line disabled:bg-ui-subtle disabled:text-ui-ink-muted"
    :class="[variants[variant] || variants.secondary, size === 'sm' ? 'h-10' : 'h-11']"
  >
    <svg v-if="loading" class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-opacity="0.25" stroke-width="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
    </svg>
    <slot v-else name="icon" />
    <slot />
  </button>
</template>

<script setup>
// Un seul `primary` par ecran ; `dark` = progression ; voir docs/ui-kit/UI.md.
defineProps({
  variant: { type: String, default: 'secondary' }, // primary | dark | secondary | ghost | danger
  size: { type: String, default: 'md' }, // md (44) | sm (40)
  type: { type: String, default: 'button' },
  loading: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
})

const variants = {
  primary: 'bg-ui-accent text-white hover:bg-ui-accent-hover',
  dark: 'bg-ui-ink text-white hover:bg-ui-ink-2',
  secondary: 'border-ui-line-input bg-ui-surface text-ui-ink hover:bg-ui-subtle',
  ghost: 'text-ui-accent hover:bg-ui-accent-soft',
  danger: 'border-ui-danger-line bg-ui-surface text-ui-danger-ink hover:bg-ui-danger-soft',
}
</script>
