<template>
  <div class="space-y-6 pb-24 font-ui">
    <header class="rounded-ui-card border border-ui-line bg-ui-surface p-5">
      <NuxtLink to="/studio/faceless" class="text-xs font-semibold text-ui-accent hover:underline">← Vidéo faceless</NuxtLink>
      <p class="mt-3 font-ui-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-ui-accent">Studio</p>
      <h1 class="mt-2 text-2xl font-semibold tracking-tight text-ui-ink">Direction artistique faceless</h1>
      <p class="mt-2 text-sm text-ui-ink-2">
        Le style de montage et l’avatar d’une persona, d’une marque ou d’une activité : couleurs, police, cartes, fond, mouvement, sous-titres, règles de montage.
        Chaque profil peut avoir jusqu’à {{ 1 + maxAlternates }} DA : une <strong>principale</strong> (utilisée par défaut) et {{ maxAlternates }} <strong>options</strong>, à choisir au moment de créer une vidéo.
      </p>
      <div class="mt-4 max-w-sm">
        <UiField label="Profil" for-id="da-profile">
          <UiSelect id="da-profile" v-model="profileId" :options="profileOptions" />
        </UiField>
      </div>
    </header>

    <UiAlert v-if="loadError" title="Chargement impossible">{{ loadError }}</UiAlert>

    <template v-if="drafts[0]">
      <!-- Les 3 DA du profil -->
      <section class="rounded-ui-card border border-ui-line bg-ui-surface p-5">
        <h2 class="text-lg font-semibold text-ui-ink">Les DA de {{ profileName }}</h2>
        <p class="mt-1 text-xs text-ui-ink-muted">
          La DA principale sert par défaut (plans du calendrier, vidéos d’articles). Les options apparaissent dans « Direction artistique » quand tu crées une vidéo faceless.
        </p>
        <div class="mt-3">
          <UiSegmented v-model="slot" label="DA à modifier" :options="slotOptions" />
        </div>
        <UiAlert v-if="slot > 0 && !drafts[slot]" tone="info" title="Cette DA n’existe pas encore" class="mt-4">
          <template v-if="canCreateSlot">
            Elle démarre comme une copie de la DA principale ; change ensuite le modèle, les couleurs ou laisse Claude la composer.
          </template>
          <template v-else>
            Crée et enregistre d’abord {{ slotName(slot - 1) }}.
          </template>
          <template #action>
            <UiButton size="sm" :disabled="!canCreateSlot" @click="createSlot">Créer cette DA</UiButton>
          </template>
        </UiAlert>
      </section>

      <template v-if="da">
        <!-- 1. Decrire la DA a Claude -->
        <section class="rounded-ui-card border border-ui-line bg-ui-surface p-5">
          <h2 class="text-lg font-semibold text-ui-ink">1. Choisis un modèle ou laisse Claude composer ta DA</h2>

          <p class="mt-4 text-sm font-semibold text-ui-ink">Modèles de départ</p>
          <div class="mt-2">
            <UiSegmented v-model="presetCategory" label="Catégorie de modèles" :options="categoryOptions" />
          </div>
          <p class="mt-2 text-xs text-ui-ink-muted">{{ currentCategory?.description }}</p>

          <div class="mt-3 space-y-3">
            <div v-for="group in presetGroups" :key="group.key">
              <p v-if="group.label" class="mb-1.5 font-ui-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-ui-ink-muted">{{ group.label }}</p>
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="preset in group.presets"
                  :key="preset.key"
                  type="button"
                  class="rounded-full border px-3 py-1 text-xs transition-colors"
                  :class="da.preset === preset.key ? 'border-ui-accent bg-ui-accent-soft font-semibold text-ui-accent-ink' : 'border-ui-line bg-ui-subtle text-ui-ink-2 hover:border-ui-accent hover:bg-ui-accent-soft'"
                  :title="preset.description"
                  @click="applyPreset(preset)"
                >
                  {{ preset.label }}
                </button>
              </div>
            </div>
          </div>

          <div class="mt-5 border-t border-ui-line-soft pt-4">
            <p class="text-sm font-semibold text-ui-ink">Ou décris l’ambiance à Claude</p>
            <p class="mt-1 text-xs text-ui-ink-muted">
              Claude remplit les champs ci-dessous (tu peux ensuite tout modifier à la main).
              Une fois la DA créée, la même zone sert à la modifier : « mets le fond en rose », « sans sous-titres »…
            </p>
            <UiTextarea
              v-model="description"
              class="mt-3"
              :rows="3"
              :maxlength="1500"
              placeholder="Ex. : brutaliste et sobre, fond crème quadrillé, orange et noir, textes en capitales, transitions franches, sous-titres en haut."
            />
            <div class="mt-3 flex flex-wrap items-center gap-3">
              <UiButton variant="primary" size="sm" :disabled="!description.trim()" :loading="composing" @click="compose">
                {{ composing ? 'Claude compose…' : 'Composer la DA' }}
              </UiButton>
              <label class="flex items-center gap-2 text-xs text-ui-ink-2">
                <input v-model="fromScratch" type="checkbox" class="h-4 w-4 accent-ui-accent">
                Repartir de zéro (ignorer la DA actuelle)
              </label>
              <span class="text-xs text-ui-ink-muted">Quelques centimes (texte seulement).</span>
            </div>
          </div>
        </section>

        <!-- 2. Champs -->
        <section class="rounded-ui-card border border-ui-line bg-ui-surface p-5">
          <h2 class="text-lg font-semibold text-ui-ink">2. Les réglages</h2>
          <UiAlert v-if="templateNote" tone="info" :title="templateNote.title" class="mt-3">{{ templateNote.text }}</UiAlert>
          <div class="mt-4 grid gap-4 sm:grid-cols-2">
            <UiField label="Nom de la DA">
              <UiInput v-model="da.name" maxlength="60" />
            </UiField>
            <UiField label="Police">
              <UiSelect v-model="da.font" :options="options.fonts" />
            </UiField>
            <UiField label="Style des cartes">
              <UiSelect v-model="da.card" :options="options.cardStyles" />
            </UiField>
            <UiField label="Fond">
              <UiSelect v-model="da.background" :options="options.backgrounds" />
            </UiField>
            <UiField label="Mouvement">
              <UiSelect v-model="da.motion" :options="options.motions" />
            </UiField>
            <UiField label="Densité">
              <UiSelect v-model="da.density" :options="options.densities" />
            </UiField>
            <UiField label="Formes décoratives">
              <UiSelect v-model="da.decor" :options="decorOptions" />
            </UiField>
            <UiField label="Voix par défaut">
              <UiSelect v-model="da.voiceId" :options="voiceOptions" />
            </UiField>
            <UiField v-if="options.cloneVoices?.length" label="Voix clonée par défaut" hint="Utilisée pour les vidéos du calendrier et des articles.&#10;Aucune : la voix de synthèse ci-dessus.">
              <UiSelect v-model="da.cloneVoiceId" :options="cloneVoiceOptions" />
            </UiField>
          </div>

          <p class="mt-5 text-sm font-semibold text-ui-ink">Couleurs</p>
          <div class="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <label v-for="key in options.paletteKeys" :key="key.value" class="flex items-center gap-2 text-xs text-ui-ink-2">
              <input v-model="da.palette[key.value]" type="color" class="h-9 w-9 shrink-0 cursor-pointer rounded-ui-tag border border-ui-line-input bg-ui-surface p-0.5">
              {{ key.label }}
            </label>
          </div>

          <p class="mt-5 text-sm font-semibold text-ui-ink">Transitions autorisées</p>
          <div class="mt-2 flex flex-wrap gap-3">
            <label v-for="enter in options.enters" :key="enter" class="flex items-center gap-1.5 text-xs text-ui-ink-2">
              <input v-model="da.enters" type="checkbox" :value="enter" class="h-4 w-4 accent-ui-accent">
              {{ enter }}
            </label>
          </div>

          <p class="mt-5 text-sm font-semibold text-ui-ink">Sous-titres</p>
          <div class="mt-2 grid items-center gap-3 sm:grid-cols-3">
            <label class="flex items-center gap-2 text-xs text-ui-ink-2">
              <input v-model="da.captions.enabled" type="checkbox" class="h-4 w-4 accent-ui-accent">
              Activés par défaut
            </label>
            <UiSelect v-model="da.captions.position" :options="captionPositions" aria-label="Position des sous-titres" />
            <UiSelect v-model="da.captions.style" :options="options.captionStyles" aria-label="Style des sous-titres" />
          </div>
          <UiAlert v-if="da.captions.enabled && da.captions.position === 'bottom' && da.avatar.kind !== 'none'" tone="info" class="mt-3">
            Les sous-titres peuvent passer devant l’avatar. Le haut de l’écran évite ce chevauchement.
          </UiAlert>

          <UiField class="mt-5" label="Règles de montage (lues par Claude à chaque vidéo)" hint="Quand tu retouches une vidéo, tu peux ajouter une consigne ici d’un clic (« retenir pour les prochaines vidéos »).">
            <UiTextarea v-model="da.rules" :rows="5" :maxlength="1500" />
          </UiField>
        </section>

        <!-- 3. Avatar -->
        <section class="rounded-ui-card border border-ui-line bg-ui-surface p-5">
          <h2 class="text-lg font-semibold text-ui-ink">3. L’avatar</h2>
          <p class="mt-1 text-xs text-ui-ink-muted">Un avatar est facultatif : sans lui, la vidéo n’affiche que le texte, les chiffres et les illustrations.</p>
          <div class="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-ui-ink">
            <label class="flex items-center gap-2">
              <input v-model="da.avatar.kind" type="radio" value="none" class="accent-ui-accent">
              Aucun avatar
            </label>
            <label class="flex items-center gap-2">
              <input v-model="da.avatar.kind" type="radio" value="svg" class="accent-ui-accent">
              Avatar dessiné (gratuit)
            </label>
            <label class="flex items-center gap-2" :class="readyCount ? '' : 'opacity-50'">
              <input v-model="da.avatar.kind" type="radio" value="pack" :disabled="!readyCount" class="accent-ui-accent">
              Pack d’images du profil ({{ readyCount }})
            </label>
          </div>
          <p v-if="!readyCount" class="mt-2 text-xs text-ui-ink-muted">Le pack d’images n’est disponible qu’une fois des images d’avatar générées ou importées dans le dossier du profil.</p>

          <div v-if="da.avatar.kind === 'svg'" class="mt-4 grid gap-3 sm:grid-cols-3">
            <UiField label="Cheveux">
              <UiSelect v-model="da.avatar.svg.hair" :options="options.hairStyles" />
            </UiField>
            <UiField label="Accessoire">
              <UiSelect v-model="da.avatar.svg.accessory" :options="options.accessories" />
            </UiField>
            <div class="flex flex-wrap items-center gap-3 text-xs text-ui-ink-2 sm:pt-6">
              <label class="flex items-center gap-1.5"><input v-model="da.avatar.svg.hairColor" type="color" class="h-8 w-8 rounded-ui-tag border border-ui-line-input bg-ui-surface p-0.5">Cheveux</label>
              <label class="flex items-center gap-1.5"><input v-model="da.avatar.svg.skin" type="color" class="h-8 w-8 rounded-ui-tag border border-ui-line-input bg-ui-surface p-0.5">Peau</label>
              <label class="flex items-center gap-1.5"><input v-model="da.avatar.svg.top" type="color" class="h-8 w-8 rounded-ui-tag border border-ui-line-input bg-ui-surface p-0.5">Haut</label>
            </div>
          </div>

          <div class="mt-6 border-t border-ui-line-soft pt-5">
            <p class="text-sm text-ui-ink-2">
              Les <strong>images du pack</strong> (expressions, gestes) et les <strong>illustrations</strong> de ce profil se gèrent dans son dossier, elles sont communes aux {{ 1 + maxAlternates }} DA :
              <NuxtLink :to="`/library/personas/${profileId}`" class="font-semibold text-ui-accent hover:underline">ouvrir le dossier →</NuxtLink>
            </p>
            <p class="mt-1 text-xs text-ui-ink-muted">Le style graphique de l’avatar se règle là aussi, avec l’image de base.</p>
          </div>
        </section>

        <!-- 4. Apercu -->
        <section class="rounded-ui-card border border-ui-line bg-ui-surface p-5">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <h2 class="text-lg font-semibold text-ui-ink">4. Aperçu</h2>
            <UiButton size="sm" :loading="previewing" @click="refreshPreview">
              {{ previewing ? 'Rendu…' : 'Actualiser l’aperçu' }}
            </UiButton>
          </div>
          <p class="mt-1 text-xs text-ui-ink-muted">Trois images d’une vidéo type, avec tes réglages actuels (même non enregistrés). Gratuit.</p>
          <img v-if="preview" :src="preview" alt="Aperçu de la DA" class="mt-4 w-full max-w-3xl rounded-ui-card border border-ui-line">
          <p v-if="previewError" class="mt-3 text-xs text-ui-danger-ink">{{ previewError }}</p>
        </section>
      </template>
    </template>

    <div v-if="da" class="fixed inset-x-0 bottom-0 z-30 border-t border-ui-line bg-ui-surface/95 px-4 py-3 backdrop-blur">
      <div class="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
        <p class="text-xs" :class="dirty ? 'text-ui-accent-ink' : 'text-ui-ink-muted'">
          {{ slotName(slot) }} : {{ dirty ? 'modifications non enregistrées' : (saved[slot] ? 'enregistrée' : 'par défaut (pas encore enregistrée)') }}
        </p>
        <div class="flex items-center gap-2">
          <UiButton v-if="slot > 0 && saved[slot]" variant="danger" size="sm" :loading="removing" @click="removeSlot">Retirer cette DA</UiButton>
          <UiButton variant="primary" size="sm" :loading="saving" :disabled="!dirty && saved[slot]" @click="save">
            {{ saving ? 'Enregistrement…' : 'Enregistrer cette DA' }}
          </UiButton>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
