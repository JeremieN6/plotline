<template>
  <div class="page">
    <div class="card">
      <button
        type="button"
        class="close-btn"
        @click="cancelWizard"
      >
        ✕
      </button>

      <div class="progress-wrap">
        <div class="progress-track"></div>
        <div class="progress-fill" :style="{ width: filledWidth }"></div>
        <div class="steps">
          <div
            v-for="item in stepItems"
            :key="item.id"
            class="step-bubble"
            :class="{ active: step === item.id }"
          >
            <span class="circle">{{ item.id }}</span>
            <span class="step-label">{{ item.label }}</span>
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

          <div class="field-group">
            <label class="field-label">Silhouette</label>
            <div class="silhouette-grid">
              <button
                v-for="option in silhouetteOptions"
                :key="option.value"
                type="button"
                class="silhouette-card"
                :class="{ selected: form.silhouette === option.value }"
                :aria-pressed="form.silhouette === option.value"
                @click.stop="setSilhouette(option.value)"
              >
                <div class="silhouette-head">
                  <span class="silhouette-emoji">{{ option.emoji }}</span>
                  <span v-if="form.silhouette === option.value" class="silhouette-selected-mark">✓</span>
                  <span v-if="option.isDefault" class="silhouette-badge">Par defaut</span>
                </div>
                <p class="silhouette-name">{{ option.label }}</p>
                <p class="silhouette-description">{{ option.description }}</p>
              </button>
            </div>
            <p v-if="step1ValidationMessage" class="step1-hint">{{ step1ValidationMessage }}</p>
          </div>
        </div>

        <div v-if="step === 2" class="step-content">
          <p class="step2-description">
            L'image de reference fixe le visage de ton influenceuse pour toujours. Toutes tes générations futures
            utiliseront ce visage.
          </p>

          <label class="field-label">Upload une photo source (visage degage, cadrage buste minimum)</label>
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
              <p class="drop-title">Glisse ta photo ici</p>
              <p class="drop-subtitle">ou</p>
              <button type="button" class="btn secondary" @click="openFilePicker">Choisir un fichier</button>
            </div>
          </div>

          <div v-if="sourcePreviewUrl" class="source-preview-wrap">
            <img :src="sourcePreviewUrl" alt="Photo source" class="source-preview" />
          </div>

          <div v-if="fileError" class="error">{{ fileError }}</div>
          <div class="prompt-editor">
            <div class="base-prompt">{{ basePrompt }}</div>

            <div class="personalization">
              <h3 class="prompt-section-title">Personnalisation</h3>

              <div class="field-group">
                <label class="field-label">Couleur des yeux</label>
                <div class="pill-row">
                  <button
                    v-for="option in eyeColorOptions"
                    :key="option"
                    type="button"
                    class="pill"
                    :class="{ selected: personalization.eyeColor === option }"
                    @click="setEyeColor(option)"
                  >
                    {{ option }}
                  </button>
                </div>
                <input
                  v-if="personalization.eyeColor === 'Autre'"
                  v-model="personalization.eyeColorCustom"
                  class="input"
                  placeholder="Precise la couleur des yeux"
                />
              </div>

              <div class="field-group">
                <label class="field-label">Origine ethnique</label>
                <input
                  v-model="personalization.origin"
                  class="input"
                  placeholder="ex: Europe de l'Est, Arabe, Asiatique, Latina..."
                />
              </div>

              <div class="field-group">
                <label class="field-label">Particularites (optionnel)</label>
                <input
                  v-model="personalization.traits"
                  class="input"
                  placeholder="ex: tâches de rousseur, lunettes, fossettes..."
                />
              </div>

              <div class="dynamic-line">{{ dynamicTraitsLine || '-' }}</div>
            </div>
          </div>

          <div v-if="generateError" class="error">{{ generateError }}</div>

          <button
            type="button"
            class="btn primary full-width"
            :disabled="!sourceImageBase64 || generatingRef"
            @click="generateFaceReference"
          >
            <span v-if="generatingRef" class="spinner-wrap">
              <span class="spinner" aria-hidden="true"></span>
              <span>Génération en cours... (~30s)</span>
            </span>
            <span v-else>Générer l'image de réfrénce</span>
          </button>
        </div>

        <div v-if="step === 3" class="step-content">
          <p class="step3-description">
            Voici la fiche référence de ton influenceuse. Elle sera utilisée pour toutes tes générations.
          </p>

          <div class="generated-preview-wrap">
            <img
              v-if="generatedImageDataUrl"
              :src="generatedImageDataUrl"
              alt="Fiche reference generee"
              class="generated-preview"
            />
          </div>

          <div class="step3-actions">
            <button type="button" class="btn outline-orange" @click="goBackToStep2">🔄 Regénérer</button>
            <button type="button" class="btn primary" @click="validateReference">✓ Valider cette référence</button>
          </div>
        </div>

        <div v-if="step === 4" class="step-content">
          <div class="recap">
            <div class="recap-row"><strong>Nom :</strong> <span>{{ form.name }}</span></div>
            <div class="recap-row"><strong>Niche :</strong> <span>{{ form.niche }}</span></div>
            <div class="recap-row"><strong>Style :</strong> <span>{{ form.style }}</span></div>
            <div class="recap-row"><strong>Silhouette :</strong> <span>{{ selectedSilhouetteLabel }}</span></div>
            <div class="recap-row"><strong>Image de référence :</strong> <span>{{ generatedImageDataUrl ? 'Oui' : 'Non' }}</span></div>
          </div>

          <div v-if="generatedImageDataUrl" class="recap-thumb-wrap">
            <img :src="generatedImageDataUrl" alt="Miniature reference" class="recap-thumb" />
          </div>

          <div v-if="submitError" class="error">{{ submitError }}</div>
        </div>
      </div>

      <div class="actions">
        <button
          type="button"
          class="btn secondary"
          :disabled="loading || generatingRef"
          @click="prevStepOrClose"
        >
          {{ step === 1 ? 'Fermer' : 'Précédent' }}
        </button>

        <button
          v-if="step === 1"
          type="button"
          class="btn primary"
          :disabled="!canGoFromStep1 || loading || generatingRef"
          @click="nextStep"
        >
          Suivant
        </button>

        <button
          v-if="step === 4"
          type="button"
          class="btn primary"
          :disabled="loading || generatingRef || !generatedTempImagePath"
          @click="submit"
        >
          <span v-if="loading">Creation...</span>
          <span v-else>Creer mon influenceuse</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthSession } from '../../composables/useAuthSession'
