<template>
  <div class="space-y-6 font-ui">
    <header class="rounded-ui-card border border-ui-line bg-ui-surface p-5">
      <NuxtLink to="/library/personas" class="text-xs font-semibold text-ui-accent hover:underline">← Dossiers personas</NuxtLink>
      <p class="mt-3 text-xs font-semibold uppercase tracking-[0.22em] text-ui-accent">Dossier faceless</p>
      <h1 class="mt-2 text-3xl font-bold tracking-tight text-ui-ink">{{ folder?.profile?.name || 'Dossier' }}</h1>
      <div v-if="folder" class="mt-4 flex flex-wrap gap-2">
        <NuxtLink
          :to="`/studio/faceless?profile=${profileId}`"
          class="inline-flex h-11 items-center rounded-ui-ctl bg-ui-accent px-4 text-sm font-semibold text-white transition-colors hover:bg-ui-accent-hover"
        >
          Créer une vidéo faceless
        </NuxtLink>
        <NuxtLink
          :to="`/studio/faceless/style?profile=${profileId}`"
          class="inline-flex h-11 items-center rounded-ui-ctl border border-ui-line-input bg-ui-surface px-4 text-sm font-semibold text-ui-ink transition-colors hover:bg-ui-subtle"
        >
          Modifier la DA
        </NuxtLink>
      </div>
    </header>

    <UiAlert v-if="loadError" title="Dossier introuvable">Vérifie l’adresse ou reviens à la liste des dossiers.</UiAlert>

    <template v-if="folder">
      <!-- 1. DA -->
      <UiCard>
        <template #title>Direction artistique</template>
        <p v-if="!folder.stored" class="text-xs text-ui-ink-muted">DA par défaut : « Modifier la DA » pour la personnaliser (ou la faire composer par Claude).</p>
        <div class="mt-3 flex flex-wrap items-center gap-2">
          <span class="text-sm font-semibold text-ui-ink">{{ folder.style.name }}</span>
          <span
            v-for="color in palette"
            :key="color.key"
            class="h-5 w-5 rounded-full border border-ui-line"
            :style="{ backgroundColor: color.value }"
            :title="color.key"
          />
        </div>
        <p class="mt-2 text-xs text-ui-ink-2">
          Police {{ folder.style.font }} · cartes « {{ folder.style.card }} » · fond « {{ folder.style.background }} » · mouvement
          {{ folder.style.motion === 'stopmotion' ? 'stop motion' : 'fluide' }} · sous-titres
          {{ folder.style.captions.enabled ? (folder.style.captions.position === 'top' ? 'en haut' : 'en bas') : 'désactivés' }}
        </p>
        <p class="mt-1 text-xs text-ui-ink-2">Voix par défaut : {{ folder.style.voiceLabel || 'standard' }}</p>
        <pre v-if="folder.style.rules" class="mt-3 whitespace-pre-wrap rounded-ui-ctl bg-ui-subtle p-3 text-xs text-ui-ink-2">{{ folder.style.rules }}</pre>
      </UiCard>

      <!-- 2. Avatar -->
      <UiCard>
        <template #title>
          Avatar
          <span class="ml-2 rounded-full bg-ui-accent-soft px-2 py-0.5 text-[11px] font-semibold text-ui-accent-ink">images payantes</span>
        </template>
        <p class="text-xs text-ui-ink-2">
          Des images de ton personnage (expressions, gestes, tête seule ou buste), générées une fois à partir d’une image de base,
          puis réutilisées dans toutes ses vidéos. Chaque génération demande ta confirmation, avec le coût du modèle choisi.
          Le choix « avatar dessiné » ou « pack d’images » se fait dans la DA.
        </p>

        <div class="mt-4 space-y-4">
          <UiField label="Modèle d’image" for-id="avatar-model" :hint="`${currentModel?.note || ''} · tarifs indicatifs, à vérifier sur la console Google.`">
            <UiSelect id="avatar-model" v-model="imageModel" :options="modelOptions" />
          </UiField>

          <UiField
            label="Rendu de l’avatar"
            :hint="faithful
              ? 'L’image de base reproduit ta fiche de référence : même visage, mêmes cheveux, en photo réaliste. Les poses du pack gardent ce rendu.'
              : 'L’image de base est dessinée dans le style décrit ci-dessous.'"
          >
            <UiSegmented v-model="avatarRender" label="Rendu de l’avatar" :options="renderOptions" />
          </UiField>

          <UiField
            v-if="!faithful"
            label="Style graphique de l’avatar"
            for-id="avatar-style"
            hint="Seulement la manière dont l’image est dessinée (pas qui est le personnage). Rempli automatiquement quand tu importes une image ; modifiable."
          >
            <UiTextarea
              id="avatar-style"
              v-model="avatarPrompt"
              :rows="3"
              :maxlength="400"
              placeholder="Ex. : rendu 3D de film d’animation, grands yeux expressifs, peau lisse, éclairage doux, sans contour."
            />
          </UiField>
          <UiButton v-if="!faithful" size="sm" :disabled="!pack.baseUrl || busy" @click="describeStyle">
            Décrire le style à partir de l’image de base (≈ 0,01 $)
          </UiButton>
        </div>

        <div class="mt-5 flex flex-wrap items-start gap-4">
          <div class="h-40 w-40 shrink-0 overflow-hidden rounded-ui-card border border-ui-line bg-ui-subtle">
            <img v-if="pack.baseUrl" :src="pack.baseUrl" alt="Image de base" class="h-full w-full object-contain">
            <p v-else class="flex h-full items-center justify-center p-3 text-center text-xs text-ui-ink-muted">Pas encore d’image de base</p>
          </div>
          <div class="space-y-2 text-sm">
            <p class="text-xs font-semibold text-ui-ink">Image de base du personnage</p>
            <UiButton :disabled="!folder.profile.hasFaceRef || busy" :loading="busy" @click="generateBase">
              {{ faithful ? 'Générer fidèle à ma fiche' : 'Générer depuis la fiche de référence' }} (≈ {{ currentModel?.costUsd }} $)
            </UiButton>
            <p v-if="!folder.profile.hasFaceRef" class="max-w-xs text-xs text-ui-ink-muted">Cette persona n’a pas de fiche de référence : importe ton image à la place.</p>
            <label class="inline-flex h-11 cursor-pointer items-center rounded-ui-ctl border border-ui-line-input bg-ui-surface px-4 text-sm font-semibold text-ui-ink transition-colors hover:bg-ui-subtle">
              Importer mon image (gratuit, PNG ou JPG)
              <input type="file" accept="image/png,image/jpeg" class="hidden" @change="importBase">
            </label>
            <p class="max-w-xs text-xs text-ui-ink-muted">Pas besoin de fond vert : les images du pack sont générées sur fond vert puis détourées automatiquement.<template v-if="!faithful"> Le style est décrit tout seul à l’import.</template></p>
          </div>
        </div>

        <div v-if="pack.baseUrl" class="mt-6">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <p class="text-xs font-semibold text-ui-ink">Images du pack ({{ readyCount }}/{{ pack.entries.length }}) · {{ selected.length }} sélectionnée(s)</p>
            <div class="flex gap-2">
              <UiButton size="sm" @click="selected = pack.entries.filter((e) => !e.url).map((e) => e.id)">Les manquantes</UiButton>
              <UiButton size="sm" @click="selected = pack.entries.map((e) => e.id)">Toutes</UiButton>
              <UiButton size="sm" @click="selected = []">Aucune</UiButton>
            </div>
          </div>

          <div class="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-7">
            <label
              v-for="entry in pack.entries"
              :key="entry.id"
              class="relative cursor-pointer rounded-ui-ctl border p-2 text-center transition-colors"
              :class="selected.includes(entry.id) ? 'border-ui-accent bg-ui-accent-soft' : 'border-ui-line bg-ui-surface'"
            >
              <input v-model="selected" type="checkbox" :value="entry.id" class="absolute left-2 top-2 h-4 w-4 accent-ui-accent">
              <div class="mx-auto flex h-20 w-full items-center justify-center rounded-ui-tag bg-ui-subtle">
                <img v-if="entry.url" :src="entry.url" :alt="entry.label" class="max-h-20 max-w-full object-contain">
                <span v-else-if="entry.status === 'pending'" class="text-[11px] text-ui-accent-ink">…</span>
                <span v-else class="text-lg text-ui-ink-muted">{{ entry.mode === 'head' ? '◔' : '▮' }}</span>
              </div>
              <p class="mt-1 text-[11px] font-semibold leading-tight text-ui-ink">{{ entry.label }}</p>
              <p class="text-[10px] text-ui-ink-muted">{{ entry.mode === 'head' ? 'tête' : 'buste' }}<template v-if="entry.status === 'pending'"> · en cours</template></p>
              <p v-if="entry.status === 'failed'" class="text-[10px] text-ui-danger-ink" :title="entry.error">échec</p>
            </label>
          </div>

          <div class="mt-4 flex flex-wrap items-center gap-3">
            <UiButton variant="dark" :disabled="!selected.length || pack.generating || busy" :loading="pack.generating" @click="generatePack">
              {{ pack.generating ? 'Génération en cours…' : `Générer ${selected.length} image(s) — ≈ ${packCost} $` }}
            </UiButton>
            <p v-if="pack.generating" class="text-xs text-ui-ink-muted">Environ 20 à 40 s par image. Tu peux quitter la page, la génération continue.</p>
          </div>
        </div>
        <p v-if="packMessage" class="mt-3 text-xs" :class="packError ? 'text-ui-danger-ink' : 'text-ui-success-ink'">{{ packMessage }}</p>
      </UiCard>

      <!-- 3. Illustrations -->
      <UiCard>
        <template #title>
          Illustrations
          <span class="ml-2 rounded-full bg-ui-accent-soft px-2 py-0.5 text-[11px] font-semibold text-ui-accent-ink">générées ou importées</span>
        </template>
        <p class="text-xs text-ui-ink-2">
          Des photos, images de stock et maquettes qui illustrent le propos d’une vidéo, présentées en polaroïd ou dans un cadre selon la DA.
          Génère-les une fois (≈ {{ folder.imageCostUsd }} $ chacune) ou importe tes propres photos (gratuit, nettoyées de leurs données EXIF) :
          Claude les réutilise ensuite d’une vidéo à l’autre. Jamais de visage ni de logo dans les images générées.
        </p>

        <div class="mt-4 grid gap-3 sm:grid-cols-[200px_1fr]">
          <UiField label="Type" for-id="ill-kind">
            <UiSelect id="ill-kind" v-model="illKind" :options="kindOptions" />
          </UiField>
          <UiField label="Nom (facultatif)" for-id="ill-label">
            <UiInput id="ill-label" v-model="illLabel" maxlength="80" placeholder="Ex. : Bureau le matin" />
          </UiField>
        </div>
        <UiField class="mt-3" label="Décris l’image à générer" for-id="ill-prompt">
          <UiTextarea id="ill-prompt" v-model="illPrompt" :rows="2" :maxlength="400" placeholder="Ex. : un café et un carnet ouverts sur un bureau en bois, lumière du matin" />
        </UiField>
        <div class="mt-3 flex flex-wrap items-center gap-3">
          <UiButton variant="dark" :disabled="!illPrompt.trim() || busy" @click="generateIllustration">Générer (≈ {{ folder.imageCostUsd }} $)</UiButton>
          <label class="inline-flex h-11 cursor-pointer items-center rounded-ui-ctl border border-ui-line-input bg-ui-surface px-4 text-sm font-semibold text-ui-ink transition-colors hover:bg-ui-subtle">
            Importer une photo (gratuit)
            <input type="file" accept="image/png,image/jpeg" class="hidden" @change="importIllustration">
          </label>
        </div>
        <p v-if="illMessage" class="mt-3 text-xs" :class="illError ? 'text-ui-danger-ink' : 'text-ui-success-ink'">{{ illMessage }}</p>

        <div v-if="folder.illustrations.length" class="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          <figure v-for="item in folder.illustrations" :key="item.id" class="rounded-ui-ctl border border-ui-line bg-ui-surface p-2">
            <img :src="item.url" :alt="item.label" class="aspect-[4/5] w-full rounded-ui-tag object-cover">
            <figcaption class="mt-2 text-[11px] leading-tight">
              <span class="block truncate font-semibold text-ui-ink" :title="item.label">{{ item.label }}</span>
              <span class="text-ui-ink-muted">{{ item.kindLabel }} · {{ item.source === 'upload' ? 'importée' : 'générée' }}</span>
            </figcaption>
            <button type="button" class="mt-1 text-[11px] font-semibold text-ui-danger-ink hover:underline" @click="removeIllustration(item)">Retirer</button>
          </figure>
        </div>
        <p v-else class="mt-5 text-xs text-ui-ink-muted">Aucune illustration pour l’instant.</p>
      </UiCard>

      <!-- 4. Videos -->
      <UiCard>
        <template #title>Vidéos faceless de {{ folder.profile.name }}</template>
        <ul v-if="folder.videos.length" class="divide-y divide-ui-line-soft">
          <li v-for="video in folder.videos" :key="video.id" class="flex items-center justify-between gap-3 py-2.5">
            <div class="min-w-0">
              <p class="truncate text-sm text-ui-ink">{{ firstLine(video.caption) || 'Vidéo faceless' }}</p>
              <p class="text-[11px] text-ui-ink-muted">{{ dateLabel(video.createdAt) }} · {{ statusLabel(video.status) }}</p>
            </div>
            <NuxtLink :to="`/studio/faceless?content=${video.id}`" class="shrink-0 text-xs font-semibold text-ui-accent hover:underline">Ouvrir / retoucher</NuxtLink>
          </li>
        </ul>
        <p v-else class="text-xs text-ui-ink-muted">Pas encore de vidéo faceless pour cette persona.</p>
      </UiCard>
    </template>
  </div>
