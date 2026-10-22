<template>
  <div class="font-ui">
    <label :for="inputId" class="text-[13px] font-semibold text-ui-ink">Fichiers de référence (optionnel)</label>
    <p class="mt-0.5 text-xs text-ui-ink-muted">
      Images, PDF ou textes que Claude lit pour écrire le prompt : moodboard, produit, charte, brief.
      {{ limits.maxFiles }} fichiers au maximum, {{ sizeLabel(limits.maxImageBytes) }} par image, {{ sizeLabel(limits.maxPdfBytes) }} par PDF.
    </p>

    <input
      :id="inputId"
      ref="inputRef"
      type="file"
      multiple
      accept="image/*,application/pdf,.pdf,.txt,.md,text/plain,text/markdown"
      class="mt-2 block w-full text-sm text-ui-ink-2 file:mr-3 file:h-10 file:cursor-pointer file:rounded-ui-ctl file:border file:border-ui-line-input file:bg-ui-surface file:px-4 file:text-sm file:font-semibold file:text-ui-ink hover:file:bg-ui-subtle"
      :disabled="disabled || busy || modelValue.length >= limits.maxFiles"
      @change="onPick"
    >

    <p v-if="busy" class="mt-2 text-xs text-ui-ink-muted">Préparation des fichiers…</p>
    <p v-if="errorMessage" class="mt-2 text-xs text-ui-danger-ink" role="alert">{{ errorMessage }}</p>

    <ul v-if="modelValue.length" class="mt-3 space-y-2">
      <li
        v-for="file in modelValue"
        :key="file.id"
        class="flex items-center gap-3 rounded-ui-ctl border border-ui-line bg-ui-surface p-2"
      >
        <img v-if="file.previewUrl" :src="file.previewUrl" alt="" class="h-12 w-12 shrink-0 rounded-ui-tag object-cover">
        <span v-else class="flex h-12 w-12 shrink-0 items-center justify-center rounded-ui-tag bg-ui-subtle font-ui-mono text-xs font-medium text-ui-ink-2">{{ kindLabel(file.kind) }}</span>
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-semibold text-ui-ink">{{ file.name }}</p>
          <p class="text-xs text-ui-ink-muted">{{ formatAttachmentSize(file.size) }}</p>
        </div>
        <UiButton variant="ghost" size="sm" :disabled="disabled" @click="remove(file.id)">Retirer</UiButton>
      </li>
    </ul>

    <p v-if="modelValue.length" class="mt-2 font-ui-mono text-xs font-medium text-ui-ink-muted">
      {{ modelValue.length }}/{{ limits.maxFiles }} fichiers · {{ formatAttachmentSize(totalBytes) }} / {{ sizeLabel(limits.maxTotalBytes) }}
    </p>
  </div>
</template>

<script setup>
const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  disabled: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue'])

const limits = PROMPT_ATTACHMENT_LIMITS
const inputId = `attachments-${useId()}`
const inputRef = ref(null)
const busy = ref(false)
const errorMessage = ref('')

const totalBytes = computed(() => props.modelValue.reduce((sum, file) => sum + file.size, 0))
const sizeLabel = (bytes) => formatAttachmentSize(bytes)
const kindLabel = (kind) => (kind === 'pdf' ? 'PDF' : 'TXT')

let counter = 0

function readAsDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('lecture impossible'))
    reader.readAsDataURL(blob)
  })
}

// Image reduite (cote le plus long limite) et recompressee en JPEG : une photo de telephone
// de 6 Mo tient en quelques centaines de Ko, sans rien changer a ce que Claude y voit.
async function compressImage(file, name) {
  let bitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new Error(`« ${name} » n'est pas une image lisible.`)
  }

  const scale = Math.min(1, limits.imageMaxSide / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  const context = canvas.getContext('2d')
  context.fillStyle = '#ffffff' // ui-kit-ignore : fond blanc technique de l'image envoyée (JPEG sans transparence), pas un style
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close?.()

  for (const quality of [0.85, 0.7, 0.55]) {
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
    if (blob && blob.size <= limits.maxImageBytes) {
      const dataUrl = await readAsDataUrl(blob)
      return { size: blob.size, data: dataUrl.split(',')[1] || '', previewUrl: dataUrl }
    }
  }
  throw new Error(`« ${name} » reste trop lourde même réduite (${sizeLabel(limits.maxImageBytes)} maximum).`)
}

async function prepare(file) {
  const name = file.name || 'fichier'
  const lower = name.toLowerCase()
  if (file.size > limits.maxRawBytes) throw new Error(`« ${name} » est trop volumineux (${sizeLabel(limits.maxRawBytes)} maximum avant réduction).`)

  if (file.type.startsWith('image/')) {
    return { name, kind: 'image', ...(await compressImage(file, name)) }
  }

  if (file.type === 'application/pdf' || lower.endsWith('.pdf')) {
    if (file.size > limits.maxPdfBytes) throw new Error(`« ${name} » est trop lourd (${sizeLabel(limits.maxPdfBytes)} maximum par PDF).`)
    const dataUrl = await readAsDataUrl(file)
    return { name, kind: 'pdf', size: file.size, data: dataUrl.split(',')[1] || '', previewUrl: '' }
  }

  if (file.type.startsWith('text/') || lower.endsWith('.txt') || lower.endsWith('.md')) {
    const text = await file.text()
    if (text.length > limits.maxTextChars) throw new Error(`« ${name} » est trop long (${limits.maxTextChars.toLocaleString('fr-FR')} caractères maximum).`)
    const blob = new Blob([text], { type: 'text/plain' })
    const dataUrl = await readAsDataUrl(blob)
    return { name, kind: 'text', size: blob.size, data: dataUrl.split(',')[1] || '', previewUrl: '' }
  }

  throw new Error(`« ${name} » n'est pas un format accepté (image, PDF, .txt ou .md).`)
}

async function onPick(event) {
  const picked = Array.from(event.target?.files || [])
  if (inputRef.value) inputRef.value.value = ''
  if (!picked.length) return

  errorMessage.value = ''
  busy.value = true
  const next = [...props.modelValue]
  const problems = []

  for (const file of picked) {
    if (next.length >= limits.maxFiles) {
      problems.push(`${limits.maxFiles} fichiers au maximum : les suivants sont ignorés.`)
      break
    }
    try {
      const prepared = await prepare(file)
      const total = next.reduce((sum, item) => sum + item.size, 0) + prepared.size
      if (total > limits.maxTotalBytes) throw new Error(`« ${prepared.name} » dépasse la taille totale permise (${sizeLabel(limits.maxTotalBytes)}).`)
      counter += 1
      next.push({ id: `att-${Date.now()}-${counter}`, ...prepared })
    } catch (error) {
      problems.push(error?.message || 'Fichier illisible.')
    }
  }

  busy.value = false
  emit('update:modelValue', next)
  errorMessage.value = problems.join(' ')
}

function remove(id) {
  errorMessage.value = ''
  emit('update:modelValue', props.modelValue.filter((file) => file.id !== id))
}
</script>
