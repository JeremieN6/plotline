<template>
  <div class="space-y-3">
    <p class="text-sm font-semibold text-[#111111]">Redirection vers le contenu…</p>
    <p class="text-sm text-[#666666]">La vue contenu est désormais unifiée depuis la sidebar.</p>
  </div>
</template>

<script setup>
import { useRoute } from 'vue-router'

const route = useRoute()
const activeInfluencerId = useActiveInfluencer()
const influencerId = String(route.params.id || '')

if (influencerId) {
  activeInfluencerId.value = influencerId
}

await navigateTo('/content', { replace: true })
</script>
