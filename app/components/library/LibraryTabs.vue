<template>
  <nav class="flex flex-wrap gap-2 font-ui" aria-label="Bibliothèque">
    <NuxtLink
      v-for="tab in tabs"
      :key="tab.to"
      :to="tab.to"
      class="rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ui-accent/20"
      :class="isActive(tab)
        ? 'border-ui-accent bg-ui-accent-soft text-ui-accent-ink'
        : 'border-ui-line bg-ui-surface text-ui-ink-2 hover:border-ui-accent/40'"
    >
      {{ tab.label }}
    </NuxtLink>
  </nav>
</template>

<script setup>
const route = useRoute()

const tabs = [
  { to: '/library', label: 'Assets de référence', exact: true },
  { to: '/library/personas', label: 'Dossiers personas' },
  { to: '/library/fiches', label: 'Fiches générées' },
]

function isActive(tab) {
  return tab.exact ? route.path === tab.to : route.path.startsWith(tab.to)
}
</script>
