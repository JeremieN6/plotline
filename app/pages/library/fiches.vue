<template>
  <div class="space-y-6 font-ui">
    <header>
      <p class="text-xs font-semibold uppercase tracking-[0.08em] text-ui-accent">Bibliothèque</p>
      <h1 class="mt-1 text-2xl font-bold tracking-[-0.01em] text-ui-ink">Fiches générées</h1>
      <p class="mt-2 max-w-3xl text-sm leading-6 text-ui-ink-2">
        Toutes les fiches de référence visage que tu as générées sont conservées ici : tu peux les retrouver, les télécharger,
        ou en appliquer une à une persona. Les fiches générées avant cette galerie n’y sont pas : importe-les avec le champ ci-dessous.
      </p>
      <div class="mt-4"><LibraryTabs /></div>
    </header>

    <UiCard>
      <div class="flex flex-wrap items-end gap-4">
        <UiField label="Filtrer par persona" for-id="sheets-filter" class="min-w-[240px]">
          <UiSelect id="sheets-filter" v-model="filterProfileId" :options="filterOptions" />
        </UiField>
        <UiField label="Importer une fiche" for-id="sheets-import" hint="Gratuit, JPG ou PNG, 10 Mo maximum.">
          <input
            id="sheets-import"
            ref="importInput"
            type="file"
            accept="image/jpeg,image/png"
            class="block w-full text-sm text-ui-ink-2 file:mr-3 file:h-11 file:cursor-pointer file:rounded-ui-ctl file:border file:border-ui-line-input file:bg-ui-surface file:px-4 file:text-sm file:font-semibold file:text-ui-ink hover:file:bg-ui-subtle"
            :disabled="importing"
            @change="onImport"
          >
        </UiField>
        <p v-if="importing" class="pb-3 text-sm text-ui-ink-muted">Import en cours…</p>
      </div>
    </UiCard>

    <UiAlert v-if="loadError" title="Les fiches n’ont pas pu être chargées">
      {{ loadError }}
      <template #action><UiButton variant="secondary" size="sm" @click="refresh">Réessayer</UiButton></template>
    </UiAlert>

    <UiEmptyState
      v-else-if="!sheets.length"
      title="Aucune fiche pour l’instant"
      text="Les prochaines fiches que tu génères apparaîtront ici automatiquement."
    />

    <div v-else class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <article
        v-for="sheet in sheets"
        :key="sheet.id"
        class="overflow-hidden rounded-ui-card border border-ui-line bg-ui-surface"
      >
        <button type="button" class="block w-full bg-ui-subtle focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ui-accent/20" :aria-label="`Agrandir la fiche du ${formatDate(sheet.createdAt)}`" @click="preview = sheet">
          <img :src="sheet.imageUrl" :alt="`Fiche du ${formatDate(sheet.createdAt)}`" class="aspect-[3/4] w-full object-cover" loading="lazy">
        </button>
        <div class="space-y-3 p-4">
          <div>
            <p class="text-[15px] font-semibold text-ui-ink">{{ sheet.profileName || 'Sans persona' }}</p>
            <p class="text-xs text-ui-ink-muted">{{ sheet.methodLabel }} · {{ formatDate(sheet.createdAt) }}</p>
          </div>

          <div class="flex flex-wrap gap-2">
            <a
              :href="`/api/face-ref-sheets/${sheet.id}/download`"
              class="inline-flex h-10 items-center justify-center rounded-ui-ctl border border-ui-line-input bg-ui-surface px-4 text-sm font-semibold text-ui-ink transition-colors hover:bg-ui-subtle focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ui-accent/20"
            >Télécharger</a>
            <UiButton variant="danger" size="sm" :disabled="busyId === sheet.id" @click="removeSheet(sheet)">Supprimer</UiButton>
          </div>

          <div class="flex items-center gap-2 border-t border-ui-line-soft pt-3">
            <UiSelect v-model="targets[sheet.id]" class="min-w-0 flex-1" :options="targetOptions" :aria-label="`Persona à qui appliquer la fiche du ${formatDate(sheet.createdAt)}`" />
            <UiButton variant="primary" size="sm" :loading="busyId === sheet.id" :disabled="!targets[sheet.id] || busyId === sheet.id" @click="applySheet(sheet)">Utiliser</UiButton>
          </div>
        </div>
      </article>
    </div>

    <div
      v-if="preview"
      class="fixed inset-0 z-50 flex items-center justify-center bg-ui-ink/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Fiche de référence agrandie"
      @click.self="preview = null"
      @keydown.esc="preview = null"
    >
      <div class="max-h-full max-w-3xl overflow-auto rounded-ui-card bg-ui-surface p-2">
        <img :src="preview.imageUrl" alt="Fiche de référence" class="max-h-[80vh] w-auto rounded-ui-ctl">
        <div class="flex justify-end p-2">
          <UiButton variant="secondary" size="sm" @click="preview = null">Fermer</UiButton>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
