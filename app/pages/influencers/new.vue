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
          <label class="field-label">Nom</label>
          <input v-model="form.name" class="input" placeholder="ex : Luna" />

          <label class="field-label">Niche</label>
          <input v-model="form.niche" class="input" placeholder="ex : lifestyle, fitness, travel" />

          <label class="field-label">Style</label>
          <input v-model="form.style" class="input" placeholder="ex : californian blonde, parisian chic" />
        </div>

        <div v-if="step === 2" class="step-content">
          <label class="field-label">Image de référence (JPG/PNG)</label>
          <div
            class="dropzone"
            :class="{ dragging: isDragging, invalid: fileError }"
            @dragenter.prevent="isDragging = true"
            @dragover.prevent="isDragging = true"
            @dragleave.prevent="isDragging = false"
            @drop.prevent="onDrop"
          >
            <input
              ref="fileInputRef"
              type="file"
              accept="image/jpeg,image/png,.jpg,.jpeg,.png"
              class="hidden-input"
              @change="onFileSelect"
            />

            <div class="drop-content">
              <p class="drop-title">Dépose ton image ici</p>
              <p class="drop-subtitle">ou</p>
              <button type="button" class="btn secondary" @click="openFilePicker">Choisir un fichier</button>
            </div>
          </div>

          <div v-if="previewUrl" class="preview-wrap">
            <img :src="previewUrl" alt="Aperçu image de référence" class="preview" />
          </div>

          <div v-if="fileError" class="error">{{ fileError }}</div>
          <div v-if="uploadError" class="error">{{ uploadError }}</div>
          <div v-if="faceRefPath" class="success">Image envoyée avec succès.</div>
        </div>

        <div v-if="step === 3" class="step-content">
          <div class="recap">
            <div class="recap-row"><strong>Nom :</strong> <span>{{ form.name }}</span></div>
            <div class="recap-row"><strong>Niche :</strong> <span>{{ form.niche }}</span></div>
            <div class="recap-row"><strong>Style :</strong> <span>{{ form.style }}</span></div>
            <div class="recap-row"><strong>Image de référence :</strong> <span>{{ faceRefPath ? 'Oui' : 'Non' }}</span></div>
          </div>
          <div v-if="error" class="error">{{ error }}</div>
        </div>
      </div>

      <div class="actions">
        <button type="button" class="btn secondary" :disabled="step === 1 || loading" @click="prevStep">Précédent</button>

        <button
          v-if="step < totalSteps"
          type="button"
          class="btn primary"
          :disabled="loading || !canNext"
          @click="nextStep"
        >
          <span v-if="step === 2 && uploading">Upload...</span>
          <span v-else>Suivant</span>
        </button>

        <button v-else type="button" class="btn primary" :disabled="loading" @click="submit">
          <span v-if="loading">Création...</span>
          <span v-else>Créer mon influenceuse</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const step = ref(1)
const totalSteps = 3
const loading = ref(false)
const uploading = ref(false)
const error = ref('')
const uploadError = ref('')
const fileError = ref('')
const isDragging = ref(false)
const previewUrl = ref('')
const selectedFile = ref(null)
const faceRefPath = ref('')
const tempInfluencerId = ref(`temp-${Date.now()}`)
const fileInputRef = ref(null)

const form = reactive({
  name: '',
  niche: '',
  style: '',
})

const titles = ['Identité', 'Image de référence', 'Confirmation']
const subtitles = [
  'Renseigne les informations de base de ton influenceuse.',
  'Ajoute une image de référence pour ancrer la cohérence visuelle.',
  'Vérifie les données puis crée ton influenceuse.',
]

const stepTitle = computed(() => titles[step.value - 1])
const stepSubtitle = computed(() => subtitles[step.value - 1])

const filledWidth = computed(() => {
  const pct = ((step.value - 1) / (totalSteps - 1)) * 100
  return `${pct}%`
})