import { resolveAccountHomePath } from '~/composables/useAccountRouting'

const router = useRouter()
const { user, refreshAuth } = useAuthSession()

const totalSteps = 4
const step = ref(1)
const loading = ref(false)
const generatingRef = ref(false)

const fileInputRef = ref(null)
const isDragging = ref(false)
const fileError = ref('')
const generateError = ref('')
const submitError = ref('')

const selectedFile = ref(null)
const sourcePreviewUrl = ref('')
const sourceImageBase64 = ref('')

const generatedImageBase64 = ref('')
const generatedTempImagePath = ref('')

const form = reactive({
  name: '',
  niche: '',
  style: '',
  silhouette: 'VOLUPTUOUS',
})

const personalization = reactive({
  eyeColor: '',
  eyeColorCustom: '',
  origin: '',
  traits: '',
})

const silhouetteOptions = [
  {
    value: 'SLIM',
    emoji: '🌿',
    label: 'Mince',
    description: 'Elancée, minimaliste, éditoriale',
    isDefault: false,
  },
  {
    value: 'ATHLETIC',
    emoji: '💪',
    label: 'Athletique',
    description: 'Tonique, sportive, fit',
    isDefault: false,
  },
  {
    value: 'VOLUPTUOUS',
    emoji: '🔥',
    label: 'Voluptueuse',
    description: 'Sablier prononcé, courbes marquées',
    isDefault: true,
  },
  {
    value: 'CURVY',
    emoji: '🫧',
    label: 'Harmonieuse',
    description: 'Courbes douces, taille dessinée, silhouette plus équilibrée',
    isDefault: false,
  },
]

const eyeColorOptions = ['Bleus', 'Verts', 'Marrons', 'Noisette', 'Noirs', 'Autre']