useSeoMeta({ title: 'Direction artistique faceless' })

const { pushToast } = useUiFeedback()
const route = useRoute()

const { data: profilesData } = await useFetch('/api/profiles', { key: 'faceless-da-profiles' })
const { data: optionsData } = await useFetch('/api/faceless/options', { key: 'faceless-da-options' })

const profiles = computed(() => (Array.isArray(profilesData.value) ? profilesData.value : []))
const options = computed(() => optionsData.value || { presets: [], presetCategories: [], fonts: [], cardStyles: [], backgrounds: [], motions: [], densities: [], captionStyles: [], hairStyles: [], accessories: [], paletteKeys: [], enters: [], voices: [] })
const maxAlternates = computed(() => options.value.maxAlternates || 2)

const profileOptions = computed(() => [{ value: '', label: 'Choisir un profil…' }, ...profiles.value.map((profile) => ({ value: profile.id, label: profile.name }))])
const voiceOptions = computed(() => (options.value.voices || []).map((voice) => ({ value: voice.id, label: voice.label })))
const cloneVoiceOptions = computed(() => [
  { value: '', label: 'Aucune (voix de synthèse)' },
  ...(options.value.cloneVoices || []).map((voice) => ({ value: voice.id, label: voice.name })),
])
const decorOptions = [{ value: 'shapes', label: 'Oui (étoiles, cœurs, nuages…)' }, { value: 'none', label: 'Non' }]
const captionPositions = [{ value: 'bottom', label: 'En bas' }, { value: 'top', label: 'En haut' }]

