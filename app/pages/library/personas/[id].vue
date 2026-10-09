<template>
  <div class="space-y-6">
    <header class="rounded-[20px] border border-[#E5E3DF] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
      <NuxtLink to="/library/personas" class="text-xs font-semibold text-[#B45F1D] hover:underline">← Dossiers personas</NuxtLink>
      <p class="mt-3 text-xs font-semibold uppercase tracking-[0.22em] text-[#E8873A]">Dossier faceless</p>
      <h1 class="mt-2 text-3xl font-bold tracking-tight text-[#111111]">{{ folder?.profile?.name || 'Dossier' }}</h1>
      <div v-if="folder" class="mt-4 flex flex-wrap gap-2">
        <NuxtLink
          :to="`/studio/faceless?profile=${profileId}`"
          class="rounded-[12px] bg-[#E8873A] px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-[#D97629]"
        >
          Créer une vidéo faceless
        </NuxtLink>
        <NuxtLink
          :to="`/studio/faceless/style?profile=${profileId}`"
          class="rounded-[12px] border border-[#E6B78E] bg-[#FFF5EC] px-4 py-2 text-sm font-bold text-[#B45F1D] transition-colors hover:bg-[#FFEBDB]"
        >
          Modifier la DA
        </NuxtLink>
      </div>
    </header>

    <p v-if="loadError" class="rounded-[12px] border border-[#F3C1C1] bg-[#FFF4F4] p-3 text-sm text-[#A33]">Dossier introuvable.</p>

    <template v-if="folder">
      <!-- 1. DA -->
      <section class="rounded-[20px] border border-[#E5E3DF] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
        <h2 class="text-lg font-bold text-[#111111]">Direction artistique</h2>
        <p v-if="!folder.stored" class="mt-1 text-xs text-[#888]">DA par défaut : « Modifier la DA » pour la personnaliser (ou la faire composer par Claude).</p>
        <div class="mt-3 flex flex-wrap items-center gap-2">
          <span class="text-sm font-semibold text-[#111]">{{ folder.style.name }}</span>
          <span
            v-for="color in palette"
            :key="color.key"
            class="h-5 w-5 rounded-full border border-black/10"
            :style="{ backgroundColor: color.value }"
            :title="color.key"
          />
        </div>
        <p class="mt-2 text-xs text-[#666]">
          Police {{ folder.style.font }} · cartes « {{ folder.style.card }} » · fond « {{ folder.style.background }} » · mouvement
          {{ folder.style.motion === 'stopmotion' ? 'stop motion' : 'fluide' }} · sous-titres
          {{ folder.style.captions.enabled ? (folder.style.captions.position === 'top' ? 'en haut' : 'en bas') : 'désactivés' }}
        </p>
        <p class="mt-1 text-xs text-[#666]">Voix par défaut : {{ folder.style.voiceLabel || 'standard' }}</p>
        <pre v-if="folder.style.rules" class="mt-3 whitespace-pre-wrap rounded-[10px] bg-[#FAFAF8] p-3 text-xs text-[#444]">{{ folder.style.rules }}</pre>
      </section>

      <!-- 2. Avatar -->
      <section class="rounded-[20px] border border-[#E5E3DF] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
        <h2 class="text-lg font-bold text-[#111111]">Avatar <span class="ml-1 rounded-full bg-[#FFF1E3] px-2 py-0.5 text-[11px] font-semibold text-[#B45F1D]">images payantes</span></h2>
        <p class="mt-1 text-xs text-[#666666]">
          Des images de ton personnage (expressions, gestes, tête seule ou buste), générées une fois à partir d’une image de base,
          puis réutilisées dans toutes ses vidéos. Environ {{ folder.imageCostUsd }} $ par image (tarif indicatif, à vérifier sur la console du fournisseur).
          Chaque génération demande ta confirmation. Le choix « avatar dessiné » ou « pack d’images » se fait dans la DA.
        </p>

        <label class="mt-4 block text-xs font-semibold text-[#444]">
          Style graphique de l’avatar
          <textarea
            v-model="avatarPrompt"
            rows="2"
            maxlength="400"
            placeholder="Ex. : chibi, grosse tête, aplats de couleur, contour fin. Ajoute « avec des lunettes » si tu en veux."
            class="mt-1 w-full rounded-[10px] border border-[#E5E3DF] px-3 py-2 text-sm font-normal outline-none focus:border-[#E8873A]"
          />
        </label>

        <div class="mt-4 flex flex-wrap items-start gap-4">
          <div class="h-40 w-40 shrink-0 overflow-hidden rounded-[14px] border border-[#E5E3DF] bg-[#EAFBEA]">
            <img v-if="pack.baseUrl" :src="pack.baseUrl" alt="Image de base" class="h-full w-full object-contain">
            <p v-else class="flex h-full items-center justify-center p-3 text-center text-xs text-[#888]">Pas encore d’image de base</p>
          </div>
          <div class="space-y-2 text-sm">
            <p class="text-xs font-semibold text-[#444]">Image de base du personnage</p>
            <button
              type="button"
              class="block rounded-[10px] border border-[#E6B78E] bg-[#FFF5EC] px-3 py-2 text-xs font-bold text-[#B45F1D] transition-colors hover:bg-[#FFEBDB] disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="!folder.profile.hasFaceRef || busy"
              @click="generateBase"
            >
              Générer depuis la fiche de référence (≈ {{ folder.imageCostUsd }} $)
            </button>
            <p v-if="!folder.profile.hasFaceRef" class="max-w-xs text-xs text-[#888]">Cette persona n’a pas de fiche de référence : importe ton image à la place.</p>
            <label class="block cursor-pointer rounded-[10px] border border-[#E5E3DF] bg-white px-3 py-2 text-xs font-bold text-[#444] transition-colors hover:bg-[#FAFAF8]">
              Importer mon image (gratuit, PNG ou JPG)
              <input type="file" accept="image/png,image/jpeg" class="hidden" @change="importBase">
            </label>
            <p class="max-w-xs text-xs text-[#888]">Idéal : le personnage sur fond vert uni (#00FF00), pour un détourage propre.</p>
          </div>
        </div>

        <div v-if="pack.baseUrl" class="mt-6">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <p class="text-xs font-semibold text-[#444]">Images du pack ({{ readyCount }}/{{ pack.entries.length }}) · {{ selected.length }} sélectionnée(s)</p>
            <div class="flex gap-2 text-xs">
              <button type="button" class="rounded-full border border-[#E5E3DF] px-3 py-1 hover:bg-[#FAFAF8]" @click="selected = pack.entries.filter((e) => !e.url).map((e) => e.id)">Les manquantes</button>
              <button type="button" class="rounded-full border border-[#E5E3DF] px-3 py-1 hover:bg-[#FAFAF8]" @click="selected = pack.entries.map((e) => e.id)">Toutes</button>
              <button type="button" class="rounded-full border border-[#E5E3DF] px-3 py-1 hover:bg-[#FAFAF8]" @click="selected = []">Aucune</button>
            </div>
          </div>

          <div class="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-7">
            <label
              v-for="entry in pack.entries"
              :key="entry.id"
              class="relative cursor-pointer rounded-[12px] border p-2 text-center transition-colors"
              :class="selected.includes(entry.id) ? 'border-[#E8873A] bg-[#FDF3EA]' : 'border-[#E5E3DF] bg-white'"
            >
              <input v-model="selected" type="checkbox" :value="entry.id" class="absolute left-2 top-2 h-4 w-4 accent-[#E8873A]">
              <div class="mx-auto flex h-20 w-full items-center justify-center rounded-[8px] bg-[repeating-conic-gradient(#f3f3f3_0%_25%,#fff_0%_50%)] bg-[length:14px_14px]">
                <img v-if="entry.url" :src="entry.url" :alt="entry.label" class="max-h-20 max-w-full object-contain">
                <span v-else-if="entry.status === 'pending'" class="text-[11px] text-[#B45F1D]">…</span>
                <span v-else class="text-lg text-[#CCC]">{{ entry.mode === 'head' ? '◔' : '▮' }}</span>
              </div>
              <p class="mt-1 text-[11px] font-semibold leading-tight text-[#333]">{{ entry.label }}</p>
              <p class="text-[10px] text-[#999]">{{ entry.mode === 'head' ? 'tête' : 'buste' }}<template v-if="entry.status === 'pending'"> · en cours</template></p>
              <p v-if="entry.status === 'failed'" class="text-[10px] text-[#A33]" :title="entry.error">échec</p>
            </label>
          </div>

          <div class="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              class="rounded-[12px] bg-[#111111] px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-[#2a2a2a] disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="!selected.length || pack.generating || busy"
              @click="generatePack"
            >
              {{ pack.generating ? 'Génération en cours…' : `Générer ${selected.length} image(s) — ≈ ${packCost} $` }}
            </button>
            <p v-if="pack.generating" class="text-xs text-[#888]">Environ 20 à 40 s par image. Tu peux quitter la page, la génération continue.</p>
          </div>
        </div>
        <p v-if="packMessage" class="mt-3 text-xs" :class="packError ? 'text-[#A33]' : 'text-[#2F7D4F]'">{{ packMessage }}</p>
      </section>

      <!-- 3. Illustrations -->
      <section class="rounded-[20px] border border-[#E5E3DF] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
        <h2 class="text-lg font-bold text-[#111111]">Illustrations <span class="ml-1 rounded-full bg-[#FFF1E3] px-2 py-0.5 text-[11px] font-semibold text-[#B45F1D]">générées ou importées</span></h2>
        <p class="mt-1 text-xs text-[#666666]">
          Des photos, images de stock et maquettes qui illustrent le propos d’une vidéo, présentées en polaroïd ou dans un cadre selon la DA.
          Génère-les une fois (≈ {{ folder.imageCostUsd }} $ chacune) ou importe tes propres photos (gratuit, nettoyées de leurs données EXIF) :
          Claude les réutilise ensuite d’une vidéo à l’autre. Jamais de visage ni de logo dans les images générées.
        </p>

        <div class="mt-4 grid gap-3 sm:grid-cols-[200px_1fr]">
          <label class="block text-xs font-semibold text-[#444]">
            Type
            <select v-model="illKind" class="mt-1 w-full rounded-[10px] border border-[#E5E3DF] bg-white px-3 py-2 text-sm font-normal outline-none focus:border-[#E8873A]">
              <option v-for="kind in folder.illustrationKinds" :key="kind.value" :value="kind.value">{{ kind.label }}</option>
            </select>
          </label>
          <label class="block text-xs font-semibold text-[#444]">
            Nom (facultatif)
            <input v-model="illLabel" maxlength="80" placeholder="Ex. : Bureau le matin" class="mt-1 w-full rounded-[10px] border border-[#E5E3DF] px-3 py-2 text-sm font-normal outline-none focus:border-[#E8873A]">
          </label>
        </div>
        <label class="mt-3 block text-xs font-semibold text-[#444]">
          Décris l’image à générer
          <textarea
            v-model="illPrompt"
            rows="2"
            maxlength="400"
            placeholder="Ex. : un café et un carnet ouverts sur un bureau en bois, lumière du matin"
            class="mt-1 w-full rounded-[10px] border border-[#E5E3DF] px-3 py-2 text-sm font-normal outline-none focus:border-[#E8873A]"
          />
        </label>
        <div class="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            class="rounded-[12px] bg-[#111111] px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-[#2a2a2a] disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="!illPrompt.trim() || busy"
            @click="generateIllustration"
          >
            Générer (≈ {{ folder.imageCostUsd }} $)
          </button>
          <label class="cursor-pointer rounded-[12px] border border-[#E5E3DF] bg-white px-4 py-2 text-sm font-bold text-[#444] transition-colors hover:bg-[#FAFAF8]">
            Importer une photo (gratuit)
            <input type="file" accept="image/png,image/jpeg" class="hidden" @change="importIllustration">
          </label>
        </div>
        <p v-if="illMessage" class="mt-3 text-xs" :class="illError ? 'text-[#A33]' : 'text-[#2F7D4F]'">{{ illMessage }}</p>

        <div v-if="folder.illustrations.length" class="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          <figure v-for="item in folder.illustrations" :key="item.id" class="rounded-[12px] border border-[#E5E3DF] bg-white p-2">
            <img :src="item.url" :alt="item.label" class="aspect-[4/5] w-full rounded-[8px] object-cover">
            <figcaption class="mt-2 text-[11px] leading-tight">
              <span class="block truncate font-semibold text-[#333]" :title="item.label">{{ item.label }}</span>
              <span class="text-[#999]">{{ item.kindLabel }} · {{ item.source === 'upload' ? 'importée' : 'générée' }}</span>
            </figcaption>
            <button type="button" class="mt-1 text-[11px] font-semibold text-[#A33] hover:underline" @click="removeIllustration(item)">Retirer</button>
          </figure>
        </div>
        <p v-else class="mt-5 text-xs text-[#888]">Aucune illustration pour l’instant.</p>
      </section>

      <!-- 4. Videos -->
      <section class="rounded-[20px] border border-[#E5E3DF] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
        <h2 class="text-lg font-bold text-[#111111]">Vidéos faceless de {{ folder.profile.name }}</h2>
        <ul v-if="folder.videos.length" class="mt-3 divide-y divide-[#F0EEEA]">
          <li v-for="video in folder.videos" :key="video.id" class="flex items-center justify-between gap-3 py-2.5">
            <div class="min-w-0">
              <p class="truncate text-sm text-[#222]">{{ firstLine(video.caption) || 'Vidéo faceless' }}</p>
              <p class="text-[11px] text-[#999]">{{ dateLabel(video.createdAt) }} · {{ statusLabel(video.status) }}</p>
            </div>
            <NuxtLink :to="`/studio/faceless?content=${video.id}`" class="shrink-0 text-xs font-semibold text-[#B45F1D] hover:underline">Ouvrir / retoucher</NuxtLink>
          </li>
        </ul>
        <p v-else class="mt-3 text-xs text-[#888]">Pas encore de vidéo faceless pour cette persona.</p>
      </section>
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
const selected = ref((folder.value?.pack?.entries || []).filter((entry) => !entry.url).map((entry) => entry.id))
const busy = ref(false)
const packMessage = ref('')
const packError = ref(false)
const packCost = computed(() => (Math.round(selected.value.length * (folder.value?.imageCostUsd || 0.134) * 100) / 100).toFixed(2))

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
    message: `Un appel payant (≈ ${folder.value.imageCostUsd} $).`,
    confirmLabel: 'Générer',
  })
  if (!ok) return
  busy.value = true
  packMessage.value = ''
  try {
    await $fetch(`/api/faceless/avatar/${profileId}/base`, { method: 'POST', body: { mode: 'generate', confirmCost: true, avatarPrompt: avatarPrompt.value } })
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
    await $fetch(`/api/faceless/avatar/${profileId}/base`, { method: 'POST', body: { mode: 'upload', imageBase64: await readFile(file), avatarPrompt: avatarPrompt.value } })
    await refresh()
    packMessage.value = 'Image de base importée.'
    packError.value = false
  } catch (error) {
    packMessage.value = message(error, 'Import impossible.')
    packError.value = true
  } finally {
    busy.value = false
  }
}

async function generatePack() {
  const count = selected.value.length
  const ok = await requestConfirmation({
    title: `Générer ${count} image(s) ?`,
    message: `Ce sont ${count} appels payants, environ ${packCost.value} $ au total.`,
    confirmLabel: 'Générer',
  })
  if (!ok) return
  busy.value = true
  packMessage.value = ''
  try {
    await $fetch(`/api/faceless/avatar/${profileId}/pack`, {
      method: 'POST',
      body: { ids: selected.value, confirmCost: true, expectedCount: count, avatarPrompt: avatarPrompt.value },
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
