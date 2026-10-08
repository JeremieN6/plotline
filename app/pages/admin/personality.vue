<template>
  <div class="grid gap-5">
    <section class="rounded-[20px] border border-[#E5E3DF] bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
      <p class="text-xs font-semibold uppercase tracking-[0.22em] text-[#E8873A]">Admin · laboratoire</p>
      <h1 class="mt-2 text-3xl font-bold text-[#111111]">Générateur de personnalité</h1>
      <p class="mt-3 text-sm text-[#666666]">
        Génère une personnalité complète, bloc par bloc. Rien n'est enregistré : c'est un banc d'essai. Ce que tu
        saisis ou verrouilles n'est jamais réécrit par une génération.
      </p>
    </section>

    <p v-if="!isAdmin" class="rounded-[14px] border border-[#F1CEC7] bg-[#FFF7F5] p-4 text-sm text-[#C65244]">
      Cette page est réservée aux comptes administrateur.
    </p>

    <div v-else-if="schema" class="grid gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
      <!-- Paramètres -->
      <aside class="grid content-start gap-4 rounded-[20px] border border-[#E5E3DF] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)] lg:sticky lg:top-4">
        <div>
          <label class="label" for="pg-profile">Profil existant (optionnel)</label>
          <select id="pg-profile" v-model="profileId" class="input" :disabled="isBusy" @change="onProfileChange">
            <option value="">Aucun (laboratoire libre)</option>
            <option v-for="item in profiles" :key="item.id" :value="item.id">{{ item.name }} · {{ item.profileType }}</option>
          </select>
          <p v-if="profileId" class="hint">Nom, niche, style, signes distinctifs, mission et public viennent du profil (lecture seule).</p>
        </div>

        <div>
          <label class="label" for="pg-kind">Type de profil</label>
          <select id="pg-kind" v-model="kind" class="input" :disabled="isBusy || Boolean(profileId)" @change="onKindChange">
            <option v-for="item in schema.kinds" :key="item" :value="item">{{ item }}</option>
          </select>
        </div>

        <div>
          <label class="label" for="pg-ecc">Excentricité : {{ eccentricity }} / 5</label>
          <input id="pg-ecc" v-model.number="eccentricity" type="range" min="1" max="5" step="1" class="w-full accent-[#E8873A]" :disabled="isBusy">
          <p class="hint">{{ eccentricityHint }}</p>
        </div>

        <div>
          <label class="label" for="pg-lang">Langue du contenu</label>
          <select id="pg-lang" v-model="language" class="input" :disabled="isBusy">
            <option v-for="item in languages" :key="item.value" :value="item.value">{{ item.label }}</option>
          </select>
        </div>

        <fieldset>
          <legend class="label">Plateformes</legend>
          <div class="mt-1.5 flex flex-wrap gap-3 text-sm text-[#111111]">
            <label v-for="platform in schema.platforms" :key="platform" class="flex items-center gap-1.5">
              <input v-model="platforms" type="checkbox" :value="platform" :disabled="isBusy" class="accent-[#E8873A]">
              {{ platform }}
            </label>
          </div>
        </fieldset>

        <div>
          <label class="label" for="pg-free">Consigne libre</label>
          <textarea id="pg-free" v-model="freeText" rows="4" maxlength="1500" class="input" :disabled="isBusy"
            placeholder="Ex : ton sec, pas de morale, plutôt rurale…" />
        </div>

        <div class="grid gap-2">
          <button type="button" class="btn-primary" :disabled="isBusy" @click="generateAll">
            {{ busy === 'all' ? progress : (personality ? 'Générer / compléter' : 'Tout générer') }}
          </button>
          <button v-if="profileId && personality" type="button" class="btn-ghost" :disabled="isBusy || saving" @click="saveToProfile">
            {{ saving ? 'Enregistrement…' : 'Enregistrer sur ce profil' }}
          </button>
          <button v-if="personality" type="button" class="btn-ghost" :disabled="isBusy" @click="resetAll">Tout effacer</button>
        </div>
        <p v-if="saveMessage" class="hint !text-[#2F6B3B]">{{ saveMessage }}</p>
        <p v-else-if="profileId && hasStored" class="hint">Ce profil a déjà une personnalité enregistrée (chargée ci-contre).</p>

        <p v-if="errorMessage" class="rounded-[10px] border border-[#F1CEC7] bg-[#FFF7F5] p-3 text-sm text-[#C65244]">{{ errorMessage }}</p>
        <p v-if="lastDuration" class="hint">Dernière génération : {{ lastDuration }} s.</p>

        <details v-if="seedEntries.length" class="text-sm">
          <summary class="cursor-pointer text-[#666666]">Graines tirées ({{ seedEntries.length }})</summary>
          <ul class="mt-2 grid gap-1 text-[#111111]">
            <li v-for="[key, value] in seedEntries" :key="key"><span class="text-[#888888]">{{ key }} :</span> {{ value }}</li>
          </ul>
        </details>
      </aside>

      <!-- Résultats -->
      <div class="grid gap-4">
        <section v-for="block in schema.blocks" :key="block.key"
          class="rounded-[20px] border border-[#E5E3DF] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h2 class="text-lg font-bold text-[#111111]">{{ block.label }}</h2>
            <button type="button" class="btn-ghost" :disabled="isBusy" @click="regenerateBlock(block.key)">
              {{ busy === block.key ? 'Régénération…' : 'Régénérer ce bloc' }}
            </button>
          </div>

          <div class="mt-3 grid gap-4 md:grid-cols-2">
            <div v-for="field in visibleFields(block)" :key="field.key"
              :class="field.type === 'longtext' || field.type === 'list' ? 'md:col-span-2' : ''">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <label class="label" :for="`f-${block.key}-${field.key}`">{{ field.label }}</label>
                <div class="flex items-center gap-2 text-[11px]">
                  <span v-if="originOf(block.key, field.key)" :class="badgeClass(block.key, field.key)">{{ originLabel(block.key, field.key) }}</span>
                  <button v-if="canLock(block.key, field.key)" type="button" class="text-[#888888] underline"
                    :disabled="isBusy" @click="toggleLock(block.key, field.key)">
                    {{ isLocked(block.key, field.key) ? 'Déverrouiller' : 'Verrouiller' }}
                  </button>
                  <button v-if="isBio(field.key) && textOf(block.key, field)" type="button" class="text-[#888888] underline"
                    @click="copy(textOf(block.key, field))">Copier</button>
                </div>
              </div>
              <input v-if="field.type === 'number'" :id="`f-${block.key}-${field.key}`" type="number" class="input"
                :min="field.min ?? undefined" :max="field.max ?? undefined" :disabled="isBusy || isReadOnly(block.key, field.key)"
                :value="textOf(block.key, field)" @input="setField(block, field, $event.target.value)">
              <textarea v-else :id="`f-${block.key}-${field.key}`" class="input"
                :rows="field.type === 'longtext' ? 5 : field.type === 'list' ? 3 : 2"
                :placeholder="field.type === 'list' ? 'Un élément par ligne' : (field.optional ? 'Facultatif' : '')"
                :disabled="isBusy || isReadOnly(block.key, field.key)"
                :value="textOf(block.key, field)" @input="setField(block, field, $event.target.value)" />
              <p v-if="field.max && field.type !== 'number' && field.type !== 'list'" class="hint text-right"
                :class="overLimit(block.key, field) ? '!text-[#C65244]' : ''">
                {{ textOf(block.key, field).length }} / {{ field.max }}
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>

    <p v-else-if="isAdmin && schemaError" class="rounded-[14px] border border-[#F1CEC7] bg-[#FFF7F5] p-4 text-sm text-[#C65244]">
      Impossible de charger le registre de personnalité.
    </p>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'

useHead({ title: 'Générateur de personnalité' })

const { user: authUser, refreshAuth } = useAuthSession()
await refreshAuth()
const isAdmin = computed(() => Boolean(authUser.value?.isAdmin))

const requestFetch = useRequestFetch()

const languages = [
  { value: 'français', label: 'Français' },
  { value: 'English', label: 'English' },
  { value: 'español', label: 'Español' },
  { value: 'português', label: 'Português' },
  { value: 'Deutsch', label: 'Deutsch' },
  { value: 'italiano', label: 'Italiano' },
]
const eccentricityHints = {
  1: 'Crédible, proche de la niche, sans extravagance.',
  2: 'Plutôt crédible, un ou deux détails inattendus.',
  3: 'Crédible mais atypique dans son parcours ou ses obsessions.',
  4: 'Très atypique, tout en restant plausible.',
  5: 'Franchement décalé, combinaisons improbables mais cohérentes.',
}

const kind = ref('PERSONA')
const eccentricity = ref(3)
const language = ref('français')
const platforms = ref(['instagram', 'tiktok'])
const freeText = ref('')
const profileId = ref('')
const profiles = ref([])
const schema = ref(null)
const schemaError = ref(false)
const personality = ref(null)
const readOnly = ref([])
const busy = ref('')
const progress = ref('')
const errorMessage = ref('')
const lastDuration = ref(0)
const hasStored = ref(false)
const saving = ref(false)
const saveMessage = ref('')

const isBusy = computed(() => Boolean(busy.value))
const eccentricityHint = computed(() => eccentricityHints[eccentricity.value] || '')
const seedEntries = computed(() => Object.entries(personality.value?.seeds || {})
  .map(([key, value]) => [key, typeof value === 'string' ? value : JSON.stringify(value)]))

function errorText(error, fallback) {
  // statusMessage vit dans `data` : la ligne de statut HTTP perd les accents.
  return error?.data?.statusMessage || error?.statusMessage || error?.data?.message || fallback
}

async function loadSchema(nextKind) {
  schemaError.value = false
  try {
    const data = await requestFetch('/api/admin/personality/schema', { query: { kind: nextKind } })
    schema.value = data
    kind.value = data.kind
  } catch (error) {
    schemaError.value = true
    errorMessage.value = errorText(error, 'Impossible de charger le registre.')
  }
}

if (isAdmin.value) {
  await loadSchema(kind.value)
  try {
    const list = await requestFetch('/api/profiles')
    profiles.value = Array.isArray(list) ? list : []
  } catch {
    profiles.value = []
  }
}

// --- Lecture / écriture d'un champ ------------------------------------------
function entryOf(blockKey, fieldKey) {
  return personality.value?.blocks?.[blockKey]?.[fieldKey] || null
}
function fieldId(blockKey, fieldKey) {
  return `${blockKey}.${fieldKey}`
}
function isReadOnly(blockKey, fieldKey) {
  return readOnly.value.includes(fieldId(blockKey, fieldKey))
}
function isLocked(blockKey, fieldKey) {
  return entryOf(blockKey, fieldKey)?.locked === true
}
function originOf(blockKey, fieldKey) {
  return entryOf(blockKey, fieldKey)?.origin || ''
}
function canLock(blockKey, fieldKey) {
  const entry = entryOf(blockKey, fieldKey)
  return Boolean(entry) && !isReadOnly(blockKey, fieldKey) && entry.origin === 'generated' || isLocked(blockKey, fieldKey)
}
function originLabel(blockKey, fieldKey) {
  if (isReadOnly(blockKey, fieldKey)) return 'Colonne du profil'
  if (isLocked(blockKey, fieldKey)) return 'Verrouillé'
  return originOf(blockKey, fieldKey) === 'user' ? 'Saisi' : 'Généré'
}
function badgeClass(blockKey, fieldKey) {
  const base = 'rounded-full px-2 py-0.5 font-semibold '
  if (isReadOnly(blockKey, fieldKey)) return base + 'bg-[#EEF2F7] text-[#4A5A70]'
  if (isLocked(blockKey, fieldKey)) return base + 'bg-[#FDECE0] text-[#B4561C]'
  return base + (originOf(blockKey, fieldKey) === 'user' ? 'bg-[#E8F3EA] text-[#2F6B3B]' : 'bg-[#F4F0EA] text-[#7A6A58]')
}
function textOf(blockKey, field) {
  const value = entryOf(blockKey, field.key)?.value
  if (value === undefined || value === null) return ''
  return Array.isArray(value) ? value.join('\n') : String(value)
}
function overLimit(blockKey, field) {
  return Boolean(field.max) && textOf(blockKey, field).length > field.max
}
function isBio(fieldKey) {
  return Object.values(schema.value?.platformBioFields || {}).includes(fieldKey)
}
function visibleFields(block) {
  const hidden = new Set(
    Object.entries(schema.value?.platformBioFields || {})
      .filter(([platform]) => !platforms.value.includes(platform))
      .map(([, fieldKey]) => fieldKey),
  )
  return block.fields.filter((field) => !hidden.has(field.key))
}

function ensurePersonality() {
  if (!personality.value) {
    personality.value = { version: 1, kind: kind.value, eccentricity: eccentricity.value, seeds: {}, blocks: {} }
  }
  return personality.value
}

function setField(block, field, raw) {
  const target = ensurePersonality()
  const blocks = { ...target.blocks }
  const fields = { ...(blocks[block.key] || {}) }
  const text = String(raw ?? '')
  if (!text.trim()) {
    delete fields[field.key]
  } else {
    let value = text
    if (field.type === 'list') {
      value = text.split('\n').map((line) => line.trim()).filter(Boolean).slice(0, field.max || 20)
    } else if (field.type === 'number') {
      value = Number(text)
      if (!Number.isFinite(value)) return
    }
    fields[field.key] = { value, origin: 'user', ...(fields[field.key]?.locked ? { locked: true } : {}) }
  }
  blocks[block.key] = fields
  personality.value = { ...target, blocks }
}

function toggleLock(blockKey, fieldKey) {
  const target = ensurePersonality()
  const entry = entryOf(blockKey, fieldKey)
  if (!entry) return
  const next = { ...entry }
  if (next.locked) delete next.locked
  else next.locked = true
  personality.value = {
    ...target,
    blocks: { ...target.blocks, [blockKey]: { ...target.blocks[blockKey], [fieldKey]: next } },
  }
}

// --- Appels ---------------------------------------------------------------
function requestBody(extra) {
  return {
    kind: kind.value,
    eccentricity: eccentricity.value,
    language: language.value,
    platforms: platforms.value,
    freeText: freeText.value,
    ...(profileId.value ? { profileId: profileId.value } : {}),
    ...(personality.value ? { personality: personality.value } : {}),
    ...extra,
  }
}

function applyResult(result) {
  personality.value = result.personality
  readOnly.value = result.readOnlyFields || []
  if (result.kind) kind.value = result.kind
}

async function generateAll() {
  busy.value = 'all'
  errorMessage.value = ''
  const started = Date.now()
  try {
    const steps = schema.value.steps
    for (let index = 0; index < steps.length; index += 1) {
      progress.value = `Étape ${index + 1} / ${steps.length}…`
      // Chaque étape est une requête séparée : la suivante reçoit la précédente
      // en contexte (l'apparence découle de l'histoire) sans dépasser le délai du proxy.
      const result = await $fetch('/api/admin/personality/generate', {
        method: 'POST',
        body: requestBody({ onlyBlocks: steps[index] }),
      })
      applyResult(result)
    }
  } catch (error) {
    errorMessage.value = errorText(error, 'La génération a échoué.')
  } finally {
    lastDuration.value = Math.round((Date.now() - started) / 1000)
    busy.value = ''
  }
}

async function regenerateBlock(blockKey) {
  busy.value = blockKey
  errorMessage.value = ''
  const started = Date.now()
  try {
    const result = await $fetch('/api/admin/personality/regenerate-block', {
      method: 'POST',
      body: requestBody({ blockKey }),
    })
    applyResult(result)
  } catch (error) {
    errorMessage.value = errorText(error, 'La régénération a échoué.')
  } finally {
    lastDuration.value = Math.round((Date.now() - started) / 1000)
    busy.value = ''
  }
}

function resetAll() {
  personality.value = null
  readOnly.value = []
  errorMessage.value = ''
}

async function onKindChange() {
  resetAll()
  await loadSchema(kind.value)
}

async function onProfileChange() {
  resetAll()
  hasStored.value = false
  saveMessage.value = ''
  if (!profileId.value) return
  const profile = profiles.value.find((item) => item.id === profileId.value)
  if (profile?.profileType && profile.profileType !== kind.value) {
    kind.value = profile.profileType
    await loadSchema(kind.value)
  }
  // Charge ce qui est deja enregistre (les champs portes par une colonne du profil
  // reviennent en lecture seule).
  try {
    const result = await $fetch(`/api/profiles/${profileId.value}/personality`)
    applyResult(result)
    hasStored.value = Boolean(result.hasStored)
    if (result.personality?.eccentricity) eccentricity.value = result.personality.eccentricity
  } catch (error) {
    errorMessage.value = errorText(error, 'Impossible de charger la personnalité du profil.')
  }
}

async function saveToProfile() {
  if (!profileId.value || !personality.value) return
  if (hasStored.value && !window.confirm('Remplacer la personnalité déjà enregistrée sur ce profil ?')) return
  saving.value = true
  errorMessage.value = ''
  saveMessage.value = ''
  try {
    const result = await $fetch(`/api/profiles/${profileId.value}/personality`, {
      method: 'PUT',
      body: { personality: personality.value },
    })
    hasStored.value = true
    saveMessage.value = `Enregistré à ${new Date(result.updatedAt).toLocaleTimeString('fr-FR')}.`
  } catch (error) {
    errorMessage.value = errorText(error, 'Enregistrement impossible.')
  } finally {
    saving.value = false
  }
}

async function copy(text) {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    errorMessage.value = 'Copie impossible depuis ce navigateur.'
  }
}
</script>

<style scoped>
.label {
  display: block;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #aaaaaa;
}
.input {
  margin-top: 0.375rem;
  display: block;
  width: 100%;
  border-radius: 10px;
  border: 1px solid #e5e3df;
  background: #ffffff;
  padding: 0.625rem 0.75rem;
  font-size: 0.875rem;
  color: #111111;
  outline: none;
}
.input:focus {
  border-color: #e8873a;
}
.input:disabled {
  background: #f7f5f2;
  color: #666666;
}
.hint {
  margin-top: 0.25rem;
  font-size: 12px;
  color: #888888;
}
.btn-primary {
  border-radius: 10px;
  background: #e8873a;
  padding: 0.625rem 1rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: #ffffff;
}
.btn-primary:disabled {
  opacity: 0.6;
}
.btn-ghost {
  border-radius: 10px;
  border: 1px solid #e5e3df;
  background: #ffffff;
  padding: 0.5rem 0.875rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: #111111;
}
.btn-ghost:disabled {
  opacity: 0.5;
}
</style>