const profileId = ref(String(route.query.profile || ''))
const profileName = computed(() => profiles.value.find((profile) => profile.id === profileId.value)?.name || 'ce profil')

// Les trois DA du profil : [principale, option 2, option 3] (null = pas encore creee).
const drafts = ref([null, null, null])
const snapshots = ref(['', '', ''])
const saved = ref([false, false, false])
const slot = ref(0)

const pack = ref({ kind: 'none', baseUrl: '', generating: false, entries: [] })
const loadError = ref('')
const description = ref('')
const fromScratch = ref(false)
const composing = ref(false)
const saving = ref(false)
const removing = ref(false)
const preview = ref('')
const previewing = ref(false)
const previewError = ref('')

const da = computed(() => drafts.value[slot.value])
const dirty = computed(() => Boolean(da.value) && JSON.stringify(da.value) !== snapshots.value[slot.value])
const readyCount = computed(() => pack.value.entries.filter((entry) => entry.url).length)

function slotName(index) {
  const base = index === 0 ? 'DA principale' : `Option ${index + 1}`
  const name = drafts.value[index]?.name
  return name ? `${base} (${name})` : base
}
const slotOptions = computed(() => [0, 1, 2].map((index) => ({
  value: index,
  label: `${index === 0 ? 'Principale' : `Option ${index + 1}`}${drafts.value[index] && JSON.stringify(drafts.value[index]) !== snapshots.value[index] ? ' •' : ''}`,
})))
// L'option 2 peut démarrer tout de suite (la principale par défaut est copiée) ; la 3 exige que la 2 soit enregistrée.
const canCreateSlot = computed(() => slot.value === 1 || (slot.value > 1 && saved.value[slot.value - 1]))

