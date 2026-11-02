<template>
  <div class="space-y-3 rounded-ui-ctl border border-ui-line-soft bg-ui-subtle p-3 font-ui">
    <div>
      <p class="text-xs font-semibold text-ui-ink">Image affichée dans l’écran</p>
      <p class="mt-0.5 text-xs text-ui-ink-muted">
        Choisis une image du dossier de la persona, ou importes-en une (PNG ou JPG, 8 Mo maximum). Elle reste ensuite dans le dossier, gratuitement.
      </p>
    </div>

    <p v-if="!profileId" class="text-xs text-ui-ink-muted">Choisis d’abord une persona : ses images sont rangées dans son dossier.</p>

    <template v-else>
      <ul v-if="illustrations.length" class="grid grid-cols-3 gap-2 sm:grid-cols-4" role="listbox" :aria-label="`Images de la scène ${sceneIndex + 1}`">
        <li v-for="item in illustrations" :key="item.id">
          <button
            type="button"
            role="option"
            :aria-selected="modelValue === item.id ? 'true' : 'false'"
            :title="item.label"
            class="group block w-full overflow-hidden rounded-ui-ctl border bg-ui-surface text-left transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ui-accent/20"
            :class="modelValue === item.id ? 'border-ui-accent ring-2 ring-ui-accent/30' : 'border-ui-line hover:border-ui-line-input'"
            @click="emit('update:modelValue', modelValue === item.id ? '' : item.id)"
          >
            <img :src="item.url" alt="" class="aspect-[4/5] w-full object-cover">
            <span class="block truncate px-2 py-1 text-[11px] text-ui-ink-2">{{ item.label }}</span>
          </button>
        </li>
      </ul>
      <p v-else class="text-xs text-ui-ink-muted">Le dossier ne contient encore aucune image.</p>

      <div class="grid gap-2 sm:grid-cols-2">
        <UiField label="Importer une image" :for-id="inputId">
          <input
            :id="inputId"
            ref="inputRef"
            type="file"
            accept="image/png,image/jpeg"
            class="block w-full text-sm text-ui-ink-2 file:mr-3 file:h-10 file:cursor-pointer file:rounded-ui-ctl file:border file:border-ui-line-input file:bg-ui-surface file:px-4 file:text-sm file:font-semibold file:text-ui-ink hover:file:bg-ui-subtle"
            :disabled="busy"
            @change="onPick"
          >
        </UiField>
        <UiField label="Type" :for-id="`${inputId}-kind`" hint="Aide Claude à retrouver l’image.">
          <UiSelect :id="`${inputId}-kind`" v-model="kind" :options="KIND_OPTIONS" />
        </UiField>
      </div>
      <UiField label="Nom de l’image" :for-id="`${inputId}-label`" hint="Ex. « Landing page de Stellara » : c’est ce nom que Claude lit.">
        <UiInput :id="`${inputId}-label`" v-model="label" maxlength="80" placeholder="Nom (facultatif : le nom du fichier sinon)" />
      </UiField>
      <p v-if="busy" class="text-xs text-ui-ink-muted">Import en cours…</p>
      <p v-if="errorMessage" class="text-xs text-ui-danger-ink" role="alert">{{ errorMessage }}</p>
    </template>
  </div>
</template>

<script setup>
// Sélecteur d'image d'une scène « Photo » : les images du dossier de la persona, plus l'import à la volée
// (POST /api/faceless/illustrations/:profileId, mode upload : gratuit, type et poids vérifiés côté serveur).
const props = defineProps({
  modelValue: { type: String, default: '' },
  profileId: { type: String, default: '' },
  illustrations: { type: Array, default: () => [] },
  sceneIndex: { type: Number, default: 0 },
})
const emit = defineEmits(['update:modelValue', 'imported'])

const MAX_BYTES = 8 * 1024 * 1024
const KIND_OPTIONS = [
  { value: 'mockup', label: 'Capture ou maquette d’écran' },
  { value: 'photo', label: 'Photo' },
  { value: 'illustration', label: 'Illustration' },
]

const inputId = `plan-image-${useId()}`
const inputRef = ref(null)
const kind = ref('mockup')
const label = ref('')
const busy = ref(false)
const errorMessage = ref('')

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Lecture du fichier impossible'))
    reader.readAsDataURL(file)
  })
}

async function onPick(event) {
  const file = event.target?.files?.[0]
  if (!file) return
  errorMessage.value = ''
  if (!/^image\/(png|jpeg)$/.test(file.type)) {
    errorMessage.value = 'Le fichier doit être un PNG ou un JPG.'
    event.target.value = ''
    return
  }
  if (file.size > MAX_BYTES) {
    errorMessage.value = 'Image trop lourde (8 Mo maximum).'
    event.target.value = ''
    return
  }
  busy.value = true
  try {
    const imageBase64 = await readAsDataUrl(file)
    const name = label.value.trim() || file.name.replace(/\.[^.]+$/, '').slice(0, 80)
    const result = await $fetch(`/api/faceless/illustrations/${props.profileId}`, {
      method: 'POST',
      body: { mode: 'upload', imageBase64, kind: kind.value, label: name },
    })
    emit('imported', result.illustration)
    emit('update:modelValue', result.illustration.id)
    label.value = ''
  } catch (error) {
    errorMessage.value = error?.data?.statusMessage || error?.statusMessage || error?.message || 'Import impossible.'
  } finally {
    busy.value = false
    if (inputRef.value) inputRef.value.value = ''
  }
}
</script>