</template>

<script setup>
useSeoMeta({ title: 'Dossier faceless' })

const route = useRoute()
const { pushToast, requestConfirmation } = useUiFeedback()
const profileId = String(route.params.id || '')

// Rendu serveur: useFetch transmet le cookie de session (un $fetch brut non).
const { data, error: loadError, refresh } = await useFetch(`/api/faceless/folder/${profileId}`, { key: `faceless-folder-${profileId}` })

const folder = computed(() => data.value || null)
const pack = computed(() => folder.value?.pack || { baseUrl: '', generating: false, entries: [] })
const readyCount = computed(() => pack.value.entries.filter((entry) => entry.url).length)
const palette = computed(() => Object.entries(folder.value?.style?.palette || {}).map(([key, value]) => ({ key, value })))

const avatarPrompt = ref(folder.value?.avatarPrompt || '')
// « stylized » = le style ci-dessus ; « faithful » = la meme personne que sa fiche de reference, en photo realiste.
const avatarRender = ref(folder.value?.avatarRender === 'faithful' ? 'faithful' : 'stylized')
const faithful = computed(() => avatarRender.value === 'faithful')
const renderOptions = [
  { value: 'stylized', label: 'Dessiné (style)' },
  { value: 'faithful', label: 'Fidèle à ma fiche (photo)' },
]
const selected = ref((folder.value?.pack?.entries || []).filter((entry) => !entry.url).map((entry) => entry.id))
const busy = ref(false)
const packMessage = ref('')
const packError = ref(false)
const imageModel = ref(folder.value?.defaultImageModel || '')
const currentModel = computed(() => (folder.value?.imageModels || []).find((model) => model.id === imageModel.value) || null)
const modelOptions = computed(() => (folder.value?.imageModels || []).map((model) => ({ value: model.id, label: `${model.label} — ≈ ${model.costUsd} $ par image` })))
const kindOptions = computed(() => (folder.value?.illustrationKinds || []).map((kind) => ({ value: kind.value, label: kind.label })))
const packCost = computed(() => (Math.round(selected.value.length * (currentModel.value?.costUsd || folder.value?.imageCostUsd || 0.134) * 100) / 100).toFixed(2))

