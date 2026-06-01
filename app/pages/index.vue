<template>
  <div class="redirect-page">Redirection…</div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
onMounted(() => {
  router.replace('/personas')
})
</script>

<style scoped>
.redirect-page { padding:40px; font-family: Inter, system-ui, -apple-system, "Segoe UI", Roboto; color: #666 }
</style>
