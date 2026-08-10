<template>
  <div class="min-h-screen bg-[#0C0A08] text-[#FFF5EB] px-4 py-10 sm:px-8">
    <div class="mx-auto max-w-4xl rounded-[24px] border border-[#3A2A1E] bg-[#120C07] p-6 sm:p-8">
      <p class="text-xs uppercase tracking-[0.2em] text-[#F2B582]">Onboarding Brand</p>
      <h1 class="mt-3 text-3xl font-black tracking-tight">Lance ton espace marque</h1>

      <div class="mt-6 flex items-center gap-2 text-xs text-[#E9C9AE]">
        <span v-for="value in [1, 2, 3, 4]" :key="value" class="flex items-center gap-2">
          <span class="flex h-7 w-7 items-center justify-center rounded-full border" :class="step >= value ? 'border-[#E8873A] bg-[#E8873A] text-white' : 'border-[#5B4332]'">
            {{ value }}
          </span>
          <span v-if="value < 4" class="h-[1px] w-8 bg-[#5B4332]" />
        </span>
      </div>

      <div v-if="step === 1" class="mt-8 grid gap-4 sm:grid-cols-2">
        <div class="sm:col-span-2">
          <label class="block text-sm font-semibold">Nom de la marque</label>
          <input v-model="form.brandName" class="mt-2 w-full rounded-[12px] border border-[#5B4332] bg-[#1A120D] px-4 py-3 text-white outline-none focus:border-[#E8873A]" placeholder="Ex : Atelier Aurea" />
        </div>

        <div>
          <label class="block text-sm font-semibold">Secteur d activité</label>
          <input v-model="form.sector" class="mt-2 w-full rounded-[12px] border border-[#5B4332] bg-[#1A120D] px-4 py-3 text-white outline-none focus:border-[#E8873A]" placeholder="Ex : beaute, mode, retail, luxe..." />
        </div>

        <div>
          <label class="block text-sm font-semibold">Ton de communication</label>
          <select v-model="form.tone" class="mt-2 w-full rounded-[12px] border border-[#5B4332] bg-[#1A120D] px-4 py-3 text-white outline-none focus:border-[#E8873A]">
            <option value="">Selectionner</option>
            <option v-for="tone in toneOptions" :key="tone" :value="tone">{{ tone }}</option>
          </select>
        </div>
      </div>

      <div v-if="step === 2" class="mt-8 space-y-6">
        <div>
          <label class="block text-sm font-semibold">Logo (optionnel)</label>
          <input type="file" accept="image/jpeg,image/png,.jpg,.jpeg,.png,.svg" class="mt-2 w-full rounded-[12px] border border-[#5B4332] bg-[#1A120D] px-3 py-2 text-sm" @change="onLogoSelect" />
          <img v-if="logoPreviewUrl" :src="logoPreviewUrl" alt="Logo" class="mt-3 max-h-28 rounded-[10px] border border-[#5B4332] bg-white p-2" />
        </div>

        <div>
          <p class="text-sm font-semibold">Couleurs principales</p>
          <div class="mt-2 grid grid-cols-3 gap-3">
            <label v-for="(color, index) in form.primaryColors" :key="`primary-${index}`" class="rounded-[12px] border border-[#5B4332] bg-[#1A120D] p-3 text-xs">
              Principale {{ index + 1 }}
              <input v-model="form.primaryColors[index]" type="color" class="mt-2 h-10 w-full rounded" />
            </label>
          </div>
        </div>

        <div>
          <p class="text-sm font-semibold">Couleurs secondaires</p>
          <div class="mt-2 grid grid-cols-2 gap-3">
            <label v-for="(color, index) in form.secondaryColors" :key="`secondary-${index}`" class="rounded-[12px] border border-[#5B4332] bg-[#1A120D] p-3 text-xs">
              Secondaire {{ index + 1 }}
              <input v-model="form.secondaryColors[index]" type="color" class="mt-2 h-10 w-full rounded" />
            </label>
          </div>
        </div>
      </div>

      <div v-if="step === 3" class="mt-8 space-y-4">
        <p class="text-sm text-[#F5D4B8]">Plotline garantit que votre ambassadrice garde le même visage sur toutes vos campagnes — un avantage clé vs les outils génériques.</p>

        <label class="block text-sm font-semibold">Photo référence (obligatoire)</label>
        <input type="file" accept="image/jpeg,image/png,.jpg,.jpeg,.png" class="w-full rounded-[12px] border border-[#5B4332] bg-[#1A120D] px-3 py-2 text-sm" @change="onFaceFileSelect" />

        <img v-if="sourcePreviewUrl" :src="sourcePreviewUrl" alt="Source" class="max-h-56 rounded-[12px] border border-[#5B4332] object-cover" />

        <div class="grid gap-4 sm:grid-cols-2">
          <div>
            <label class="block text-sm font-semibold">Couleur des yeux</label>
            <select v-model="personalization.eyeColor" class="mt-2 w-full rounded-[12px] border border-[#5B4332] bg-[#1A120D] px-4 py-3 text-white">
              <option value="">Selectionner</option>
              <option v-for="option in eyeColorOptions" :key="option" :value="option">{{ option }}</option>
            </select>
            <input v-if="personalization.eyeColor === 'Autre'" v-model="personalization.eyeColorCustom" class="mt-2 w-full rounded-[12px] border border-[#5B4332] bg-[#1A120D] px-4 py-3 text-white" placeholder="Precise la couleur" />
          </div>

          <div>
            <label class="block text-sm font-semibold">Origine ethnique</label>
            <input v-model="personalization.origin" class="mt-2 w-full rounded-[12px] border border-[#5B4332] bg-[#1A120D] px-4 py-3 text-white" placeholder="Ex : Europe de l Est, Asiatique..." />
          </div>
        </div>

        <div>
          <label class="block text-sm font-semibold">Particularites (optionnel)</label>
          <input v-model="personalization.traits" class="mt-2 w-full rounded-[12px] border border-[#5B4332] bg-[#1A120D] px-4 py-3 text-white" placeholder="Ex : fossettes, taches de rousseur..." />
        </div>

        <div>
          <label class="block text-sm font-semibold">Silhouette</label>
          <div class="mt-2 grid gap-2 sm:grid-cols-2">
            <button
              v-for="option in silhouetteOptions"
              :key="option.value"
              type="button"
              class="rounded-[12px] border px-3 py-2 text-left text-sm"
              :class="form.silhouette === option.value ? 'border-[#E8873A] bg-[#28170D]' : 'border-[#5B4332] bg-[#1A120D]'"
              @click="form.silhouette = option.value"
            >
              {{ option.label }}
            </button>
          </div>
        </div>

        <p v-if="fileError" class="text-sm text-red-300">{{ fileError }}</p>
        <p v-if="generateError" class="text-sm text-red-300">{{ generateError }}</p>

        <button type="button" class="rounded-[12px] bg-[#E8873A] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50" :disabled="!sourceImageBase64 || generatingRef" @click="generateFaceReference">
          {{ generatingRef ? 'Génération en cours...' : 'Lancer le processus de cohérence faciale' }}
        </button>

        <img v-if="generatedImageDataUrl" :src="generatedImageDataUrl" alt="Cohérence faciale" class="max-h-64 rounded-[12px] border border-[#5B4332] object-cover" />
      </div>

      <div v-if="step === 4" class="mt-8 space-y-4">
        <h2 class="text-xl font-bold">Confirmation</h2>
        <div class="space-y-2 rounded-[12px] border border-[#5B4332] bg-[#1A120D] p-4 text-sm">
          <p><strong>Marque :</strong> {{ form.brandName }}</p>
          <p><strong>Secteur :</strong> {{ form.sector }}</p>
          <p><strong>Ton :</strong> {{ form.tone }}</p>
          <p><strong>Couleurs principales :</strong> {{ form.primaryColors.join(', ') }}</p>
          <p><strong>Couleurs secondaires :</strong> {{ form.secondaryColors.join(', ') }}</p>
          <p><strong>Ambassadrice :</strong> {{ generatedTempImagePath ? 'Configuree' : 'Manquante' }}</p>
        </div>

        <p v-if="submitError" class="text-sm text-red-300">{{ submitError }}</p>
      </div>

      <div class="mt-8 flex items-center justify-between gap-3">
        <button type="button" class="rounded-[12px] border border-[#5B4332] px-4 py-2.5 text-sm font-bold" :disabled="step === 1 || loading" @click="step -= 1">
          Précédent
        </button>

        <button v-if="step < 4" type="button" class="rounded-[12px] bg-[#E8873A] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50" :disabled="!canContinue || loading" @click="step += 1">
          Suivant
        </button>

        <button v-else type="button" class="rounded-[12px] bg-[#E8873A] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50" :disabled="loading" @click="submit">
          {{ loading ? 'Creation...' : 'Accéder a mon espace marque' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, reactive, ref } from 'vue'

const router = useRouter()

const toneOptions = [
  'Luxe & Premium',
  'Accessible & Chaleureux',
  'Jeune & Dynamique',
  'Professionnel & Expert',
]

const silhouetteOptions = [
  { value: 'SLIM', label: 'Mince' },
  { value: 'ATHLETIC', label: 'Athletique' },
  { value: 'VOLUPTUOUS', label: 'Voluptueuse' },
  { value: 'CURVY', label: 'Harmonieuse' },
]

const eyeColorOptions = ['Bleus', 'Verts', 'Marrons', 'Noisette', 'Noirs', 'Autre']

const step = ref(1)
const loading = ref(false)
const generatingRef = ref(false)

const fileError = ref('')
const generateError = ref('')
const submitError = ref('')

const logoPreviewUrl = ref('')
const sourcePreviewUrl = ref('')
const sourceImageBase64 = ref('')
const generatedImageBase64 = ref('')
const generatedTempImagePath = ref('')

const form = reactive({
  brandName: '',
  sector: '',
  tone: '',
  primaryColors: ['#e8873a', '#111111', '#f5d4b8'],
  secondaryColors: ['#5b4332', '#d4762f'],
  silhouette: 'VOLUPTUOUS',
})

const personalization = reactive({
  eyeColor: '',
  eyeColorCustom: '',
  origin: '',
  traits: '',
})

const generatedImageDataUrl = computed(() => {
  if (!generatedImageBase64.value) return ''
  if (generatedImageBase64.value.startsWith('data:image/')) return generatedImageBase64.value
  return `data:image/jpeg;base64,${generatedImageBase64.value}`
})

const dynamicTraitsLine = computed(() => {
  const resolvedEyeColor = personalization.eyeColor === 'Autre'
    ? personalization.eyeColorCustom.trim()
    : personalization.eyeColor.trim()

  const chunks = []
  if (resolvedEyeColor) chunks.push(`${resolvedEyeColor} eyes`)
  if (personalization.origin.trim()) chunks.push(`${personalization.origin.trim()} as ethnicity`)
  if (!chunks.length) return ''

  return `- ${chunks.join(' - ')}. These traits are mandatory and must prevail over source image ambiguities.`
})

const customPrompt = computed(() => {
  const parts = [
    'Create a professional character reference sheet of this exact character with strict face consistency, natural skin texture, white background and multiple neutral portrait angles.',
  ]

  if (dynamicTraitsLine.value) {
    parts.push(dynamicTraitsLine.value)
  }

  if (personalization.traits.trim()) {
    parts.push(`Particular traits to preserve: ${personalization.traits.trim()}.`)
  }

  return parts.join(' ')
})

const canContinue = computed(() => {
  if (step.value === 1) {
    return Boolean(form.brandName.trim() && form.sector.trim() && form.tone.trim())
  }
  if (step.value === 3) {
    return Boolean(generatedTempImagePath.value)
  }
  return true
})

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
    reader.onerror = () => reject(new Error('Impossible de lire l image source'))
    reader.readAsDataURL(file)
  })
}