// Modeles de depart : deux categories, la seconde rangee par famille de mise en page.
const presetCategory = ref('classic')
const categoryOptions = computed(() => (options.value.presetCategories || []).map((category) => ({ value: category.key, label: category.label })))
const currentCategory = computed(() => (options.value.presetCategories || []).find((category) => category.key === presetCategory.value))
const presetGroups = computed(() => {
  const inCategory = (options.value.presets || []).filter((preset) => preset.category === presetCategory.value)
  if (presetCategory.value === 'classic') return [{ key: 'classic', label: '', presets: inCategory }]
  const byFamily = new Map()
  for (const preset of inCategory) {
    if (!byFamily.has(preset.family)) byFamily.set(preset.family, { key: preset.family, label: preset.familyLabel, presets: [] })
    byFamily.get(preset.family).presets.push(preset)
  }
  return [...byFamily.values()]
})

const TEMPLATE_NOTES = {
  fenetre: { title: 'Modèle Fenêtre d’ordinateur', text: 'Chaque scène s’affiche dans une fenêtre posée sur l’aplat de couleur. Ici comptent la palette (fond = couleur dominante, accent secondaire = mots en jaune), la police, le mouvement et les sous-titres. Le style des cartes, le fond, le décor et les transitions sont ceux du modèle.' },
  herbier: { title: 'Modèle Herbier', text: 'Une page d’herbier : papier crème, serif doux, rameau de feuilles au trait, et une étiquette de produit décryptée ligne par ligne. Ici comptent la palette (accent = le mot en italique et le trait actif) et les sous-titres. La police, le style des cartes, le fond, le décor et les transitions sont ceux du modèle.' },
  hanko: { title: 'Modèle Hanko', text: 'Une affiche de cinéma japonais : papier crème, mincho, disque rouge, tampon et tier list. Ici comptent la palette (accent = le disque, le tampon et le mot important) et les sous-titres. La police, le style des cartes, le fond, le décor et les transitions sont ceux du modèle.' },
  journal: { title: 'Modèle Journal', text: 'Un journal de bord de créateur : papier clair, serif italique, cartes de produit et liste de ce qui est livré. Ici comptent la palette (accent = le mot en italique, les coches et le curseur ; fond secondaire = sa teinte douce) et les sous-titres. La police, le style des cartes, le fond, le décor et les transitions sont ceux du modèle.' },
  dashboard: { title: 'Modèle Dashboard', text: 'Une interface produit claire : cartes blanches, pastilles de statut, graphique qui se construit. Ici comptent la palette (accent = la couleur d’interface) et les sous-titres. La police, le style des cartes, le fond, le décor et les transitions sont ceux du modèle.' },
  brutal: { title: 'Modèle Affiche brutale', text: 'Capitales condensées énormes, noir et blanc cassé, un seul fluo sur le mot qui compte, cadre épais, coupes franches. Ici comptent la palette (accent = le fluo) et les sous-titres. La police, le style des cartes, le fond, le décor et les transitions sont ceux du modèle.' },
  editeur: { title: 'Modèle Éditeur de code', text: 'Chaque scène s’affiche comme du code dans un éditeur sombre, avec une phrase dessous et l’avatar dans une bulle ronde. Ici comptent la palette (accent = couleur de surbrillance, accent secondaire = mot clé de l’accroche), la police, le mouvement et les sous-titres. Le style des cartes, le fond, le décor et les transitions sont ceux du modèle.' },
  cahier: { title: 'Modèle Cahier éditorial', text: 'Papier quadrillé, une phrase en gris dont le mot important s’affiche en très grand et en noir. Ici comptent la palette (texte, accent = soulignement et carte active, accent secondaire = le gris), la police, le mouvement et les sous-titres. Le style des cartes, le fond, le décor et les transitions sont ceux du modèle.' },
}
const templateNote = computed(() => TEMPLATE_NOTES[da.value?.template] || null)

