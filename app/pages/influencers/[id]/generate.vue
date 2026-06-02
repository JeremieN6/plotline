<template>
  <div class="page">
    <div class="container">
      <aside class="panel config">
        <h2 class="section-title">Direction créative</h2>

        <div class="group" v-for="group in optionGroups" :key="group.key">
          <p class="group-title">{{ group.label }}</p>
          <div class="visual-radios">
            <button
              v-for="option in group.options"
              :key="option"
              type="button"
              class="radio-pill"
              :class="{ selected: selections[group.key] === option }"
              @click="selectOption(group.key, option)"
            >
              {{ option }}
            </button>
          </div>
        </div>

        <button class="btn generate" :disabled="generating" @click="generateImage">
          <span v-if="generating" class="generation-label"><span class="spinner"></span> Génération...</span>
          <span v-else>Générer</span>
        </button>

        <p v-if="errorMsg" class="error">{{ errorMsg }}</p>
      </aside>

      <main class="panel results">
        <div v-if="!generated && !generating" class="empty-state">
          Lance une génération pour voir l'image et la caption ici.
        </div>

        <div v-else-if="generating" class="loading-state">
          <span class="spinner large"></span>
          <p>Création de l'image en cours...</p>
        </div>

        <div v-else class="generated">
          <img :src="generated.imageUrl" alt="Image générée" class="generated-image" />

          <div class="caption-box">
            <p class="caption">{{ generated.caption || 'Aucune caption générée.' }}</p>
            <button class="btn secondary small" @click="copyCaption">Copier</button>
          </div>

          <p v-if="copyMsg" class="copy-msg">{{ copyMsg }}</p>
        </div>
      </main>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const generating = ref(false)
const errorMsg = ref('')
const copyMsg = ref('')
const generated = ref(null)

const optionGroups = [
  {
    key: 'location',
    label: 'Location',
    options: [
      'bedroom mirror',
      'beach at sunset',
      'cafe terrace Paris',
      'poolside luxury',
      'hotel room morning',
      'bathroom vanity',
      'rooftop city view',
    ],
  },
  {
    key: 'outfit',
    label: 'Outfit',
    options: [
      'white crop top + high waist jeans',
      'black bikini',
      'beige linen dress',
      'sport bra + leggings',
      'satin slip dress nude',
      'floral summer dress',
    ],
  },
  {
    key: 'pose',
    label: 'Pose',
    options: [
      'mirror selfie arm raised',
      'over shoulder looking back',
      'leaning against wall',
      'sitting legs crossed candid',
      'standing profile arms relaxed',
    ],
  },
  {
    key: 'mood',
    label: 'Mood',
    options: [
      'playful smile',
      'sultry soft look',
      'candid laugh eyes closed',
      'serene gaze distance',
      'warm natural smile',
    ],
  },
  {
    key: 'lighting',
    label: 'Lighting',
    options: [
      'golden hour warm backlight',
      'soft diffused indoor',
      'bright natural window light',
      'warm sunset side light',
      'cool morning light',
    ],
  },
]

const selections = reactive({
  location: optionGroups[0].options[0],
  outfit: optionGroups[1].options[0],
  pose: optionGroups[2].options[0],
  mood: optionGroups[3].options[0],
  lighting: optionGroups[4].options[0],
})

function selectOption(groupKey, option) {
  selections[groupKey] = option
}

async function generateImage() {
  if (generating.value) return

  generating.value = true
  errorMsg.value = ''
  copyMsg.value = ''

  try {
    const response = await $fetch('/api/generate/image', {
      method: 'POST',
      body: {
        influencerId: route.params.id,
        location: selections.location,
        outfit: selections.outfit,
        pose: selections.pose,
        mood: selections.mood,
        lighting: selections.lighting,
      },
    })

    generated.value = {
      imageUrl: response.imageUrl,
      caption: response.caption,
    }
  } catch (err) {
    errorMsg.value = err?.data?.statusMessage || err?.message || String(err)
  } finally {
    generating.value = false
  }
}

async function copyCaption() {
  if (!generated.value?.caption) return

  try {
    await navigator.clipboard.writeText(generated.value.caption)
    copyMsg.value = 'Caption copiée.'
  } catch (err) {
    copyMsg.value = 'Copie impossible.'
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
  width: 42%;
  box-sizing: border-box;
}

.results {
  width: 58%;
  box-sizing: border-box;
  min-height: 640px;
}

.section-title {
  margin-top: 0;
  margin-bottom: 14px;
}

.group {
  margin-bottom: 16px;
}

.group-title {
  margin: 0 0 8px;
  font-weight: 700;
}

.visual-radios {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.radio-pill {
  border: 1px solid var(--border);
  background: #fff;
  border-radius: 999px;
  padding: 7px 12px;
  font-size: 13px;
  color: var(--text);
  cursor: pointer;
}

.radio-pill.selected {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
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

.btn.generate {
  margin-top: 10px;
  width: 100%;
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
}

.btn.secondary {
  background: #fff;
  color: var(--text);
}

.btn.small {
  padding: 8px 12px;
}

.btn:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.generation-label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255,255,255,0.55);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.9s linear infinite;
}

.spinner.large {
  width: 28px;
  height: 28px;
  border: 3px solid rgba(232,135,58,0.28);
  border-top-color: var(--accent);
}

.error {
  margin-top: 10px;
  color: #b00020;
}

.empty-state {
  min-height: 580px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--muted);
  text-align: center;
}

.loading-state {
  min-height: 580px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--muted);
}

.generated-image {
  width: 100%;
  border-radius: 12px;
  border: 1px solid var(--border);
  margin-bottom: 12px;
}

.caption-box {
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.caption {
  margin: 0;
  white-space: pre-wrap;
}

.copy-msg {
  margin-top: 8px;
  color: #2f7d32;
  font-size: 13px;
}

@media (max-width: 980px) {
  .container {
    flex-direction: column;
  }

  .config,
  .results {
    width: 100%;
  }

  .results {
    min-height: auto;
  }

  .empty-state,
  .loading-state {
    min-height: 280px;
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>