const illKind = ref('photo')
const illLabel = ref('')
const illPrompt = ref('')
const illMessage = ref('')
const illError = ref(false)

let pollTimer = null

function stopPolling() {
  if (pollTimer) clearInterval(pollTimer)
  pollTimer = null
}

function startPolling() {
  stopPolling()
  pollTimer = setInterval(async () => {
    try {
      await refresh()
      if (!folder.value?.pack?.generating) {
        stopPolling()
        const failed = pack.value.entries.filter((entry) => entry.status === 'failed').length
        packMessage.value = failed ? `Terminé, ${failed} image(s) en échec : relance-les.` : 'Pack généré.'
        packError.value = failed > 0
      }
    } catch {
      // Erreur transitoire : on reessaie au prochain tour.
    }
  }, 5000)
}

onMounted(() => { if (folder.value?.pack?.generating) startPolling() })
onBeforeUnmount(stopPolling)

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function message(error, fallback) {
  return error?.data?.statusMessage || fallback
}

async function generateBase() {
  const ok = await requestConfirmation({
    title: 'Générer l’image de base ?',
    message: `Un appel payant avec ${currentModel.value?.label} (≈ ${currentModel.value?.costUsd} $).${faithful.value ? ' L’image reproduira ta fiche de référence en photo réaliste.' : ''}`,
    confirmLabel: 'Générer',
  })
  if (!ok) return
  busy.value = true
  packMessage.value = ''
  try {
    await $fetch(`/api/faceless/avatar/${profileId}/base`, { method: 'POST', body: { mode: 'generate', confirmCost: true, avatarPrompt: avatarPrompt.value, avatarRender: avatarRender.value, model: imageModel.value } })
    await refresh()
    packMessage.value = 'Image de base créée.'
    packError.value = false
  } catch (error) {
    packMessage.value = message(error, 'Génération impossible.')
    packError.value = true
  } finally {
    busy.value = false
  }
}

