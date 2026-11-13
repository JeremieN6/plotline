<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center px-4 py-6 font-ui">
      <button type="button" class="absolute inset-0 bg-ui-ink/40" aria-label="Fermer" :disabled="busy" @click="close" />

      <div
        role="dialog"
        aria-modal="true"
        :aria-labelledby="`${uid}-title`"
        class="relative flex max-h-full w-full max-w-2xl flex-col rounded-ui-card border border-ui-line bg-ui-surface shadow-lg"
        @keydown.esc.stop.prevent="close"
      >
        <div class="shrink-0 p-6 pb-3">
          <h2 :id="`${uid}-title`" class="text-lg font-semibold text-ui-ink">Importer des contenus</h2>
          <p class="mt-1 text-sm text-ui-ink-2">
            Des vidéos ou images déjà faites ailleurs. Elles arrivent « Validées » dans {{ profileName || 'tes créations' }},
            sans publication automatique. La date et les réseaux sont facultatifs.
          </p>
        </div>

        <div class="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 pb-2">
          <UiAlert v-if="usageError">{{ usageError }}</UiAlert>
          <p v-else-if="usage" class="text-xs text-ui-ink-muted">
            Stockage : {{ formatMegabytes(usage.usedBytes) }} utilisés sur {{ formatMegabytes(usage.budgetBytes) }} de budget
            · {{ formatMegabytes(usage.remainingBytes) }} disponibles pour cet import.
          </p>

          <div>
            <input
              :id="`${uid}-files`"
              ref="fileInput"
              type="file"
              multiple
              :accept="IMPORT_ACCEPT"
              class="sr-only"
              :disabled="busy"
              @change="onPick"
            >
            <label
              :for="`${uid}-files`"
              class="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-ui-card border border-dashed border-ui-line-input bg-ui-subtle px-4 py-6 text-center text-sm text-ui-ink-2 transition-colors hover:bg-ui-bg focus-within:ring-[3px] focus-within:ring-ui-accent/20"
              :class="busy ? 'pointer-events-none opacity-60' : ''"
            >
              <span class="font-semibold text-ui-ink">Choisir des fichiers</span>
              <span class="text-xs text-ui-ink-muted">
                MP4, MOV, WebM, JPG, PNG, WebP · vidéo {{ Math.round(IMPORT_MAX_VIDEO_BYTES / 1048576) }} Mo max, image {{ Math.round(IMPORT_MAX_IMAGE_BYTES / 1048576) }} Mo max · {{ IMPORT_MAX_FILES_PER_BATCH }} fichiers par import
              </span>
            </label>
          </div>

          <ul v-if="rows.length" class="space-y-3">
            <li v-for="row in rows" :key="row.key" class="rounded-ui-card border border-ui-line p-3">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <p class="truncate text-sm font-semibold text-ui-ink">{{ row.file.name }}</p>
                  <p class="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-ui-ink-muted">
                    <UiBadge v-if="!row.problem" :type="row.kind === 'video' ? 'reel' : 'feed'" />
                    <span>{{ formatMegabytes(row.file.size) }}</span>
                    <span v-if="row.state === 'done'" class="font-semibold text-ui-success-ink">Envoyé</span>
                  </p>
                </div>
                <UiIconButton v-if="!busy" label="Retirer ce fichier" @click="remove(row.key)">
                  <span aria-hidden="true">×</span>
                </UiIconButton>
              </div>

              <UiAlert v-if="row.problem" class="mt-2">{{ row.problem }}</UiAlert>

              <template v-else>
                <div class="mt-3 grid gap-3 sm:grid-cols-2">
                  <UiField label="Légende" :for-id="`${row.key}-caption`">
                    <UiInput :id="`${row.key}-caption`" v-model="row.caption" placeholder="Facultatif" :disabled="busy" />
                  </UiField>
                  <UiField label="Date prévue" :for-id="`${row.key}-date`">
                    <UiInput :id="`${row.key}-date`" v-model="row.date" type="datetime-local" :disabled="busy" />
                  </UiField>
                </div>
                <UiProgress v-if="row.state === 'uploading'" class="mt-3" :value="row.progress" label="Envoi en cours" />
              </template>
            </li>
          </ul>

          <UiField v-if="rows.length" label="Réseaux prévus" hint="Un repère de calendrier pour tous les fichiers de cet import (aucune publication automatique).">
            <UiToggleChips v-model="platforms" :options="MANUAL_PLATFORMS" label="Réseaux" />
          </UiField>

          <UiAlert v-if="overBudget">Il n'y a plus assez de place sur le stockage pour ces fichiers. Retire-en ou importe-les en plusieurs fois.</UiAlert>
          <UiAlert v-if="problem">{{ problem }}</UiAlert>
        </div>

        <div class="flex shrink-0 flex-wrap items-center justify-between gap-2 p-6 pt-4">
          <p class="text-xs text-ui-ink-muted">
            <template v-if="readyRows.length">{{ readyRows.length }} fichier{{ readyRows.length > 1 ? 's' : '' }} · {{ formatMegabytes(totalBytes) }}</template>
          </p>
          <div class="flex gap-2">
            <UiButton :disabled="busy" @click="close">Annuler</UiButton>
            <UiButton variant="primary" :loading="busy" :disabled="!canImport" @click="startImport">
              Importer{{ readyRows.length ? ` (${readyRows.length})` : '' }}
            </UiButton>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, ref, useId, watch } from 'vue'