// Reponse du serveur -> brouillons. `only` : rang a mettre a jour (les autres brouillons non enregistres sont gardes).
function takeStyle(result, only = null) {
  const main = JSON.parse(JSON.stringify(result.style))
  const alternates = main.alternates || []
  delete main.alternates
  const incoming = [main, alternates[0] || null, alternates[1] || null]
  incoming.forEach((style, index) => {
    if (only !== null && only !== index) return
    drafts.value[index] = style
    snapshots.value[index] = style ? JSON.stringify(style) : ''
  })
  saved.value = [result.stored ?? saved.value[0], Boolean(alternates[0]), Boolean(alternates[1])]
  pack.value = result.pack
}

async function loadStyle(id) {
  drafts.value = [null, null, null]
  snapshots.value = ['', '', '']
  saved.value = [false, false, false]
  slot.value = 0
  loadError.value = ''
  preview.value = ''
  if (!id) return
  try {
    const result = await $fetch(`/api/faceless/style/${id}`)
    takeStyle(result)
    presetCategory.value = templateCategory(drafts.value[0])
  } catch (error) {
    loadError.value = error?.data?.statusMessage || 'Impossible de charger la DA de ce profil.'
  }
}

function templateCategory(style) {
  return style?.template && style.template !== 'classic' ? 'animated' : 'classic'
}