function onLogoSelect(event) {
  const file = event.target?.files?.[0]
  if (!file) return

  if (logoPreviewUrl.value) {
    URL.revokeObjectURL(logoPreviewUrl.value)
  }

  logoPreviewUrl.value = URL.createObjectURL(file)
}

async function onFaceFileSelect(event) {
  fileError.value = ''
  generateError.value = ''

  const file = event.target?.files?.[0]
  if (!file) return

  if (!['image/jpeg', 'image/png'].includes(file.type)) {
    fileError.value = 'Format invalide. Utilise un fichier JPG ou PNG.'
    return
  }

  if (sourcePreviewUrl.value) {
    URL.revokeObjectURL(sourcePreviewUrl.value)
  }

  sourcePreviewUrl.value = URL.createObjectURL(file)

  try {
    sourceImageBase64.value = await readFileAsBase64(file)
    generatedImageBase64.value = ''
    generatedTempImagePath.value = ''
  } catch (err) {
    sourceImageBase64.value = ''
    fileError.value = err?.message || String(err)
  }
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
  } catch (err) {
    generateError.value = err?.data?.statusMessage || err?.message || String(err)
  } finally {
    generatingRef.value = false
  }
}

async function submit() {
  if (loading.value) return

  loading.value = true
  submitError.value = ''

  try {
    const styleParts = [
      form.tone,
      `Palette principale: ${form.primaryColors.join(', ')}`,
      `Palette secondaire: ${form.secondaryColors.join(', ')}`,
    ]

    const created = await $fetch('/api/profiles', {
      method: 'POST',
      body: {
        name: form.brandName.trim(),
        niche: form.sector.trim(),
        style: styleParts.join(' | '),
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

    await router.push('/brand-studio')
  } catch (err) {
    submitError.value = err?.data?.statusMessage || err?.message || String(err)
  } finally {
    loading.value = false
  }
}

onBeforeUnmount(() => {
  if (logoPreviewUrl.value) {
    URL.revokeObjectURL(logoPreviewUrl.value)
  }
  if (sourcePreviewUrl.value) {
    URL.revokeObjectURL(sourcePreviewUrl.value)
  }
})
</script>