import { upload } from '@vercel/blob/client'
import { MANUAL_PLATFORMS } from '~/utils/manualPlatforms'
import {
  IMPORT_ACCEPT,
  IMPORT_MAX_FILES_PER_BATCH,
  IMPORT_MAX_IMAGE_BYTES,
  IMPORT_MAX_VIDEO_BYTES,
  IMPORT_VIDEO_TYPES,
  formatMegabytes,
  importFileProblem,
} from '~/utils/contentImportLimits'

// Fenetre « Importer » : les fichiers partent DIRECTEMENT du navigateur vers le stockage (jeton delivre par le serveur),
// puis les contenus sont crees en un seul appel. Valide par defaut, jamais de publication automatique.
const props = defineProps({
  open: { type: Boolean, default: false },
  profileId: { type: String, default: '' },
  profileName: { type: String, default: '' },
})
const emit = defineEmits(['close', 'imported'])

const uid = useId()
const fileInput = ref(null)
const rows = ref([])
const platforms = ref([])
const usage = ref(null)
const usageError = ref('')
const problem = ref('')
const busy = ref(false)
let counter = 0

const readyRows = computed(() => rows.value.filter((row) => !row.problem))
const totalBytes = computed(() => readyRows.value.filter((row) => row.state !== 'done').reduce((sum, row) => sum + row.file.size, 0))
const overBudget = computed(() => Boolean(usage.value) && totalBytes.value > usage.value.remainingBytes)
const canImport = computed(() => !busy.value && readyRows.value.length > 0 && !overBudget.value && !usageError.value && Boolean(usage.value?.prefix))

watch(() => props.open, async (value) => {
  if (!value) return
  rows.value = []
  platforms.value = []
  problem.value = ''
  usage.value = null
  usageError.value = ''
  try {
    usage.value = await $fetch('/api/content/import-usage')
  } catch (err) {
    usageError.value = err?.data?.statusMessage || err?.statusMessage || 'Lecture du stockage impossible.'
  }
})

function onPick(event) {
  const picked = Array.from(event.target.files || [])
  event.target.value = ''
  problem.value = ''
  for (const file of picked) {
    if (rows.value.length >= IMPORT_MAX_FILES_PER_BATCH) {
      problem.value = `${IMPORT_MAX_FILES_PER_BATCH} fichiers au maximum par import.`
      break
    }
    counter += 1
    rows.value.push({
      key: `${uid}-row-${counter}`,
      file,
      kind: IMPORT_VIDEO_TYPES.includes(file.type) ? 'video' : 'image',
      problem: importFileProblem(file),
      caption: '',
      date: '',
      state: 'ready', // ready | uploading | done | error
      progress: 0,
      url: '',
    })
  }
}

function remove(key) {
  rows.value = rows.value.filter((row) => row.key !== key)
}

function close() {
  if (busy.value) return
  emit('close')
}

function safeName(name) {
  const base = String(name || 'fichier').split(/[\\/]/).pop()
  return base.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(-80) || 'fichier'
}

async function uploadRow(row) {
  row.state = 'uploading'
  row.progress = 0
  try {
    const blob = await upload(`${usage.value.prefix}${safeName(row.file.name)}`, row.file, {
      access: 'public',
      handleUploadUrl: '/api/content/import-upload',
      clientPayload: JSON.stringify({ contentType: row.file.type, size: row.file.size }),
      multipart: row.file.size > 50 * 1024 * 1024,
      onUploadProgress: ({ percentage }) => { row.progress = Math.round(percentage) },
    })
    row.url = blob.url
    row.state = 'done'
  } catch (err) {
    row.state = 'error'
    row.problem = err?.message || 'Envoi impossible.'
  }
}

async function startImport() {
  problem.value = ''
  busy.value = true
  try {
    // Un fichier deja envoye (nouvelle tentative apres un echec) n est jamais renvoye.
    for (const row of readyRows.value) {
      if (row.state !== 'done') await uploadRow(row)
    }

    const sent = rows.value.filter((row) => row.state === 'done' && row.url)
    if (!sent.length) {
      problem.value = 'Aucun fichier n’a pu être envoyé.'
      return
    }

    const response = await $fetch('/api/content/import', {
      method: 'POST',
      body: {
        profileId: props.profileId || undefined,
        items: sent.map((row) => ({
          url: row.url,
          caption: row.caption,
          scheduledAt: row.date ? new Date(row.date).toISOString() : '',
          platforms: [...platforms.value],
        })),
      },
    })

    rows.value = rows.value.filter((row) => !sent.includes(row))
    emit('imported', response.count || sent.length)
    if (!rows.value.length) {
      emit('close')
    } else {
      problem.value = `${sent.length} contenu${sent.length > 1 ? 's' : ''} importé${sent.length > 1 ? 's' : ''}. Les fichiers restants n’ont pas pu être envoyés : corrige-les ou retire-les.`
    }
  } catch (err) {
    problem.value = err?.data?.statusMessage || err?.statusMessage || 'Import impossible. Les fichiers déjà envoyés ne seront pas renvoyés si tu réessaies.'
  } finally {
    busy.value = false
  }
}
</script>