async function importBase(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return
  busy.value = true
  packMessage.value = ''
  try {
    const result = await $fetch(`/api/faceless/avatar/${profileId}/base`, { method: 'POST', body: { mode: 'upload', imageBase64: await readFile(file), avatarPrompt: avatarPrompt.value, avatarRender: avatarRender.value } })
    await refresh()
    if (result?.styleDescribed) avatarPrompt.value = result.avatarPrompt
    packMessage.value = result?.styleDescribed
      ? 'Image de base importée. Style décrit automatiquement : relis-le et corrige-le si besoin.'
      : `Image de base importée, mais le style n’a pas pu être décrit automatiquement (${result?.styleError || 'erreur'}). Utilise le bouton « Décrire le style ».`
    packError.value = !result?.styleDescribed
  } catch (error) {
    packMessage.value = message(error, 'Import impossible.')
    packError.value = true
  } finally {
    busy.value = false
  }
}

async function describeStyle() {
  busy.value = true
  packMessage.value = ''
  try {
    const result = await $fetch(`/api/faceless/avatar/${profileId}/describe-style`, { method: 'POST' })
    avatarPrompt.value = result.avatarPrompt
    await refresh()
    packMessage.value = 'Style décrit à partir de l’image de base : relis-le et corrige-le si besoin.'
    packError.value = false
  } catch (error) {
    packMessage.value = message(error, 'Description impossible.')
    packError.value = true
  } finally {
    busy.value = false
  }
}

