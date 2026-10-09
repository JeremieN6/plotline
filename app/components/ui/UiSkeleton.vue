<template>
  <div class="grid animate-pulse gap-2.5 rounded-ui-ctl border border-ui-line bg-ui-surface p-4" role="status" aria-label="Chargement">
    <div
      v-for="line in lines"
      :key="line"
      class="h-3 rounded-full bg-ui-line-soft"
      :style="{ width: line === lines ? '55%' : line === 2 ? '80%' : '100%' }"
    />
  </div>
</template>

<script setup>
// Remplace tout texte « Chargement… » seul.
defineProps({ lines: { type: Number, default: 3 } })
</script>
