<template>
  <div class="page">
    <div class="container">
      <div class="header-row">
        <h1 class="title">Mes influenceuses</h1>
        <button class="btn primary" @click="goNew">Nouvelle influenceuse</button>
      </div>

      <div v-if="loading" class="grid">
        <div v-for="n in 3" :key="n" class="card skeleton-card">
          <div class="skeleton-title"></div>
          <div class="skeleton-line"></div>
          <div class="skeleton-line short"></div>
          <div class="skeleton-actions"></div>
        </div>
      </div>

      <div v-else-if="!influencers.length" class="empty">
        <p class="empty-text">Tu n'as pas encore d'influenceuse</p>
        <button class="btn primary" @click="goNew">Créer ma première influenceuse</button>
      </div>

      <div v-else class="grid">
        <div v-for="influencer in influencers" :key="influencer.id" class="card influencer-card">
          <div class="card-body">
            <div class="card-top">
              <h3 class="influencer-title">{{ influencer.name }}</h3>
              <span v-if="influencer.niche" class="badge">{{ influencer.niche }}</span>
            </div>

            <p class="muted narrative">{{ influencer.style || '—' }}</p>
            <p class="muted">Face ref : <strong>{{ influencer.faceRefPath ? 'Oui' : 'Non' }}</strong></p>
          </div>

          <div class="card-actions">
            <button class="btn primary small" @click="goGenerate(influencer.id)">Générer une image</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const userId = 'user-test'

const influencers = ref([])
const loading = ref(true)
const error = ref(null)

onMounted(async () => {
  try {
    const { data, error: fetchError } = await useFetch(`/api/influencers?userId=${userId}`)
    if (fetchError?.value) {
      error.value = fetchError.value
      influencers.value = []
    } else {
      influencers.value = data?.value ?? []
    }
  } catch (e) {
    error.value = e
    influencers.value = []
  } finally {
    loading.value = false
  }
})

function goNew() {
  router.push('/influencers/new')
}

function goGenerate(id) {
  router.push(`/influencers/${id}/generate`)
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');

:root {
  --bg: #FAFAF8;
  --card: #FFFFFF;
  --text: #111111;
  --muted: #666666;
  --accent: #E8873A;
  --border: #E5E3DF;
  --radius: 12px;
}

.page {
  min-height: 100vh;
  background: var(--bg);
  font-family: Inter, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial;
  color: var(--text);
  padding: 28px;
  box-sizing: border-box;
}

.container {
  max-width: 1100px;
  margin: 0 auto;
}

.header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
}

.title {
  font-size: 22px;
  font-weight: 700;
  margin: 0;
}

.grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

@media (max-width: 768px) {
  .grid {
    grid-template-columns: 1fr;
  }
}

.card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 16px;
  box-shadow: 0 6px 18px rgba(0,0,0,0.03);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-height: 160px;
}

.influencer-card .card-body {
  padding-bottom: 12px;
}

.card-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.influencer-title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
}

.badge {
  background: #FFF3E8;
  color: #E8873A;
  padding: 6px 10px;
  border-radius: 999px;
  font-weight: 700;
  font-size: 12px;
  align-self: start;
}

.muted {
  color: var(--muted);
  font-size: 14px;
  margin-top: 8px;
}

.narrative {
  margin-bottom: 8px;
}

.card-actions {
  display: flex;
  gap: 12px;
  margin-top: 12px;
}

.btn {
  padding: 10px 14px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: transparent;
  cursor: pointer;
  font-weight: 700;
  font-size: 14px;
}

.btn.small {
  padding: 8px 12px;
  font-size: 13px;
}

.btn.primary {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
}

.empty {
  display:flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 40px 20px;
  text-align: center;
}

.empty-text {
  font-size: 16px;
  color: var(--muted);
  margin: 0 0 8px;
}

.skeleton-card {
  position: relative;
  overflow: hidden;
  min-height: 160px;
}

.skeleton-title {
  height: 18px;
  width: 50%;
  background: #eee;
  border-radius: 6px;
  margin-bottom: 10px;
}

.skeleton-line {
  height: 12px;
  width: 90%;
  background: #eee;
  border-radius: 6px;
  margin-bottom: 8px;
}

.skeleton-line.short {
  width: 60%;
}

.skeleton-actions {
  height: 36px;
  width: 70%;
  background: #eee;
  border-radius: 8px;
  margin-top: 12px;
}

.skeleton-card::after {
  content: '';
  position: absolute;
  top: 0;
  left: -150px;
  height: 100%;
  width: 150px;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent);
  animation: shimmer 1.2s infinite;
}

@keyframes shimmer {
  100% {
    transform: translateX(300px);
  }
}
</style>