<template>
  <div class="space-y-6">
    <header class="rounded-[20px] border border-[#E5E3DF] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
      <p class="text-xs font-semibold uppercase tracking-[0.22em] text-[#E8873A]">Bibliothèque</p>
      <h1 class="mt-2 text-3xl font-bold tracking-tight text-[#111111]">Assets de référence</h1>
      <p class="mt-2 text-sm text-[#666666]">
        Enregistre un objet ou un lieu (voiture, maison, rue, bijou, chaussures, chapeau, accessoire) avec une ou plusieurs photos.
        Plotline en fait une fiche de référence que tu pourras réutiliser ensuite.
      </p>
      <div class="mt-4"><LibraryTabs /></div>
    </header>

    <section class="rounded-[20px] border border-[#E5E3DF] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
      <h2 class="text-lg font-bold text-[#111111]">Ajouter un asset</h2>

      <form class="mt-4 space-y-4" @submit.prevent="submitAsset">
        <div class="grid gap-4 sm:grid-cols-2">
          <div>
            <label class="mb-1.5 block text-sm font-semibold text-gray-800">Type</label>
            <select
              v-model="form.type"
              class="w-full rounded-[10px] border border-[#E5E3DF] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#E8873A]"
              @change="resetRoles"
            >
              <option v-for="item in types" :key="item.type" :value="item.type">{{ item.label }}</option>
            </select>
          </div>
          <div>
            <label class="mb-1.5 block text-sm font-semibold text-gray-800">Nom</label>
            <input
              v-model="form.name"
              type="text"
              maxlength="120"
              placeholder="Ex : Arkana rouge"
              class="w-full rounded-[10px] border border-[#E5E3DF] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#E8873A]"
            />
            <p v-if="previewCode" class="mt-1 text-xs text-[#888888]">Code : <strong>{{ previewCode }}</strong></p>
          </div>
        </div>

        <div>
          <label class="mb-1.5 block text-sm font-semibold text-gray-800">Description (optionnelle)</label>
          <textarea
            v-model="form.description"
            rows="2"
            maxlength="1000"
            class="w-full rounded-[10px] border border-[#E5E3DF] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#E8873A]"
          />
        </div>

        <div>
          <label class="mb-1.5 block text-sm font-semibold text-gray-800">Photos ({{ form.photos.length }}/{{ maxSources }})</label>
          <p class="mb-2 text-xs text-[#7B5A3F]">
            Ajoute une photo par vue et indique ce qu'elle montre. Exemple pour une voiture : une photo « Extérieur » et une photo « Intérieur ».
            Ce que les photos ne montrent pas ne sera pas inventé.
          </p>

          <ul class="space-y-2">
            <li
              v-for="(photo, index) in form.photos"
              :key="photo.preview"
              class="flex items-center gap-3 rounded-[12px] border border-[#E5E3DF] bg-[#FAFAF8] p-2"
            >
              <img :src="photo.preview" alt="" class="h-14 w-14 rounded-[8px] object-cover" />
              <select
                v-model="photo.role"
                class="min-w-0 flex-1 rounded-[10px] border border-[#E5E3DF] bg-white px-3 py-2 text-sm outline-none focus:border-[#E8873A]"
              >
                <option v-for="role in rolesFor(form.type)" :key="role.role" :value="role.role">{{ role.label }}</option>
              </select>
              <button type="button" class="rounded-lg border border-[#E5E3DF] bg-white px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50" @click="removeFormPhoto(index)">
                Retirer
              </button>
            </li>
          </ul>

          <label
            v-if="form.photos.length < maxSources"
            class="mt-2 inline-flex cursor-pointer items-center rounded-[10px] border border-dashed border-[#D9C6B4] bg-white px-4 py-2.5 text-sm font-semibold text-[#7B5A3F] hover:bg-[#FDF3EA]"
          >
            + Ajouter une photo (JPG ou PNG, 10 Mo max)
            <input type="file" accept="image/jpeg,image/png" multiple class="hidden" @change="onFormFiles" />
          </label>
        </div>

        <label class="inline-flex items-center gap-2 text-sm font-semibold text-[#111111]">
          <input v-model="form.generateNow" type="checkbox" class="accent-[#E8873A]" />
          Générer la fiche maintenant
        </label>
        <p v-if="form.generateNow" class="text-xs text-[#7B5A3F]">La génération d'une fiche utilise une image Gemini (payant, quelques dizaines de centimes).</p>

        <div class="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            class="rounded-[12px] bg-[#E8873A] px-4 py-2.5 text-sm font-bold text-white transition-all duration-150 hover:bg-[#d4762f] disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="submitting || !canSubmit"
          >
            {{ submitting ? submitLabel : 'Ajouter à la bibliothèque' }}
          </button>
          <p v-if="submitError" class="text-sm text-red-600">{{ submitError }}</p>
        </div>
      </form>
    </section>

    <section class="space-y-4">
      <div class="flex flex-wrap items-center gap-2">
        <button
          type="button"
          class="rounded-full border px-3 py-1.5 text-xs font-bold transition-colors"
          :class="typeFilter === '' ? 'border-[#111111] bg-[#111111] text-white' : 'border-[#E5E3DF] bg-white text-gray-700 hover:bg-gray-50'"
          @click="typeFilter = ''"
        >
          Tous
        </button>
        <button
          v-for="item in types"
          :key="item.type"
          type="button"
          class="rounded-full border px-3 py-1.5 text-xs font-bold transition-colors"
          :class="typeFilter === item.type ? 'border-[#111111] bg-[#111111] text-white' : 'border-[#E5E3DF] bg-white text-gray-700 hover:bg-gray-50'"
          @click="typeFilter = item.type"
        >
          {{ item.label }}
        </button>
      </div>

      <p v-if="loadError" class="text-sm text-red-600">Impossible de charger la bibliothèque.</p>
      <p v-else-if="!assets.length" class="rounded-[20px] border border-dashed border-[#E5E3DF] bg-white p-8 text-center text-sm text-[#888888]">
        Aucun asset pour l'instant.
      </p>

      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <article
          v-for="asset in assets"
          :key="asset.id"
          class="overflow-hidden rounded-[20px] border border-[#E5E3DF] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
        >
          <button type="button" class="relative block aspect-[4/3] w-full bg-[#FAFAF8]" @click="openAsset(asset)">
            <img :src="asset.sheetUrl || asset.sources[0]?.url" :alt="asset.name" class="h-full w-full object-cover" />
            <span v-if="!asset.sheetUrl" class="absolute left-3 top-3 rounded-full bg-[#111111] px-2.5 py-1 text-[11px] font-bold text-white">Sans fiche</span>
            <span v-else-if="asset.sheetOutdated" class="absolute left-3 top-3 rounded-full bg-[#E8873A] px-2.5 py-1 text-[11px] font-bold text-white">Fiche à régénérer</span>
          </button>

          <div class="space-y-3 p-4">
            <div>
              <p class="text-xs font-semibold uppercase tracking-[0.14em] text-[#AAAAAA]">{{ typeLabel(asset.type) }}</p>
              <h3 class="text-base font-bold text-[#111111]">{{ asset.name }}</h3>
              <p class="mt-0.5 text-xs text-[#888888]">{{ asset.code }} · {{ asset.sources.length }} photo{{ asset.sources.length > 1 ? 's' : '' }}</p>
              <p v-if="asset.description" class="mt-1 line-clamp-2 text-sm text-[#666666]">{{ asset.description }}</p>
            </div>

            <div class="flex flex-wrap gap-2">
              <button
                type="button"
                class="rounded-lg bg-[#FDE7D6] px-3 py-2 text-xs font-bold text-[#B45F1D] hover:bg-[#FAD9BE] disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="busyId === asset.id"
                @click="generateSheet(asset)"
              >
                {{ busyId === asset.id ? 'Génération…' : asset.sheetUrl ? 'Régénérer' : 'Générer la fiche' }}
              </button>
              <button type="button" class="rounded-lg border border-[#E5E3DF] bg-white px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50" @click="openAsset(asset)">Voir en grand</button>
              <button type="button" class="rounded-lg border border-[#E5E3DF] bg-white px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50" @click="copyCode(asset)">Copier le code</button>
              <button type="button" class="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50" @click="deleteAsset(asset)">Supprimer</button>
            </div>
          </div>
        </article>
      </div>
    </section>

    <div
      v-if="openedAsset"
      class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4"
      @click.self="openedId = ''"
    >
      <div class="my-6 w-full max-w-4xl rounded-[20px] bg-white p-5">
        <div class="flex items-start justify-between gap-3">
          <div>
            <h2 class="text-xl font-bold text-[#111111]">{{ openedAsset.name }}</h2>
            <p class="text-xs text-[#888888]">{{ openedAsset.code }}</p>
          </div>
          <button type="button" class="rounded-lg border border-[#E5E3DF] bg-white px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50" @click="openedId = ''">Fermer</button>
        </div>

        <div v-if="openedAsset.sheetUrl" class="mt-4">
          <p class="mb-2 text-sm font-bold text-[#111111]">Fiche de référence<span v-if="openedAsset.sheetOutdated" class="ml-2 text-[#E8873A]">(à régénérer)</span></p>
          <img :src="openedAsset.sheetUrl" :alt="`Fiche ${openedAsset.name}`" class="w-full rounded-[12px] border border-[#E5E3DF]" />
        </div>

        <div class="mt-5">
          <p class="mb-2 text-sm font-bold text-[#111111]">Photos sources ({{ openedAsset.sources.length }}/{{ maxSources }})</p>
          <div class="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <figure v-for="(source, index) in openedAsset.sources" :key="source.url" class="rounded-[12px] border border-[#E5E3DF] bg-[#FAFAF8] p-2">
              <img :src="source.url" alt="" class="aspect-square w-full rounded-[8px] object-cover" />
              <figcaption class="mt-2 flex items-center justify-between gap-2 text-xs">
                <span class="font-semibold text-[#111111]">{{ roleLabel(openedAsset.type, source.role) }}</span>
                <button
                  type="button"
                  class="font-bold text-red-600 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                  :disabled="openedAsset.sources.length <= 1 || busyId === openedAsset.id"
                  @click="removeSource(openedAsset, index)"
                >
                  Retirer
                </button>
              </figcaption>
            </figure>
          </div>

          <div v-if="openedAsset.sources.length < maxSources" class="mt-3 flex flex-wrap items-center gap-2">
            <select
              v-model="addRole"
              class="rounded-[10px] border border-[#E5E3DF] bg-white px-3 py-2 text-sm outline-none focus:border-[#E8873A]"
            >
              <option v-for="role in rolesFor(openedAsset.type)" :key="role.role" :value="role.role">{{ role.label }}</option>
            </select>
            <label class="inline-flex cursor-pointer items-center rounded-[10px] border border-dashed border-[#D9C6B4] bg-white px-4 py-2.5 text-sm font-semibold text-[#7B5A3F] hover:bg-[#FDF3EA]">
              {{ busyId === openedAsset.id ? 'Envoi…' : '+ Ajouter une photo' }}
              <input type="file" accept="image/jpeg,image/png" class="hidden" :disabled="busyId === openedAsset.id" @change="addSource(openedAsset, $event)" />
            </label>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'

const { pushToast, requestConfirmation } = useUiFeedback()

const typeFilter = ref('')
// Rendu serveur: useFetch transmet le cookie de session (un $fetch brut non).
const { data, error: loadError, refresh } = await useFetch('/api/assets', {
  query: computed(() => (typeFilter.value ? { type: typeFilter.value } : {})),
  watch: [typeFilter],
})

const assets = computed(() => data.value?.assets || [])
const types = computed(() => data.value?.meta?.types || [])
const rolesByType = computed(() => data.value?.meta?.roles || {})
const maxSources = computed(() => data.value?.meta?.maxSources || 8)

function rolesFor(type) {
  return rolesByType.value[type] || []
}
function defaultRole(type) {
  return rolesFor(type)[0]?.role || ''
}
function typeLabel(type) {
  return types.value.find((item) => item.type === type)?.label || type
}
function roleLabel(type, role) {
  return rolesFor(type).find((item) => item.role === role)?.label || 'Autre'
}

const form = reactive({ type: 'CAR', name: '', description: '', photos: [], generateNow: true })
const submitting = ref(false)
const submitLabel = ref('Envoi…')
const submitError = ref('')

// Meme regle que le serveur (buildAssetCode) : simple apercu, le serveur reste l'autorite.
const previewCode = computed(() => {
  const slug = form.name
    .normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40).replace(/_+$/g, '')
  return slug ? `${form.type}_${slug}` : ''
})
const canSubmit = computed(() => Boolean(form.name.trim()) && form.photos.length > 0)

function resetRoles() {
  form.photos.forEach((photo) => { photo.role = defaultRole(form.type) })
}

function onFormFiles(event) {
  const files = Array.from(event.target.files || [])
  event.target.value = ''
  for (const file of files) {
    if (form.photos.length >= maxSources.value) break
    form.photos.push({ file, preview: URL.createObjectURL(file), role: defaultRole(form.type) })
  }
}

function removeFormPhoto(index) {
  const [removed] = form.photos.splice(index, 1)
  if (removed) URL.revokeObjectURL(removed.preview)
}

function clearForm() {
  form.photos.forEach((photo) => URL.revokeObjectURL(photo.preview))
  form.name = ''
  form.description = ''
  form.photos = []
}

onBeforeUnmount(() => form.photos.forEach((photo) => URL.revokeObjectURL(photo.preview)))

function errorMessage(err, fallback) {
  return err?.data?.statusMessage || err?.statusMessage || fallback
}

async function sendPhoto(url, photo, extra = {}) {
  const body = new FormData()
  body.append('file', photo.file)
  body.append('role', photo.role)
  Object.entries(extra).forEach(([key, value]) => body.append(key, value))
  return $fetch(url, { method: 'POST', body })
}

async function submitAsset() {
  if (submitting.value || !canSubmit.value) return
  submitting.value = true
  submitError.value = ''
  let created = null

  try {
    const [first, ...others] = form.photos
    submitLabel.value = 'Création de l\'asset…'
    created = await sendPhoto('/api/assets', first, { type: form.type, name: form.name.trim(), description: form.description.trim() })

    for (let i = 0; i < others.length; i += 1) {
      submitLabel.value = `Envoi de la photo ${i + 2}/${form.photos.length}…`
      await sendPhoto(`/api/assets/${created.id}/sources`, others[i])
    }

    if (form.generateNow) {
      submitLabel.value = 'Génération de la fiche…'
      await $fetch(`/api/assets/${created.id}/sheet`, { method: 'POST' })
    }

    pushToast({ title: 'Asset ajouté', message: `${created.code} est dans la bibliothèque.`, tone: 'success' })
    clearForm()
  } catch (err) {
    submitError.value = created
      ? `L'asset ${created.code} a été créé, mais une étape a échoué : ${errorMessage(err, 'erreur inconnue')}. Tu peux le compléter depuis la grille.`
      : errorMessage(err, 'Création impossible')
    if (created) clearForm()
  } finally {
    submitting.value = false
    await refresh()
  }
}

const busyId = ref('')

async function generateSheet(asset) {
  const regenerate = Boolean(asset.sheetUrl)
  const confirmed = await requestConfirmation({
    title: regenerate ? 'Régénérer la fiche ?' : 'Générer la fiche ?',
    message: `Cette action utilise une image Gemini (payant, quelques dizaines de centimes).${regenerate ? ' La fiche actuelle sera remplacée.' : ''}`,
    confirmLabel: regenerate ? 'Régénérer' : 'Générer',
    cancelLabel: 'Annuler',
  })
  if (!confirmed) return

  busyId.value = asset.id
  try {
    await $fetch(`/api/assets/${asset.id}/sheet`, { method: 'POST' })
    pushToast({ title: 'Fiche prête', message: asset.code, tone: 'success' })
  } catch (err) {
    pushToast({ title: 'Génération impossible', message: errorMessage(err, 'Erreur inconnue'), tone: 'error', duration: 6000 })
  } finally {
    busyId.value = ''
    await refresh()
  }
}

const openedId = ref('')
const openedAsset = computed(() => assets.value.find((item) => item.id === openedId.value) || null)
const addRole = ref('')

function openAsset(asset) {
  openedId.value = asset.id
  addRole.value = defaultRole(asset.type)
}

watch(openedAsset, (asset) => {
  if (asset && !rolesFor(asset.type).some((item) => item.role === addRole.value)) {
    addRole.value = defaultRole(asset.type)
  }
})

async function addSource(asset, event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return
  busyId.value = asset.id
  try {
    await sendPhoto(`/api/assets/${asset.id}/sources`, { file, role: addRole.value })
    pushToast({ title: 'Photo ajoutée', message: asset.sheetUrl ? 'La fiche est à régénérer.' : asset.code, tone: 'success' })
  } catch (err) {
    pushToast({ title: 'Ajout impossible', message: errorMessage(err, 'Erreur inconnue'), tone: 'error', duration: 6000 })
  } finally {
    busyId.value = ''
    await refresh()
  }
}

async function removeSource(asset, index) {
  busyId.value = asset.id
  try {
    await $fetch(`/api/assets/${asset.id}/sources/${index}`, { method: 'DELETE' })
  } catch (err) {
    pushToast({ title: 'Retrait impossible', message: errorMessage(err, 'Erreur inconnue'), tone: 'error', duration: 6000 })
  } finally {
    busyId.value = ''
    await refresh()
  }
}

async function copyCode(asset) {
  try {
    await navigator.clipboard.writeText(asset.code)
    pushToast({ title: 'Code copié', message: asset.code, tone: 'success', duration: 2000 })
  } catch {
    pushToast({ title: 'Copie impossible', message: asset.code, tone: 'error' })
  }
}

async function deleteAsset(asset) {
  const confirmed = await requestConfirmation({
    title: `Supprimer ${asset.name} ?`,
    message: 'L\'asset, ses photos et sa fiche seront définitivement supprimés.',
    confirmLabel: 'Supprimer définitivement',
    cancelLabel: 'Annuler',
    tone: 'danger',
  })
  if (!confirmed) return

  try {
    await $fetch(`/api/assets/${asset.id}`, { method: 'DELETE' })
    if (openedId.value === asset.id) openedId.value = ''
  } catch (err) {
    pushToast({ title: 'Suppression impossible', message: errorMessage(err, 'Erreur inconnue'), tone: 'error', duration: 6000 })
  } finally {
    await refresh()
  }
}
</script>
