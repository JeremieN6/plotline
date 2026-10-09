<template>
  <div class="space-y-6 pb-24">
    <header class="rounded-[20px] border border-[#E5E3DF] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
      <NuxtLink to="/studio/faceless" class="text-xs font-semibold text-[#B45F1D] hover:underline">← Vidéo faceless</NuxtLink>
      <p class="mt-3 text-xs font-semibold uppercase tracking-[0.22em] text-[#E8873A]">Studio</p>
      <h1 class="mt-2 text-3xl font-bold tracking-tight text-[#111111]">Direction artistique faceless</h1>
      <p class="mt-2 text-sm text-[#666666]">
        Le style de montage et l’avatar d’une persona : couleurs, police, cartes, fond, mouvement, sous-titres, règles de montage.
        Toutes ses prochaines vidéos faceless suivent cette DA.
      </p>
      <div class="mt-4 max-w-sm">
        <label class="text-xs font-semibold uppercase tracking-[0.14em] text-[#AAAAAA]" for="da-profile">Persona</label>
        <select
          id="da-profile"
          v-model="profileId"
          class="mt-1 w-full rounded-[10px] border border-[#E5E3DF] bg-white px-3 py-2.5 text-sm text-[#111111] outline-none focus:border-[#E8873A]"
        >
          <option value="">Choisir une persona…</option>
          <option v-for="profile in profiles" :key="profile.id" :value="profile.id">{{ profile.name }}</option>
        </select>
      </div>
    </header>

    <p v-if="loadError" class="rounded-[12px] border border-[#F3C1C1] bg-[#FFF4F4] p-3 text-sm text-[#A33]">{{ loadError }}</p>

    <template v-if="da">
      <!-- 1. Decrire la DA a Claude -->
      <section class="rounded-[20px] border border-[#E5E3DF] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
        <h2 class="text-lg font-bold text-[#111111]">1. Laisse Claude composer ta DA</h2>
        <p class="mt-1 text-xs text-[#666666]">
          Décris l’ambiance voulue : Claude remplit les champs ci-dessous (tu peux ensuite tout modifier à la main).
          Une fois la DA créée, la même zone sert à la modifier : « mets le fond en rose », « sans sous-titres »…
        </p>
        <textarea
          v-model="description"
          rows="3"
          maxlength="1500"
          placeholder="Ex. : brutaliste et sobre, fond crème quadrillé, orange et noir, textes en capitales, transitions franches, sous-titres en haut."
          class="mt-3 w-full rounded-[12px] border border-[#E5E3DF] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#E8873A]"
        />
        <div class="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            class="rounded-[12px] bg-[#E8873A] px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-[#D97629] disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="!description.trim() || composing"
            @click="compose"
          >
            {{ composing ? 'Claude compose…' : 'Composer la DA' }}
          </button>
          <label class="flex items-center gap-2 text-xs text-[#555]">
            <input v-model="fromScratch" type="checkbox" class="h-4 w-4 accent-[#E8873A]">
            Repartir de zéro (ignorer la DA actuelle)
          </label>
          <span class="text-xs text-[#888]">Quelques centimes (texte seulement).</span>
        </div>
        <div class="mt-4 flex flex-wrap items-center gap-2 border-t border-[#F0EEEA] pt-4">
          <span class="text-xs font-semibold text-[#444]">Ou pars d’un modèle :</span>
          <button
            v-for="preset in options.presets"
            :key="preset.key"
            type="button"
            class="rounded-full border border-[#E5E3DF] bg-[#FAFAF8] px-3 py-1 text-xs text-[#444] transition-colors hover:border-[#E6B78E] hover:bg-[#FFF5EC]"
            :title="preset.description"
            @click="applyPreset(preset)"
          >
            {{ preset.label }}
          </button>
        </div>
      </section>

      <!-- 2. Champs -->
      <section class="rounded-[20px] border border-[#E5E3DF] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
        <h2 class="text-lg font-bold text-[#111111]">2. Les réglages</h2>
        <div class="mt-4 grid gap-4 sm:grid-cols-2">
          <label class="block text-xs font-semibold text-[#444]">
            Nom de la DA
            <input v-model="da.name" maxlength="60" class="mt-1 w-full rounded-[10px] border border-[#E5E3DF] px-3 py-2 text-sm font-normal outline-none focus:border-[#E8873A]">
          </label>
          <label class="block text-xs font-semibold text-[#444]">
            Police
            <select v-model="da.font" class="mt-1 w-full rounded-[10px] border border-[#E5E3DF] bg-white px-3 py-2 text-sm font-normal outline-none focus:border-[#E8873A]">
              <option v-for="item in options.fonts" :key="item.value" :value="item.value">{{ item.label }}</option>
            </select>
          </label>
          <label class="block text-xs font-semibold text-[#444]">
            Style des cartes
            <select v-model="da.card" class="mt-1 w-full rounded-[10px] border border-[#E5E3DF] bg-white px-3 py-2 text-sm font-normal outline-none focus:border-[#E8873A]">
              <option v-for="item in options.cardStyles" :key="item.value" :value="item.value">{{ item.label }}</option>
            </select>
          </label>
          <label class="block text-xs font-semibold text-[#444]">
            Fond
            <select v-model="da.background" class="mt-1 w-full rounded-[10px] border border-[#E5E3DF] bg-white px-3 py-2 text-sm font-normal outline-none focus:border-[#E8873A]">
              <option v-for="item in options.backgrounds" :key="item.value" :value="item.value">{{ item.label }}</option>
            </select>
          </label>
          <label class="block text-xs font-semibold text-[#444]">
            Mouvement
            <select v-model="da.motion" class="mt-1 w-full rounded-[10px] border border-[#E5E3DF] bg-white px-3 py-2 text-sm font-normal outline-none focus:border-[#E8873A]">
              <option v-for="item in options.motions" :key="item.value" :value="item.value">{{ item.label }}</option>
            </select>
          </label>
          <label class="block text-xs font-semibold text-[#444]">
            Densité
            <select v-model="da.density" class="mt-1 w-full rounded-[10px] border border-[#E5E3DF] bg-white px-3 py-2 text-sm font-normal outline-none focus:border-[#E8873A]">
              <option v-for="item in options.densities" :key="item.value" :value="item.value">{{ item.label }}</option>
            </select>
          </label>
          <label class="block text-xs font-semibold text-[#444]">
            Formes décoratives
            <select v-model="da.decor" class="mt-1 w-full rounded-[10px] border border-[#E5E3DF] bg-white px-3 py-2 text-sm font-normal outline-none focus:border-[#E8873A]">
              <option value="shapes">Oui (étoiles, cœurs, nuages…)</option>
              <option value="none">Non</option>
            </select>
          </label>
          <label class="block text-xs font-semibold text-[#444]">
            Voix par défaut
            <select v-model="da.voiceId" class="mt-1 w-full rounded-[10px] border border-[#E5E3DF] bg-white px-3 py-2 text-sm font-normal outline-none focus:border-[#E8873A]">
              <option v-for="voice in options.voices" :key="voice.id" :value="voice.id">{{ voice.label }}</option>
            </select>
          </label>
        </div>

        <p class="mt-5 text-xs font-semibold text-[#444]">Couleurs</p>
        <div class="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <label v-for="key in options.paletteKeys" :key="key.value" class="flex items-center gap-2 text-xs text-[#555]">
            <input v-model="da.palette[key.value]" type="color" class="h-9 w-9 shrink-0 cursor-pointer rounded-[8px] border border-[#E5E3DF] bg-white p-0.5">
            {{ key.label }}
          </label>
        </div>

        <p class="mt-5 text-xs font-semibold text-[#444]">Transitions autorisées</p>
        <div class="mt-2 flex flex-wrap gap-3">
          <label v-for="enter in options.enters" :key="enter" class="flex items-center gap-1.5 text-xs text-[#555]">
            <input v-model="da.enters" type="checkbox" :value="enter" class="h-4 w-4 accent-[#E8873A]">
            {{ enter }}
          </label>
        </div>

        <p class="mt-5 text-xs font-semibold text-[#444]">Sous-titres</p>
        <div class="mt-2 grid gap-3 sm:grid-cols-3">
          <label class="flex items-center gap-2 text-xs text-[#555]">
            <input v-model="da.captions.enabled" type="checkbox" class="h-4 w-4 accent-[#E8873A]">
            Activés par défaut
          </label>
          <select v-model="da.captions.position" class="rounded-[10px] border border-[#E5E3DF] bg-white px-3 py-2 text-sm outline-none focus:border-[#E8873A]">
            <option value="bottom">En bas</option>
            <option value="top">En haut</option>
          </select>
          <select v-model="da.captions.style" class="rounded-[10px] border border-[#E5E3DF] bg-white px-3 py-2 text-sm outline-none focus:border-[#E8873A]">
            <option v-for="item in options.captionStyles" :key="item.value" :value="item.value">{{ item.label }}</option>
          </select>
        </div>

        <label class="mt-5 block text-xs font-semibold text-[#444]">
          Règles de montage (lues par Claude à chaque vidéo)
          <textarea
            v-model="da.rules"
            rows="5"
            maxlength="1500"
            class="mt-1 w-full rounded-[10px] border border-[#E5E3DF] px-3 py-2 text-sm font-normal outline-none focus:border-[#E8873A]"
          />
        </label>
        <p class="mt-1 text-xs text-[#888]">Quand tu retouches une vidéo, tu peux ajouter une consigne ici d’un clic (« retenir pour les prochaines vidéos »).</p>
      </section>

      <!-- 3. Avatar -->
      <section class="rounded-[20px] border border-[#E5E3DF] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
        <h2 class="text-lg font-bold text-[#111111]">3. L’avatar</h2>
        <div class="mt-3 flex flex-wrap gap-4 text-sm">
          <label class="flex items-center gap-2">
            <input v-model="da.avatar.kind" type="radio" value="svg" class="accent-[#E8873A]">
            Avatar dessiné (gratuit)
          </label>
          <label class="flex items-center gap-2" :class="readyCount ? '' : 'opacity-50'">
            <input v-model="da.avatar.kind" type="radio" value="pack" :disabled="!readyCount" class="accent-[#E8873A]">
            Pack d’images de la persona ({{ readyCount }})
          </label>
        </div>

        <div v-if="da.avatar.kind === 'svg'" class="mt-4 grid gap-3 sm:grid-cols-3">
          <label class="block text-xs font-semibold text-[#444]">
            Cheveux
            <select v-model="da.avatar.svg.hair" class="mt-1 w-full rounded-[10px] border border-[#E5E3DF] bg-white px-3 py-2 text-sm font-normal outline-none focus:border-[#E8873A]">
              <option v-for="item in options.hairStyles" :key="item.value" :value="item.value">{{ item.label }}</option>
            </select>
          </label>
          <label class="block text-xs font-semibold text-[#444]">
            Accessoire
            <select v-model="da.avatar.svg.accessory" class="mt-1 w-full rounded-[10px] border border-[#E5E3DF] bg-white px-3 py-2 text-sm font-normal outline-none focus:border-[#E8873A]">
              <option v-for="item in options.accessories" :key="item.value" :value="item.value">{{ item.label }}</option>
            </select>
          </label>
          <div class="flex flex-wrap items-center gap-3 text-xs text-[#555]">
            <label class="flex items-center gap-1.5"><input v-model="da.avatar.svg.hairColor" type="color" class="h-8 w-8 rounded-[8px] border border-[#E5E3DF] bg-white p-0.5">Cheveux</label>
            <label class="flex items-center gap-1.5"><input v-model="da.avatar.svg.skin" type="color" class="h-8 w-8 rounded-[8px] border border-[#E5E3DF] bg-white p-0.5">Peau</label>
            <label class="flex items-center gap-1.5"><input v-model="da.avatar.svg.top" type="color" class="h-8 w-8 rounded-[8px] border border-[#E5E3DF] bg-white p-0.5">Haut</label>
          </div>
        </div>

        <!-- Pack d images -->
        <div class="mt-6 border-t border-[#F0EEEA] pt-5">
          <h3 class="text-sm font-bold text-[#111111]">Pack d’images de la persona <span class="ml-1 rounded-full bg-[#FFF1E3] px-2 py-0.5 text-[11px] font-semibold text-[#B45F1D]">payant</span></h3>
          <p class="mt-1 text-xs text-[#666666]">
            Des vraies images de ton personnage (expressions, gestes, tête seule ou buste), générées une fois à partir d’une image de base,
            puis réutilisées dans toutes les vidéos. Environ {{ options.imageCostUsd }} $ par image (tarif indicatif, à vérifier sur la console du fournisseur).
            Chaque génération demande ta confirmation.
          </p>

          <label class="mt-4 block text-xs font-semibold text-[#444]">
            Style graphique de l’avatar
            <textarea
              v-model="da.avatarPrompt"
              rows="2"
              maxlength="400"
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
              <p v-if="dirty" class="max-w-xs text-xs text-[#B45F1D]">Enregistre la DA avant de générer : le style graphique ci-dessus est pris en compte.</p>
              <button
                type="button"
                class="block rounded-[10px] border border-[#E6B78E] bg-[#FFF5EC] px-3 py-2 text-xs font-bold text-[#B45F1D] transition-colors hover:bg-[#FFEBDB] disabled:cursor-not-allowed disabled:opacity-50"
                :disabled="!hasFaceRef || dirty || busy"
                @click="generateBase"
              >
                Générer depuis la fiche de référence (≈ {{ options.imageCostUsd }} $)
              </button>
              <p v-if="!hasFaceRef" class="max-w-xs text-xs text-[#888]">Cette persona n’a pas de fiche de référence : importe ton image à la place.</p>
              <label class="block cursor-pointer rounded-[10px] border border-[#E5E3DF] bg-white px-3 py-2 text-xs font-bold text-[#444] transition-colors hover:bg-[#FAFAF8]">
                Importer mon image (gratuit, PNG ou JPG)
                <input type="file" accept="image/png,image/jpeg" class="hidden" @change="importBase">
              </label>
              <p class="max-w-xs text-xs text-[#888]">Idéal : le personnage sur fond vert uni (#00FF00), pour un détourage propre.</p>
            </div>
          </div>

          <div v-if="pack.baseUrl" class="mt-6">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <p class="text-xs font-semibold text-[#444]">Images à générer ({{ selected.length }} sélectionnée(s))</p>
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
                :disabled="!selected.length || pack.generating || busy || dirty"
                @click="generatePack"
              >
                {{ pack.generating ? 'Génération en cours…' : `Générer ${selected.length} image(s) — ≈ ${cost} $` }}
              </button>
              <p v-if="pack.generating" class="text-xs text-[#888]">Environ 20 à 40 s par image. Tu peux quitter la page, la génération continue.</p>
            </div>
          </div>
          <p v-if="packMessage" class="mt-3 text-xs" :class="packError ? 'text-[#A33]' : 'text-[#2F7D4F]'">{{ packMessage }}</p>
        </div>
      </section>

      <!-- 4. Apercu -->
      <section class="rounded-[20px] border border-[#E5E3DF] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <h2 class="text-lg font-bold text-[#111111]">4. Aperçu</h2>
          <button
            type="button"
            class="rounded-[12px] border border-[#E6B78E] bg-[#FFF5EC] px-4 py-2 text-sm font-bold text-[#B45F1D] transition-colors hover:bg-[#FFEBDB] disabled:opacity-50"
            :disabled="previewing"
            @click="refreshPreview"
          >
            {{ previewing ? 'Rendu…' : 'Actualiser l’aperçu' }}
          </button>
        </div>
        <p class="mt-1 text-xs text-[#666666]">Trois images d’une vidéo type, avec tes réglages actuels (même non enregistrés). Gratuit.</p>
        <img v-if="preview" :src="preview" alt="Aperçu de la DA" class="mt-4 w-full max-w-3xl rounded-[14px] border border-[#E5E3DF]">
        <p v-if="previewError" class="mt-3 text-xs text-[#A33]">{{ previewError }}</p>
      </section>
    </template>

    <div v-if="da" class="fixed inset-x-0 bottom-0 z-30 border-t border-[#E5E3DF] bg-white/95 px-4 py-3 backdrop-blur">
      <div class="mx-auto flex max-w-5xl items-center justify-between gap-3">
        <p class="text-xs" :class="dirty ? 'text-[#B45F1D]' : 'text-[#888]'">{{ dirty ? 'Modifications non enregistrées' : (stored ? 'DA enregistrée' : 'DA par défaut (pas encore enregistrée)') }}</p>
        <button
          type="button"
          class="rounded-[12px] bg-[#E8873A] px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-[#D97629] disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="saving || (!dirty && stored)"
          @click="save"
        >
          {{ saving ? 'Enregistrement…' : 'Enregistrer la DA' }}
        </button>
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
const options = computed(() => optionsData.value || { presets: [], fonts: [], cardStyles: [], backgrounds: [], motions: [], densities: [], captionStyles: [], hairStyles: [], accessories: [], paletteKeys: [], enters: [], voices: [], avatarCatalog: [], imageCostUsd: 0.134 })

const profileId = ref(String(route.query.profile || ''))
const da = ref(null)
const savedSnapshot = ref('')
const stored = ref(false)
const hasFaceRef = ref(false)
const pack = ref({ kind: 'svg', baseUrl: '', generating: false, entries: [] })
const loadError = ref('')
const description = ref('')
const fromScratch = ref(false)
const composing = ref(false)
const saving = ref(false)
const busy = ref(false)
const selected = ref([])
const packMessage = ref('')
const packError = ref(false)
const preview = ref('')
const previewing = ref(false)
const previewError = ref('')
let pollTimer = null

const dirty = computed(() => Boolean(da.value) && JSON.stringify(da.value) !== savedSnapshot.value)
const readyCount = computed(() => pack.value.entries.filter((entry) => entry.url).length)
const cost = computed(() => (Math.round(selected.value.length * options.value.imageCostUsd * 100) / 100).toFixed(2))

function takeStyle(result) {
  da.value = JSON.parse(JSON.stringify(result.style))
  savedSnapshot.value = JSON.stringify(da.value)
  stored.value = result.stored ?? stored.value
  pack.value = result.pack
}

async function loadStyle(id) {
  da.value = null
  loadError.value = ''
  preview.value = ''
  if (!id) return
  try {
    const result = await $fetch(`/api/faceless/style/${id}`)
    hasFaceRef.value = result.hasFaceRef
    takeStyle(result)
    selected.value = pack.value.entries.filter((entry) => !entry.url).map((entry) => entry.id)
    if (pack.value.generating) startPolling()
  } catch (error) {
    loadError.value = error?.data?.statusMessage || 'Impossible de charger la DA de cette persona.'
  }
}

watch(profileId, (id) => { stopPolling(); loadStyle(id) }, { immediate: false })
onMounted(() => { if (profileId.value) loadStyle(profileId.value) })

function applyPreset(preset) {
  const keep = { avatar: da.value.avatar, voiceId: da.value.voiceId }
  da.value = { ...JSON.parse(JSON.stringify(preset.style)), ...keep }
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
    da.value = { ...result.style, avatar: { ...result.style.avatar, kind } }
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
  try {
    const result = await $fetch(`/api/faceless/style/${profileId.value}`, { method: 'PUT', body: { style: da.value } })
    takeStyle({ ...result, stored: true })
    pushToast({ title: 'DA enregistrée', message: 'Tes prochaines vidéos faceless la suivront.', tone: 'success' })
  } catch (error) {
    pushToast({ title: 'Enregistrement impossible', message: error?.data?.statusMessage || 'Réessaie.', tone: 'error' })
  } finally {
    saving.value = false
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

async function reloadPack() {
  const result = await $fetch(`/api/faceless/avatar/${profileId.value}`)
  pack.value = result.pack
  return result.pack
}

function stopPolling() {
  if (pollTimer) clearInterval(pollTimer)
  pollTimer = null
}

function startPolling() {
  stopPolling()
  pollTimer = setInterval(async () => {
    try {
      const current = await reloadPack()
      if (!current.generating) {
        stopPolling()
        const failed = current.entries.filter((entry) => entry.status === 'failed').length
        packMessage.value = failed ? `Terminé, ${failed} image(s) en échec : relance-les (elles ne sont pas facturées si le modèle n’a rien renvoyé).` : 'Pack généré.'
        packError.value = failed > 0
      }
    } catch {
      // Erreur transitoire : on reessaie au prochain tour.
    }
  }, 5000)
}

async function generateBase() {
  if (!window.confirm(`Générer l’image de base ? Un appel payant (≈ ${options.value.imageCostUsd} $).`)) return
  busy.value = true
  packMessage.value = ''
  try {
    await $fetch(`/api/faceless/avatar/${profileId.value}/base`, { method: 'POST', body: { mode: 'generate', confirmCost: true, avatarPrompt: da.value.avatarPrompt } })
    await reloadPack()
    packMessage.value = 'Image de base créée.'
    packError.value = false
  } catch (error) {
    packMessage.value = error?.data?.statusMessage || 'Génération impossible.'
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
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
    await $fetch(`/api/faceless/avatar/${profileId.value}/base`, { method: 'POST', body: { mode: 'upload', imageBase64: dataUrl, avatarPrompt: da.value.avatarPrompt } })
    await reloadPack()
    packMessage.value = 'Image de base importée.'
    packError.value = false
  } catch (error) {
    packMessage.value = error?.data?.statusMessage || 'Import impossible.'
    packError.value = true
  } finally {
    busy.value = false
  }
}

async function generatePack() {
  const count = selected.value.length
  if (!window.confirm(`Générer ${count} image(s) ? Ce sont ${count} appels payants, environ ${cost.value} $ au total.`)) return
  busy.value = true
  packMessage.value = ''
  try {
    await $fetch(`/api/faceless/avatar/${profileId.value}/pack`, {
      method: 'POST',
      body: { ids: selected.value, confirmCost: true, expectedCount: count },
    })
    await reloadPack()
    startPolling()
  } catch (error) {
    packMessage.value = error?.data?.statusMessage || 'Génération impossible.'
    packError.value = true
  } finally {
    busy.value = false
  }
}

onBeforeUnmount(stopPolling)
</script>
