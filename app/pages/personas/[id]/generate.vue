<template>
  <div class="page">
    <div class="container">
      <aside class="panel config">
        <div class="persona-head">
          <h3 class="persona-name">{{ persona?.name || 'Persona' }}</h3>
          <p class="persona-niche">{{ persona?.niche || '' }}</p>
        </div>

        <div class="section">
          <label class="field-label">Volume</label>
          <div class="volumes">
            <button type="button" class="volume-btn" :class="{ selected: volume === 5 }" @click="volume = 5">5 posts</button>
            <button type="button" class="volume-btn" :class="{ selected: volume === 10 }" @click="volume = 10">10 posts</button>
            <button type="button" class="volume-btn" :class="{ selected: volume === 15 }" @click="volume = 15">15 posts</button>
          </div>
        </div>

        <div class="section">
          <label class="field-label">Type d'arc</label>
          <div class="arc-options">
            <label class="radio" v-for="opt in arcOptions" :key="opt">
              <input type="radio" :value="opt" v-model="arcType" />
              <span>{{ opt }}</span>
            </label>
          </div>
        </div>

        <div class="actions">
          <button class="btn generate" :disabled="generating" @click="generateBatch">
            <span v-if="generating" class="generation-label"><span class="spinner"></span> Génération en cours...</span>
            <span v-else>Générer</span>
          </button>
          <div v-if="errorMsg" class="error">{{ errorMsg }}</div>
        </div>
      </aside>

      <main class="panel results">
        <div v-if="!generated && !generating" class="empty-state">Lance une génération pour voir tes posts ici.</div>

        <div v-else-if="generating" class="skeleton-list">
          <div v-for="n in volume" :key="n" class="skeleton-card"></div>
        </div>

        <div v-else class="generated">
          <p v-if="generated?.batchSummary?.arcDescription" class="arc-desc">{{ generated.batchSummary.arcDescription }}</p>

          <div class="posts-list">
            <div v-for="(post, idx) in posts" :key="post.id || idx" class="post-card">
              <div class="post-top">
                <span class="badge pillar">{{ post.pillar || '—' }}</span>
                <span class="badge format">{{ post.format || '—' }}</span>
                <span class="position">#{{ post.arcPosition ?? (idx + 1) }}</span>
              </div>

              <div class="post-body">
                <div v-if="!post.editing" class="body-text">{{ post.body }}</div>
                <div v-else class="editor">
                  <textarea v-model="post.editedBody" rows="6"></textarea>
                </div>
              </div>

              <div class="post-actions">
                <button class="btn small" @click="toggleEdit(post)">{{ post.editing ? 'Enregistrer' : 'Modifier' }}</button>
                <button class="btn small danger" @click="removePost(idx)">Supprimer</button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

// Fetch persona on client (au mount)
const { data: persona, pending: personaPending, error: personaError } = useFetch(() => `/api/personas/${route.params.id}`, { server: false })

const arcOptions = ['Auto', 'Tension/Release', 'Teaching', 'Transformation']
const volume = ref(5)
const arcType = ref('Auto')
const generating = ref(false)
const errorMsg = ref('')

const generated = ref(null)
const posts = ref([])

async function generateBatch() {
  if (generating.value) return
  generating.value = true
  errorMsg.value = ''
  generated.value = null
  posts.value = []

  try {
    const payload = {
      personaId: route.params.id,
      batchOptions: { volume: volume.value, arcType: arcType.value, startPosition: 1 }
    }
    // Using Nuxt $fetch for concise API calls
    const res = await $fetch('/api/batches/generate', { method: 'POST', body: payload })
    generated.value = res
    posts.value = (res.posts || []).map((p, idx) => ({ ...p, arcPosition: p.arcPosition ?? (1 + idx), editing: false, editedBody: p.body }))
  } catch (err) {
    // $fetch throws rich errors; normalize message
    errorMsg.value = err?.data?.message || err?.message || String(err)
  } finally {
    generating.value = false
  }
}

function toggleEdit(post) {
  if (post.editing) {
    // saving: commit editedBody
    post.body = post.editedBody
    post.editing = false
  } else {
    post.editedBody = post.body
    post.editing = true
  }
}

function removePost(idx) {
  posts.value.splice(idx, 1)
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
  padding: 24px;
  box-sizing: border-box;
}

.container {
  display: flex;
  gap: 20px;
  align-items: flex-start;
}

.panel {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 20px;
  box-shadow: 0 6px 18px rgba(0,0,0,0.04);
}

.config {
  width: 40%;
  box-sizing: border-box;
}

.results {
  width: 60%;
  box-sizing: border-box;
}

.persona-head {
  margin-bottom: 12px;
}
.persona-name { margin: 0; font-size: 18px; font-weight: 700 }
.persona-niche { margin: 4px 0 12px; color: var(--muted) }

.field-label { display:block; font-weight:600; margin-bottom:8px }

.volumes { display:flex; gap:8px; margin-bottom:16px }
.volume-btn { padding:8px 12px; border-radius:8px; border:1px solid var(--border); background:transparent; cursor:pointer }
.volume-btn.selected { background:linear-gradient(90deg,var(--accent),#f6a16a); color:#fff; border-color:var(--accent) }

.arc-options { display:flex; flex-direction:column; gap:8px }
.radio { display:flex; align-items:center; gap:8px }

.actions { margin-top:18px }
.btn.generate { width:100%; padding:12px 14px; border-radius:10px; background:var(--accent); color:#fff; border:1px solid var(--accent); font-weight:700 }
.generation-label { display:inline-flex; align-items:center; gap:8px }

.spinner { width:16px; height:16px; border:2px solid rgba(255,255,255,0.5); border-top-color:#fff; border-radius:50%; animation:spin 1s linear infinite }

.error { color:#B00020; margin-top:8px }

.empty-state { color:var(--muted); font-style:italic; padding:24px }

.skeleton-list { display:flex; flex-direction:column; gap:12px }
.skeleton-card { height:104px; border-radius:10px; background:linear-gradient(90deg,#f3f3f3,#ecebeb,#f3f3f3); background-size:200% 100%; animation:shimmer 1.2s linear infinite }

.generated .arc-desc { color:var(--muted); font-style:italic; margin-bottom:12px }

.posts-list { display:flex; flex-direction:column; gap:12px }
.post-card { border:1px solid var(--border); background:#fff; padding:12px; border-radius:10px }
.post-top { display:flex; gap:8px; align-items:center; margin-bottom:8px }
.badge { display:inline-block; padding:6px 8px; border-radius:999px; font-weight:600; font-size:12px; background:#F6F4F2; border:1px solid var(--border) }
.position { margin-left:auto; color:var(--muted); font-weight:700 }

.post-body .body-text { white-space:pre-wrap; color:var(--text) }
.post-body textarea { width:100%; padding:10px; border:1px solid var(--border); border-radius:8px }

.post-actions { display:flex; gap:8px; margin-top:10px }
.btn.small { padding:6px 10px; border-radius:8px; background:transparent; border:1px solid var(--border); cursor:pointer }
.btn.small.danger { border-color:#F3D0CC; background:#fff8f7; color:#a33 }

@media (max-width: 900px) {
  .container { flex-direction:column }
  .config, .results { width:100% }
}

@keyframes spin { to { transform:rotate(360deg) } }
@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
</style>
