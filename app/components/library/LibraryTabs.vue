<template>
  <nav class="flex flex-wrap gap-2" aria-label="Bibliothèque">
    <NuxtLink
      v-for="tab in tabs"
      :key="tab.to"
      :to="tab.to"
      class="rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors"
      :class="isActive(tab)
        ? 'border-[#E8873A] bg-[#FDF3EA] text-[#B45F1D]'
        : 'border-[#E5E3DF] bg-white text-[#555555] hover:border-[#E8873A]/40'"
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
]

function isActive(tab) {
  return tab.exact ? route.path === tab.to : route.path.startsWith(tab.to)
}
</script>