const basePrompt =
  'Create a professional character reference sheet of this exact character. Feature perfect character consistency and exact 1:1 likeness of the uploaded reference across all 3 panels. The image must be a vertical composite sheet divided into three equal horizontal rows. All panels prominently display the character on a pure white (#FFFFFF) background. The sheet must contain 3 distinct close-ups: Front View, 45-Degree Angle, Side Profile, with neutral face expression. The final image must be a true-to-life photography capturing real skin pores, fine lines, natural color variation, neutral expression, and authentic texture. Professional portrait photography with organic depth of field, preserving all natural human characteristics without digital smoothing or enhancement. 4K quality. No duplication of identical panels and no inconsistent features.'

const stepItems = [
  { id: 1, label: 'Identité' },
  { id: 2, label: 'Cohérence faciale' },
  { id: 3, label: 'Validation' },
  { id: 4, label: 'Confirmation' },
]

const titles = {
  1: 'Identité',
  2: 'Création de l\'image de référence',
  3: 'Validation de l\'image de référence',
  4: 'Confirmation',
}

const subtitles = {
  1: 'Renseigne les informations de base de ton influenceuse.',
  2: 'Génère la fiche référence de ton influenceuse à partir d\'une photo source.',
  3: 'Vérifie la fiche référence avant de finaliser la creation.',
  4: 'Récapitulatif final avant creation.',
}

const stepTitle = computed(() => titles[step.value])
const stepSubtitle = computed(() => subtitles[step.value])
const exitPath = computed(() => resolveAccountHomePath(user.value?.accountType))

const filledWidth = computed(() => {
  const pct = ((step.value - 1) / (totalSteps - 1)) * 100
  return `${pct}%`
})

const canGoFromStep1 = computed(() => {
  return Boolean(form.name.trim() && form.niche.trim() && form.style.trim())
})

const step1ValidationMessage = computed(() => {
  if (canGoFromStep1.value) return ''

  const missing = []
  if (!form.name.trim()) missing.push('Nom')
  if (!form.niche.trim()) missing.push('Niche')
  if (!form.style.trim()) missing.push('Style')

  return missing.length ? `Complète: ${missing.join(', ')}.` : ''
})

const resolvedEyeColor = computed(() => {
  if (personalization.eyeColor === 'Autre') {
    return personalization.eyeColorCustom.trim()
  }
  return personalization.eyeColor.trim()
})

const selectedSilhouetteLabel = computed(() => {
  const found = silhouetteOptions.find((item) => item.value === form.silhouette)
  return found?.label || 'Voluptueuse'
})

const dynamicTraitsLine = computed(() => {
  const chunks = []

  if (resolvedEyeColor.value) {
    chunks.push(`${resolvedEyeColor.value} eyes`)
  }

  if (personalization.origin.trim()) {
    chunks.push(`${personalization.origin.trim()} comme origine ethnique`)
  }

  if (chunks.length === 0) {
    return ''
  }

  return `- ${chunks.join(' - ')}. Ces caractéristiques sont impératives et prévalent sur tout élément visible sur l'image de référence.`
})

const customPrompt = computed(() => {
  const parts = [basePrompt]

  if (dynamicTraitsLine.value) {
    parts.push(dynamicTraitsLine.value)
  }

  if (personalization.traits.trim()) {
    parts.push(`Particular traits to preserve: ${personalization.traits.trim()}.`)
  }

  return parts.join(' ')
})

const generatedImageDataUrl = computed(() => {
  if (!generatedImageBase64.value) return ''
  if (generatedImageBase64.value.startsWith('data:image/')) return generatedImageBase64.value
  return `data:image/jpeg;base64,${generatedImageBase64.value}`
})

function openFilePicker() {
  fileInputRef.value?.click()
}

function validImage(file) {
  if (!file) return false
  return ['image/jpeg', 'image/png'].includes(file.type)
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => {
      const result = String(reader.result || '')
      const base64 = result.includes(',') ? result.split(',')[1] : ''
      if (!base64) {
        reject(new Error('Impossible de lire l image source'))
        return
      }
      resolve(base64)
    }

    reader.onerror = () => {
      reject(new Error('Impossible de lire l image source'))
    }

    reader.readAsDataURL(file)
  })
}