async function generatePack() {
  const count = selected.value.length
  const ok = await requestConfirmation({
    title: `Générer ${count} image(s) ?`,
    message: `Ce sont ${count} appels payants avec ${currentModel.value?.label}, environ ${packCost.value} $ au total.`,
    confirmLabel: 'Générer',
  })
  if (!ok) return
  busy.value = true
  packMessage.value = ''
  try {
    await $fetch(`/api/faceless/avatar/${profileId}/pack`, {
      method: 'POST',
      body: { ids: selected.value, confirmCost: true, expectedCount: count, avatarPrompt: avatarPrompt.value, avatarRender: avatarRender.value, model: imageModel.value },
    })
    await refresh()
    startPolling()
  } catch (error) {
    packMessage.value = message(error, 'Génération impossible.')
    packError.value = true
  } finally {
    busy.value = false
  }
}

async function generateIllustration() {
  const ok = await requestConfirmation({
    title: 'Générer cette illustration ?',
    message: `Un appel payant (≈ ${folder.value.imageCostUsd} $).`,
    confirmLabel: 'Générer',
  })
  if (!ok) return
  busy.value = true
  illMessage.value = ''
  try {
    await $fetch(`/api/faceless/illustrations/${profileId}`, {
      method: 'POST',
      body: { mode: 'generate', kind: illKind.value, label: illLabel.value, prompt: illPrompt.value, confirmCost: true },
    })
    await refresh()
    illPrompt.value = ''
    illLabel.value = ''
    illMessage.value = 'Illustration ajoutée au dossier.'
    illError.value = false
  } catch (error) {
    illMessage.value = message(error, 'Génération impossible.')
    illError.value = true
  } finally {
    busy.value = false
  }
}

async function importIllustration(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return
  busy.value = true
  illMessage.value = ''
  try {
    await $fetch(`/api/faceless/illustrations/${profileId}`, {
      method: 'POST',
      body: { mode: 'upload', kind: illKind.value, label: illLabel.value || file.name.replace(/\.[^.]+$/, ''), imageBase64: await readFile(file) },
    })
    await refresh()
    illLabel.value = ''
    illMessage.value = 'Photo ajoutée au dossier.'
    illError.value = false
  } catch (error) {
    illMessage.value = message(error, 'Import impossible.')
    illError.value = true
  } finally {
    busy.value = false
  }
}

async function removeIllustration(item) {
  const ok = await requestConfirmation({
    title: 'Retirer cette illustration ?',
    message: `« ${item.label} » ne sera plus proposée pour les prochaines vidéos. Les vidéos déjà faites ne changent pas.`,
    confirmLabel: 'Retirer',
  })
  if (!ok) return
  try {
    await $fetch(`/api/faceless/illustrations/${profileId}/${item.id}`, { method: 'DELETE' })
    await refresh()
  } catch (error) {
    pushToast({ title: 'Suppression impossible', message: message(error, 'Réessaie.'), tone: 'error' })
  }
}

function firstLine(text) {
  return String(text || '').split('\n')[0].slice(0, 90)
}

function dateLabel(value) {
  try {
    return new Date(value).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return ''
  }
}

function statusLabel(status) {
  return { PENDING: 'en attente', VALIDATED: 'validée', PUBLISHED: 'publiée', PROCESSING: 'en cours', FAILED: 'échec' }[status] || status
}
</script>
