<template>
  <div class="min-h-screen bg-[#0C0A08] text-[#FFF5EB] px-4 py-10 sm:px-8">
    <div class="mx-auto max-w-3xl rounded-[24px] border border-[#3A2A1E] bg-[#120C07] p-6 sm:p-8">
      <p class="text-xs uppercase tracking-[0.2em] text-[#F2B582]">Onboarding Content Creator</p>
      <h1 class="mt-3 text-3xl font-black tracking-tight">Configuration rapide</h1>

      <div class="mt-6 flex items-center gap-2 text-xs text-[#E9C9AE]">
        <span v-for="value in [1, 2, 3]" :key="value" class="flex items-center gap-2">
          <span class="flex h-7 w-7 items-center justify-center rounded-full border" :class="step >= value ? 'border-[#E8873A] bg-[#E8873A] text-white' : 'border-[#5B4332]'">
            {{ value }}
          </span>
          <span v-if="value < 3" class="h-[1px] w-8 bg-[#5B4332]" />
        </span>
      </div>

      <div v-if="step === 1" class="mt-8 space-y-4">
        <label class="block text-sm font-semibold">Ton prénom ou nom de marque</label>
        <input v-model="form.name" class="w-full rounded-[12px] border border-[#5B4332] bg-[#1A120D] px-4 py-3 text-white outline-none focus:border-[#E8873A]" placeholder="Ex : Jade Studio" />

        <label class="block text-sm font-semibold">Ta niche</label>
        <input v-model="form.niche" class="w-full rounded-[12px] border border-[#5B4332] bg-[#1A120D] px-4 py-3 text-white outline-none focus:border-[#E8873A]" placeholder="Ex : business, education, lifestyle, tech..." />

        <label class="block text-sm font-semibold">Ton style de contenu</label>
        <input v-model="form.style" class="w-full rounded-[12px] border border-[#5B4332] bg-[#1A120D] px-4 py-3 text-white outline-none focus:border-[#E8873A]" placeholder="Ex : minimaliste, colore, premium..." />
      </div>

      <div v-if="step === 2" class="mt-8 space-y-4">
        <p class="text-sm text-[#F5D4B8]">Tu peux associer un visage cohérent à tes créations. Optionnel — tu peux le faire plus tard.</p>

        <label class="flex items-center gap-3 rounded-[12px] border border-[#5B4332] bg-[#1A120D] px-4 py-3">
          <input v-model="addFaceRef" type="checkbox" class="h-4 w-4 accent-[#E8873A]" />
          <span class="text-sm font-semibold">Ajouter une référence visuelle</span>
        </label>

        <div v-if="addFaceRef" class="space-y-4">
          <label class="block text-sm font-semibold">Upload une photo source</label>
          <input type="file" accept="image/jpeg,image/png,.jpg,.jpeg,.png" class="w-full rounded-[12px] border border-[#5B4332] bg-[#1A120D] px-3 py-2 text-sm" @change="onFileSelect" />

          <img v-if="sourcePreviewUrl" :src="sourcePreviewUrl" alt="Source" class="max-h-56 rounded-[12px] border border-[#5B4332] object-cover" />

          <p v-if="fileError" class="text-sm text-red-300">{{ fileError }}</p>
          <p v-if="generateError" class="text-sm text-red-300">{{ generateError }}</p>

          <button type="button" class="rounded-[12px] bg-[#E8873A] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50" :disabled="!sourceImageBase64 || generatingRef" @click="generateFaceReference">
            {{ generatingRef ? 'Generation en cours...' : 'Generer la face ref' }}
          </button>

          <img v-if="generatedImageDataUrl" :src="generatedImageDataUrl" alt="Face ref" class="max-h-64 rounded-[12px] border border-[#5B4332] object-cover" />
        </div>
      </div>

      <div v-if="step === 3" class="mt-8 space-y-4">
        <h2 class="text-xl font-bold">Confirmation</h2>
        <div class="space-y-2 rounded-[12px] border border-[#5B4332] bg-[#1A120D] p-4 text-sm">
          <p><strong>Nom :</strong> {{ form.name }}</p>
          <p><strong>Niche :</strong> {{ form.niche }}</p>
          <p><strong>Style :</strong> {{ form.style }}</p>
          <p><strong>Ambassadeur·ice :</strong> {{ addFaceRef ? (generatedTempImagePath ? 'Configuree' : 'A configurer plus tard') : 'Non active' }}</p>
        </div>

        <p v-if="submitError" class="text-sm text-red-300">{{ submitError }}</p>
      </div>

      <div class="mt-8 flex items-center justify-between gap-3">
        <button type="button" class="rounded-[12px] border border-[#5B4332] px-4 py-2.5 text-sm font-bold" :disabled="step === 1 || loading" @click="step -= 1">
          Precedent
        </button>

        <button v-if="step < 3" type="button" class="rounded-[12px] bg-[#E8873A] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50" :disabled="!canContinue || loading" @click="step += 1">
          Suivant
        </button>

        <button v-else type="button" class="rounded-[12px] bg-[#E8873A] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50" :disabled="loading" @click="submit">
          {{ loading ? 'Creation...' : 'Acceder au Studio' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, reactive, ref } from 'vue'

const router = useRouter()

const step = ref(1)
const loading = ref(false)
const generatingRef = ref(false)

const addFaceRef = ref(false)
const fileError = ref('')
const generateError = ref('')
const submitError = ref('')

const form = reactive({
  name: '',
  niche: '',
  style: '',
})

const sourcePreviewUrl = ref('')
const sourceImageBase64 = ref('')
const generatedImageBase64 = ref('')
const generatedTempImagePath = ref('')

const canContinue = computed(() => {
  if (step.value === 1) {
    return Boolean(form.name.trim() && form.niche.trim() && form.style.trim())
  }
  if (step.value === 2 && addFaceRef.value) {
    return Boolean(generatedTempImagePath.value)
  }
  return true
})

const generatedImageDataUrl = computed(() => {
  if (!generatedImageBase64.value) return ''
  if (generatedImageBase64.value.startsWith('data:image/')) return generatedImageBase64.value
  return `data:image/jpeg;base64,${generatedImageBase64.value}`
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

async function onFileSelect(event) {
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
        customPrompt: 'Create a professional face reference sheet from this source image. Keep exact face consistency, realistic skin texture, neutral expression, white background, vertical composition with multiple portrait angles.',
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
    const created = await $fetch('/api/influencers', {
      method: 'POST',
      body: {
        name: form.name.trim(),
        niche: form.niche.trim(),
        style: form.style.trim(),
      },
    })

    if (addFaceRef.value && generatedTempImagePath.value) {
      await $fetch('/api/upload/face-ref', {
        method: 'POST',
        body: {
          influencerId: created.id,
          tempImagePath: generatedTempImagePath.value,
        },
      })
    }

    await router.push('/studio')
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