async function setFile(file) {
  fileError.value = ''
  generateError.value = ''

  if (!validImage(file)) {
    selectedFile.value = null
    sourceImageBase64.value = ''
    fileError.value = 'Format invalide. Utilise un fichier JPG ou PNG.'
    return
  }

  selectedFile.value = file

  if (sourcePreviewUrl.value) {
    URL.revokeObjectURL(sourcePreviewUrl.value)
  }
  sourcePreviewUrl.value = URL.createObjectURL(file)

  try {
    sourceImageBase64.value = await readFileAsBase64(file)
  } catch (err) {
    sourceImageBase64.value = ''
    fileError.value = err?.message || String(err)
  }
}

async function onFileSelect(event) {
  const file = event.target?.files?.[0]
  if (!file) return
  await setFile(file)
}

async function onDrop(event) {
  isDragging.value = false
  const file = event.dataTransfer?.files?.[0]
  if (!file) return
  await setFile(file)
}

function setSilhouette(value) {
  form.silhouette = value
}

function setEyeColor(option) {
  personalization.eyeColor = option
  if (option !== 'Autre') {
    personalization.eyeColorCustom = ''
  }
}

function nextStep() {
  if (step.value === 1 && canGoFromStep1.value) {
    step.value = 2
  }
}

function prevStep() {
  if (step.value > 1) {
    step.value -= 1
  }
}

function prevStepOrClose() {
  if (step.value === 1) {
    cancelWizard()
    return
  }

  prevStep()
}

async function cancelWizard() {
  if (loading.value || generatingRef.value) return
  await router.push(exitPath.value || '/dashboard')
}

async function generateFaceReference() {
  if (!sourceImageBase64.value || generatingRef.value) return

  generatingRef.value = true
  generateError.value = ''

  try {
    const payload = await $fetch('/api/generate/face-ref', {
      method: 'POST',
      body: {
        sourceImageBase64: sourceImageBase64.value,
        customPrompt: customPrompt.value,
      },
    })

    generatedImageBase64.value = payload?.imageBase64 || ''
    generatedTempImagePath.value = payload?.tempImagePath || ''

    if (!generatedImageBase64.value || !generatedTempImagePath.value) {
      throw new Error('La generation n a pas retourne d image exploitable')
    }

    step.value = 3
  } catch (err) {
    generateError.value = err?.data?.statusMessage || err?.message || String(err)
  } finally {
    generatingRef.value = false
  }
}

function goBackToStep2() {
  step.value = 2
}

function validateReference() {
  if (!generatedImageBase64.value || !generatedTempImagePath.value) return
  step.value = 4
}

async function submit() {
  if (loading.value) return

  loading.value = true
  submitError.value = ''

  try {
    await refreshAuth()

    const created = await $fetch('/api/influencers', {
      method: 'POST',
      body: {
        userId: user.value?.id || undefined,
        name: form.name.trim(),
        niche: form.niche.trim(),
        style: form.style.trim(),
        silhouette: form.silhouette,
      },
    })

    if (generatedTempImagePath.value) {
      await $fetch('/api/upload/face-ref', {
        method: 'POST',
        body: {
          influencerId: created.id,
          tempImagePath: generatedTempImagePath.value,
        },
      })
    }

    await router.push('/dashboard')
  } catch (err) {
    submitError.value = err?.data?.statusMessage || err?.message || String(err)
  } finally {
    loading.value = false
  }
}

onBeforeUnmount(() => {
  if (sourcePreviewUrl.value) {
    URL.revokeObjectURL(sourcePreviewUrl.value)
  }
})
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');

.page {
  position: fixed;
  inset: 0;
  z-index: 70;
  --card: #19110a;
  --text: #fff4e6;
  --muted: #f3cdb0;
  --accent: #e8873a;
  --border: rgba(244, 205, 169, 0.22);
  --radius: 28px;
  background: rgba(14, 11, 7, 0.55);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  font-family: Inter, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial;
  color: var(--text);
  padding: 20px;
  box-sizing: border-box;
  overflow-y: auto;
}