const canNext = computed(() => {
  if (step.value === 1) {
    return Boolean(form.name.trim() && form.niche.trim() && form.style.trim())
  }
  if (step.value === 2) {
    return Boolean(selectedFile.value || faceRefPath.value)
  }
  return true
})

function openFilePicker() {
  fileInputRef.value?.click()
}

function validImage(file) {
  if (!file) return false
  return ['image/jpeg', 'image/png'].includes(file.type)
}

function updatePreview(file) {
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value)
  }
  previewUrl.value = URL.createObjectURL(file)
}

function setFile(file) {
  fileError.value = ''
  uploadError.value = ''

  if (!validImage(file)) {
    selectedFile.value = null
    fileError.value = 'Format invalide. Utilise un fichier JPG ou PNG.'
    return
  }

  selectedFile.value = file
  updatePreview(file)
}

function onFileSelect(event) {
  const file = event.target?.files?.[0]
  setFile(file)
}

function onDrop(event) {
  isDragging.value = false
  const file = event.dataTransfer?.files?.[0]
  setFile(file)
}

async function uploadFaceRefIfNeeded() {
  if (faceRefPath.value || !selectedFile.value) return true

  uploading.value = true
  uploadError.value = ''

  try {
    const formData = new FormData()
    formData.append('file', selectedFile.value)
    formData.append('influencerId', tempInfluencerId.value)

    const response = await fetch('/api/upload/face-ref', {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      throw new Error(data?.statusMessage || data?.message || 'Upload impossible')
    }

    const data = await response.json()
    faceRefPath.value = data?.path || ''

    if (!faceRefPath.value) {
      throw new Error('Le serveur n a pas retourné de chemin de fichier')
    }

    return true
  } catch (err) {
    uploadError.value = err?.message || String(err)
    return false
  } finally {
    uploading.value = false
  }
}

async function nextStep() {
  if (!canNext.value || loading.value) return

  if (step.value === 2) {
    const uploaded = await uploadFaceRefIfNeeded()
    if (!uploaded) return
  }

  if (step.value < totalSteps) {
    step.value += 1
  }
}

function prevStep() {
  if (step.value > 1) {
    step.value -= 1
  }
}

async function submit() {
  if (loading.value) return

  loading.value = true
  error.value = ''

  try {
    const created = await $fetch('/api/influencers', {
      method: 'POST',
      body: {
        userId: 'user-test',
        name: form.name.trim(),
        niche: form.niche.trim(),
        style: form.style.trim(),
      },
    })

    if (faceRefPath.value) {
      await $fetch(`/api/influencers/${created.id}/face-ref`, {
        method: 'PATCH',
        body: { faceRefPath: faceRefPath.value },
      })
    }

    await router.push('/influencers')
  } catch (err) {
    error.value = err?.data?.statusMessage || err?.message || String(err)
  } finally {
    loading.value = false
  }
}

onBeforeUnmount(() => {
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value)
  }
})
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
  max-width: 680px;
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

.dropzone {
  border: 2px dashed var(--border);
  border-radius: 12px;
  padding: 22px;
  text-align: center;
  background: #fff;
  margin-bottom: 14px;
  transition: border-color 0.2s ease, background 0.2s ease;
}

.dropzone.dragging {
  border-color: var(--accent);
  background: #fff8f3;
}

.dropzone.invalid {
  border-color: #d84c4c;
}

.drop-title {
  margin: 0;
  font-weight: 700;
}

.drop-subtitle {
  margin: 8px 0;
  color: var(--muted);
}

.hidden-input {
  display: none;
}

.preview-wrap {
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
}

.preview {
  display: block;
  width: 100%;
  max-height: 320px;
  object-fit: cover;
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

.btn:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.error {
  color: #b00020;
  margin-top: 10px;
  font-size: 14px;
}

.success {
  color: #2f7d32;
  margin-top: 10px;
  font-size: 14px;
}

@media (max-width: 720px) {
  .page {
    padding: 16px;
  }

  .card {
    padding: 16px;
  }
}
</style>