watch(profileId, (id) => { loadStyle(id) })
watch(slot, () => { preview.value = ''; if (da.value) presetCategory.value = templateCategory(da.value) })
onMounted(() => { if (profileId.value) loadStyle(profileId.value) })

function createSlot() {
  const copy = JSON.parse(JSON.stringify(drafts.value[0]))
  copy.name = `${copy.name} (option ${slot.value + 1})`
  drafts.value[slot.value] = copy
  snapshots.value[slot.value] = ''
}

function applyPreset(preset) {
  const keep = { avatar: da.value.avatar, voiceId: da.value.voiceId, cloneVoiceId: da.value.cloneVoiceId || '', avatarPrompt: da.value.avatarPrompt }
  drafts.value[slot.value] = { ...JSON.parse(JSON.stringify(preset.style)), ...keep }
}

async function compose() {
  composing.value = true
  loadError.value = ''
  try {
    const result = await $fetch('/api/faceless/style/generate', {
      method: 'POST',
      body: { description: description.value, profileId: profileId.value || undefined, current: fromScratch.value ? undefined : da.value },
    })
    // Claude ne decide pas du type d avatar : on garde le choix en cours.
    const kind = da.value.avatar.kind
    drafts.value[slot.value] = { ...result.style, avatar: { ...result.style.avatar, kind } }
    description.value = ''
    await refreshPreview()
  } catch (error) {
    loadError.value = error?.data?.statusMessage || 'Claude n’a pas pu composer la DA.'
  } finally {
    composing.value = false
  }
}

async function save() {
  saving.value = true
  const index = slot.value
  try {
    const result = await $fetch(`/api/faceless/style/${profileId.value}`, { method: 'PUT', body: { style: da.value, slot: index } })
    takeStyle({ ...result, stored: true }, index)
    pushToast({ title: 'DA enregistrée', message: index === 0 ? 'Tes prochaines vidéos faceless la suivront par défaut.' : 'Elle est proposée quand tu crées une vidéo faceless.', tone: 'success' })
  } catch (error) {
    pushToast({ title: 'Enregistrement impossible', message: error?.data?.statusMessage || 'Réessaie.', tone: 'error' })
  } finally {
    saving.value = false
  }
}

async function removeSlot() {
  removing.value = true
  try {
    const result = await $fetch(`/api/faceless/style/${profileId.value}`, { method: 'PUT', body: { slot: slot.value, remove: true } })
    slot.value = 0
    takeStyle({ ...result, stored: true })
    pushToast({ title: 'DA retirée', message: 'Les options suivantes ont remonté d’un rang.', tone: 'success' })
  } catch (error) {
    pushToast({ title: 'Retrait impossible', message: error?.data?.statusMessage || 'Réessaie.', tone: 'error' })
  } finally {
    removing.value = false
  }
}

async function refreshPreview() {
  previewing.value = true
  previewError.value = ''
  try {
    const result = await $fetch('/api/faceless/style/preview', { method: 'POST', body: { style: da.value, profileId: profileId.value || undefined } })
    preview.value = result.image
  } catch (error) {
    previewError.value = error?.data?.statusMessage || 'Aperçu impossible.'
  } finally {
    previewing.value = false
  }
}
</script>
