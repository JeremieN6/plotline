<template>
  <div class="page">
    <div class="card">
      <div class="progress-wrap">
        <div class="progress-track"></div>
        <div class="progress-fill" :style="{ width: filledWidth }"></div>
        <div class="steps">
          <div v-for="n in totalSteps" :key="n" class="step-bubble" :class="{ active: step === n }">
            <span class="circle">{{ n }}</span>
          </div>
        </div>
      </div>

      <h2 class="title">{{ stepTitle }}</h2>
      <p class="subtitle">{{ stepSubtitle }}</p>

      <div class="content">
        <div v-if="step === 1" class="step-content">
          <label class="field-label">Quelle est la niche de ton persona ?</label>
          <input v-model="form.niche" class="input" placeholder="ex : finance personnelle, mindset, tech, fitness..." />
        </div>

        <div v-if="step === 2" class="step-content">
          <label class="field-label">Nom du persona</label>
          <input v-model="form.name" class="input" placeholder="ex : Alex le coach" />

          <label class="field-label">Ton (sélection jusqu'à 3)</label>
          <div class="chips">
            <button type="button" v-for="tone in toneOptions" :key="tone" class="chip" :class="{ selected: isToneSelected(tone) }" @click="toggleTone(tone)">
              {{ tone }}
            </button>
          </div>

          <label class="field-label">Style narratif</label>
          <div class="radios">
            <label v-for="opt in narrativeOptions" :key="opt" class="radio">
              <input type="radio" :value="opt" v-model="form.narrativeStyle" />
              <span>{{ opt }}</span>
            </label>
          </div>
        </div>

        <div v-if="step === 3" class="step-content">
          <label class="field-label">Pilier 1</label>
          <input v-model="form.pillars[0]" class="input" />

          <label class="field-label">Pilier 2</label>
          <input v-model="form.pillars[1]" class="input" />

          <label class="field-label">Pilier 3 (optionnel)</label>
          <input v-model="form.pillars[2]" class="input" />
        </div>

        <div v-if="step === 4" class="step-content">
          <div class="recap">
            <div class="recap-row"><strong>Niche :</strong> <span>{{ form.niche }}</span></div>
            <div class="recap-row"><strong>Nom :</strong> <span>{{ form.name }}</span></div>
            <div class="recap-row"><strong>Ton(s) :</strong> <span>{{ form.tones.join(', ') || '—' }}</span></div>
            <div class="recap-row"><strong>Style :</strong> <span>{{ form.narrativeStyle || '—' }}</span></div>
            <div class="recap-row"><strong>Piliers :</strong> <span>{{ pillarsList }}</span></div>
          </div>

          <div v-if="error" class="error">{{ error }}</div>
        </div>
      </div>

      <div class="actions">
        <button type="button" class="btn secondary" :disabled="step === 1" @click="prevStep">Précédent</button>

        <button v-if="step < totalSteps" type="button" class="btn primary" :disabled="!canNext" @click="nextStep">Suivant</button>

        <button v-else type="button" class="btn primary" :disabled="loading" @click="submit">
          <span v-if="loading">Création…</span>
          <span v-else>Créer mon persona</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref, computed } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const step = ref(1)
const totalSteps = 4
const userId = 'test-user-123'

const form = reactive({
  niche: '',
  name: '',
  tones: [],
  narrativeStyle: '',
  pillars: ['', '', ''],
})

const toneOptions = ['Direct', 'Provocateur', 'Pédagogue', 'Vulnérable', 'Stoïque', 'Humoristique']
const narrativeOptions = ['Stoïque moderne', 'Storyteller', 'Expert pédagogue', 'Rebel voice']

function toggleTone(tone) {
  const idx = form.tones.indexOf(tone)
  if (idx !== -1) {
    form.tones.splice(idx, 1)
  } else if (form.tones.length < 3) {
    form.tones.push(tone)
  }
}

function isToneSelected(tone) {
  return form.tones.includes(tone)
}

const canNext = computed(() => {
  if (step.value === 1) return form.niche.trim().length > 0
  if (step.value === 2) return form.name.trim().length > 0 && form.narrativeStyle
  if (step.value === 3) return form.pillars[0].trim().length > 0 && form.pillars[1].trim().length > 0
  return true
})