.card {
  position: relative;
  z-index: 1;
  margin: auto;
  overflow: hidden;
  background: var(--card);
  border: 1px solid rgba(244, 205, 169, 0.4);
  border-radius: var(--radius);
  width: 100%;
  max-width: 760px;
  padding: 28px;
  box-shadow: 0 28px 80px rgba(0, 0, 0, 0.45);
}

.close-btn {
  position: absolute;
  top: -10px;
  left: 42em;
  z-index: 3;
  width: 34px;
  height: 34px;
  border-radius: 999px;
  border: 1px solid rgba(244, 205, 169, 0.24);
  background: rgba(10, 7, 5, 0.7);
  color: #f6d7bd;
  font-weight: 700;
  cursor: pointer;
}

.card::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 18% 15%, rgba(232, 135, 58, 0.28), transparent 48%),
    radial-gradient(circle at 86% 4%, rgba(246, 177, 102, 0.18), transparent 38%);
  pointer-events: none;
}

.card > * {
  position: relative;
  z-index: 1;
}

.progress-wrap {
  position: relative;
  margin-bottom: 20px;
  padding-top: 4px;
}

.progress-track {
  position: absolute;
  left: 16px;
  right: 16px;
  top: 18px;
  height: 8px;
  background: rgba(255, 244, 230, 0.08);
  border-radius: 999px;
}