useSeoMeta({ title: 'Fiches générées' })

const { pushToast, requestConfirmation } = useUiFeedback()

const filterProfileId = ref('')
const preview = ref(null)
const busyId = ref('')
const importing = ref(false)
const importInput = ref(null)
const targets = reactive({})

// Rendu serveur : useFetch transmet le cookie de session (un $fetch brut non).
const { data, error, refresh } = await useFetch('/api/face-ref-sheets', {
  key: 'face-ref-sheets',
  query: computed(() => (filterProfileId.value ? { profileId: filterProfileId.value } : {})),
  watch: [filterProfileId],
})
const { data: profilesData } = await useFetch('/api/profiles', { key: 'face-ref-sheets-profiles' })

const sheets = computed(() => data.value?.sheets || [])
const personas = computed(() => (Array.isArray(profilesData.value) ? profilesData.value : []).filter((profile) => profile.profileType === 'PERSONA'))
const filterOptions = computed(() => [{ value: '', label: 'Toutes les fiches' }, ...personas.value.map((profile) => ({ value: profile.id, label: profile.name }))])
const targetOptions = computed(() => [{ value: '', label: 'Appliquer à une persona…' }, ...personas.value.map((profile) => ({ value: profile.id, label: profile.name }))])
const loadError = computed(() => {
  if (!error.value) return ''
  return error.value?.statusCode === 503
    ? 'La galerie n’est pas encore activée sur ce serveur.'
    : 'Vérifie ta connexion puis réessaie.'
})

function formatDate(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

function messageOf(err, fallback) {
  return err?.data?.statusMessage || err?.statusMessage || err?.message || fallback
}

async function removeSheet(sheet) {
  const confirmed = await requestConfirmation({
    title: 'Supprimer cette fiche ?',
    message: 'Elle sera définitivement supprimée de la galerie. Si tu l’avais déjà appliquée à une persona, celle-ci la garde.',
    confirmLabel: 'Supprimer définitivement',
    cancelLabel: 'Annuler',
    tone: 'danger',
  })
  if (!confirmed) return

  busyId.value = sheet.id
  try {
    await $fetch(`/api/face-ref-sheets/${sheet.id}`, { method: 'DELETE' })
    pushToast({ title: 'Fiche supprimée', message: '', tone: 'success' })
    await refresh()
  } catch (err) {
    pushToast({ title: 'Suppression impossible', message: messageOf(err, 'Erreur inconnue'), tone: 'error', duration: 6000 })
  } finally {
    busyId.value = ''
  }
}

async function applySheet(sheet) {
  const profile = personas.value.find((item) => item.id === targets[sheet.id])
  if (!profile) return

  const confirmed = await requestConfirmation({
    title: `Utiliser cette fiche pour ${profile.name} ?`,
    message: 'Elle remplacera la fiche de référence visage actuelle de cette persona. Les prochains contenus générés s’appuieront sur elle.',
    confirmLabel: 'Remplacer la fiche',
    cancelLabel: 'Annuler',
  })
  if (!confirmed) return

  busyId.value = sheet.id
  try {
    const prepared = await $fetch(`/api/face-ref-sheets/${sheet.id}/prepare`, { method: 'POST' })
    await $fetch('/api/upload/face-ref', {
      method: 'POST',
      body: { influencerId: profile.id, tempImagePath: prepared.tempImagePath },
    })
    pushToast({ title: 'Fiche appliquée', message: profile.name, tone: 'success' })
  } catch (err) {
    pushToast({ title: 'Application impossible', message: messageOf(err, 'Erreur inconnue'), tone: 'error', duration: 6000 })
  } finally {
    busyId.value = ''
  }
}

async function onImport(event) {
  const file = event.target?.files?.[0]
  if (!file) return

  importing.value = true
  try {
    const form = new FormData()
    form.append('file', file)
    if (filterProfileId.value) form.append('profileId', filterProfileId.value)
    await $fetch('/api/face-ref-sheets', { method: 'POST', body: form })
    pushToast({ title: 'Fiche importée', message: file.name, tone: 'success' })
    await refresh()
  } catch (err) {
    pushToast({ title: 'Import impossible', message: messageOf(err, 'Erreur inconnue'), tone: 'error', duration: 6000 })
  } finally {
    importing.value = false
    if (importInput.value) importInput.value.value = ''
  }
}
</script>