function nextStep() {
  if (!canNext.value) return
  if (step.value < totalSteps) step.value++
}

function prevStep() {
  if (step.value > 1) step.value--
}

const loading = ref(false)
const error = ref('')

const filledWidth = computed(() => {
  const pct = ((step.value - 1) / (totalSteps - 1)) * 100
  return `${pct}%`
})

const titles = ['Niche', 'Identité', 'Piliers', 'Confirmation']
const subtitles = [
  'Décris la niche principale du persona',
  'Donne un nom, un ton et un style narratif',
  'Définis jusqu’à 3 piliers de contenu (2 obligatoires)',
  'Vérifie les informations puis crée ton persona'
]

const stepTitle = computed(() => titles[step.value - 1])
const stepSubtitle = computed(() => subtitles[step.value - 1])

const pillarsList = computed(() => form.pillars.filter(p => p && p.trim()).join(', ') || '—')

async function submit() {
  if (loading.value) return
  loading.value = true
  error.value = ''
  const payload = {
    userId,
    niche: form.niche,
    name: form.name,
    tones: form.tones,
    narrativeStyle: form.narrativeStyle,
    pillars: form.pillars.filter(p => p && p.trim()),
  }
  try {
    const res = await fetch('/api/personas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data?.message || res.statusText || 'Erreur lors de la création')
    }
    await router.push('/personas')
  } catch (err) {
    error.value = err?.message || String(err)
  } finally {
    loading.value = false
  }
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
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: Inter, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial;
  color: var(--text);
  padding: 32px;
  box-sizing: border-box;
}

.card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  width: 100%;
  max-width: 600px;
  padding: 24px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.03);
}

.progress-wrap {
  position: relative;
  height: 40px;
  margin-bottom: 18px;
}

.progress-track {
  position: absolute;
  left: 20px;
  right: 20px;
  top: 16px;
  height: 8px;
  background: var(--border);
  border-radius: 999px;
}

.progress-fill {
  position: absolute;
  left: 20px;
  top: 16px;
  height: 8px;
  background: linear-gradient(90deg, var(--accent), #f6a16a);
  border-radius: 999px;
  transition: width 0.3s ease;
}

.steps {
  position: relative;
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding: 0 20px;
  z-index: 2;
}

.step-bubble {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
}

.circle {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--card);
  border: 1px solid var(--border);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #666666;
  font-weight: 600;
}

.step-bubble.active .circle {
  background: var(--accent);
  color: #FFFFFF;
  border-color: var(--accent);
  box-shadow: 0 6px 14px rgba(232,135,58,0.18);
}

.title {
  margin: 6px 0 4px;
  font-size: 20px;
  font-weight: 600;
  color: var(--text);
}

.subtitle {
  margin: 0 0 16px;
  color: var(--muted);
  font-size: 14px;
}

.field-label {
  display: block;
  font-weight: 600;
  margin-bottom: 8px;
  color: var(--text);
}

.input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: transparent;
  color: var(--text);
  margin-bottom: 12px;
  box-sizing: border-box;
  font-size: 14px;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.chip {
  padding: 8px 12px;
  border-radius: 999px;
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text);
  cursor: pointer;
  font-size: 14px;
}

.chip.selected {
  background: var(--accent);
  color: #FFFFFF;
  border-color: var(--accent);
}

.radios {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}

.radio {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text);
}

.recap {
  background: #FBFBFB;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px;
}

.recap-row {
  margin-bottom: 8px;
  color: var(--text);
  font-size: 14px;
}

.actions {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-top: 18px;
}

.btn {
  padding: 10px 16px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: transparent;
  cursor: pointer;
  font-weight: 600;
  font-size: 14px;
}

.btn.secondary {
  background: #fff;
  color: var(--text);
}

.btn.primary {
  background: var(--accent);
  color: #FFFFFF;
  border-color: var(--accent);
}

.btn.secondary:disabled {
  background: #F5F5F5;
  color: #666666;
  border-color: #E0E0E0;
  cursor: not-allowed;
}

.btn.primary:disabled {
  background: #E8873A;
  color: #FFFFFF;
  border-color: #E8873A;
  opacity: 0.65;
  cursor: not-allowed;
}

.error {
  color: #B00020;
  margin-top: 8px;
  font-size: 13px;
}
</style>