.progress-fill {
  position: absolute;
  left: 16px;
  top: 18px;
  height: 8px;
  background: linear-gradient(90deg, #ff8d3b 0%, #e8873a 55%, #d46f26 100%);
  box-shadow: 0 0 0 1px rgba(232, 135, 58, 0.26), 0 4px 16px rgba(232, 135, 58, 0.32);
  border-radius: 999px;
  transition: width 0.3s ease;
}

.steps {
  position: relative;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  z-index: 2;
}

.step-bubble {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  flex-direction: column;
}

.circle {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: rgba(18, 12, 7, 0.95);
  border: 1px solid rgba(244, 205, 169, 0.16);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #f1cfb3;
  font-weight: 600;
}

.step-label {
  font-size: 12px;
  color: rgba(243, 205, 176, 0.82);
  font-weight: 600;
}

.step-bubble.active .circle {
  background: var(--accent);
  color: #ffffff;
  border-color: var(--accent);
  box-shadow: 0 8px 18px rgba(232, 135, 58, 0.25);
}

.step-bubble.active .step-label {
  color: var(--accent);
}

.title {
  margin: 8px 0 4px;
  font-size: 20px;
  font-weight: 600;
  color: var(--text);
}

.subtitle {
  margin: 0 0 16px;
  color: rgba(243, 205, 176, 0.82);
  font-size: 14px;
}

.step-content {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.step2-description,
.step3-description {
  margin: 0 0 4px;
  color: var(--muted);
  font-size: 14px;
  line-height: 1.45;
}

.field-label {
  display: block;
  font-weight: 600;
  margin-bottom: 6px;
  color: var(--text);
  font-size: 14px;
}

.field-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid rgba(244, 205, 169, 0.16);
  border-radius: 8px;
  background: rgba(10, 7, 5, 0.9);
  color: var(--text);
  box-sizing: border-box;
  font-size: 14px;
}

.dropzone {
  border: 1px dashed rgba(244, 205, 169, 0.28);
  border-radius: 12px;
  padding: 22px;
  text-align: center;
  background: rgba(12, 8, 5, 0.82);
  transition: border-color 0.2s ease, background 0.2s ease, transform 0.2s ease;
}

.dropzone.dragging {
  border-color: var(--accent);
  background: rgba(232, 135, 58, 0.1);
  transform: translateY(-1px);
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
  color: rgba(243, 205, 176, 0.76);
}

.hidden-input {
  display: none;
}

.source-preview-wrap {
  width: 200px;
  height: 200px;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid rgba(244, 205, 169, 0.16);
}

.source-preview {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.prompt-editor {
  border: 1px solid rgba(244, 205, 169, 0.16);
  border-radius: 12px;
  overflow: hidden;
  background: rgba(12, 8, 5, 0.82);
}

.base-prompt {
  background: rgba(255, 255, 255, 0.03);
  color: rgba(255, 244, 230, 0.55);
  padding: 12px;
  font-size: 13px;
  line-height: 1.5;
}

.personalization {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.prompt-section-title {
  margin: 0;
  font-size: 14px;
}

.pill-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.pill {
  border: 1px solid #f2b07e;
  background: #fff6ef;
  color: #bd5f17;
  border-radius: 999px;
  padding: 6px 11px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.pill.selected {
  border-color: var(--accent);
  background: var(--accent);
  color: #ffffff;
}

.silhouette-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.silhouette-card {
  position: relative;
  text-align: left;
  border: 1px solid rgba(244, 205, 169, 0.16);
  border-radius: 12px;
  background: rgba(12, 8, 5, 0.88);
  padding: 10px;
  cursor: pointer;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
}

.silhouette-card:hover {
  border-color: rgba(232, 135, 58, 0.45);
  transform: translateY(-1px);
}

.silhouette-card.selected {
  border-color: #ff9a57;
  box-shadow: 0 0 0 1px rgba(255, 154, 87, 0.42), 0 12px 26px rgba(232, 135, 58, 0.28);
  background: rgba(232, 135, 58, 0.1);
}

.silhouette-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.silhouette-emoji {
  font-size: 18px;
  line-height: 1;
}

.silhouette-badge {
  font-size: 10px;
  font-weight: 700;
  color: #f6cfb0;
  border: 1px solid rgba(244, 205, 169, 0.24);
  background: rgba(232, 135, 58, 0.16);
  border-radius: 999px;
  padding: 2px 8px;
}

.silhouette-selected-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 999px;
  background: rgba(255, 153, 85, 0.24);
  border: 1px solid rgba(255, 170, 109, 0.65);
  color: #ffd9bd;
  font-size: 12px;
  font-weight: 700;
}

.silhouette-name {
  margin: 8px 0 4px;
  font-size: 14px;
  font-weight: 700;
  color: #fff4e6;
}

.silhouette-description {
  margin: 0;
  font-size: 12px;
  color: rgba(243, 205, 176, 0.76);
  line-height: 1.4;
}

.dynamic-line {
  border: 1px dashed rgba(244, 205, 169, 0.18);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.03);
  padding: 10px;
  color: #f7d2b4;
  font-size: 13px;
  line-height: 1.45;
}

.step1-hint {
  margin: 2px 0 0;
  font-size: 12px;
  color: #f6bf97;
}

.generated-preview-wrap {
  display: flex;
  justify-content: center;
}

.generated-preview {
  width: 100%;
  max-width: 400px;
  border-radius: 12px;
  border: 1px solid rgba(244, 205, 169, 0.16);
  display: block;
}

.step3-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
  margin-top: 10px;
}

.recap {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(244, 205, 169, 0.16);
  border-radius: 8px;
  padding: 12px;
}

.recap-row {
  margin-bottom: 8px;
  color: var(--text);
  font-size: 14px;
}

.recap-row:last-child {
  margin-bottom: 0;
}

.recap-thumb-wrap {
  width: 140px;
  height: 140px;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid var(--border);
}

.recap-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
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
  border: 1px solid rgba(244, 205, 169, 0.18);
  background: transparent;
  cursor: pointer;
  font-weight: 600;
  font-size: 14px;
}

.btn.secondary {
  background: rgba(42, 28, 18, 0.9);
  color: var(--text);
}

.btn.primary {
  background: linear-gradient(180deg, #e8873a 0%, #d46f26 100%);
  color: #ffffff;
  border-color: var(--accent);
}

.btn.outline-orange {
  border-color: var(--accent);
  color: var(--accent);
  background: rgba(232, 135, 58, 0.08);
}

.btn.full-width {
  width: 100%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.btn:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.spinner-wrap {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.spinner {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.35);
  border-top-color: #ffffff;
  animation: spin 0.8s linear infinite;
}

.error {
  color: #ff8e8e;
  font-size: 14px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 720px) {
  .page {
    padding: 16px;
  }

  .card {
    padding: 16px;
  }

  .step-label {
    font-size: 11px;
  }

  .step3-actions {
    flex-direction: column;
  }

  .silhouette-grid {
    grid-template-columns: 1fr;
  }
}
</style>
