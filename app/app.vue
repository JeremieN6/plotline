<template>
  <PlotlineShell v-if="showShell">
    <NuxtPage />
  </PlotlineShell>
  <NuxtPage v-else />

  <UiConfirmDialog />
  <UiToastStack />
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import PlotlineShell from '~/components/layout/PlotlineShell.vue'

useJobNotifications()

const route = useRoute()
const showShell = computed(() => route.path !== '/' && !route.path.startsWith('/auth'))
</script>
