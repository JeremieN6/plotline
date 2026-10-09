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

        <div class="mt-6 border-t border-[#F0EEEA] pt-5">
          <p class="text-sm text-[#444]">
            Les <strong>images du pack</strong> (expressions, gestes) et les <strong>illustrations</strong> de cette persona se gèrent dans son dossier :
            <NuxtLink :to="`/library/personas/${profileId}`" class="font-semibold text-[#B45F1D] hover:underline">ouvrir le dossier →</NuxtLink>
          </p>
          <p class="mt-1 text-xs text-[#888]">Le style graphique de l’avatar se règle là aussi, avec l’image de base.</p>
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
const options = computed(() => optionsData.value || { presets: [], fonts: [], cardStyles: [], backgrounds: [], motions: [], densities: [], captionStyles: [], hairStyles: [], accessories: [], paletteKeys: [], enters: [], voices: [] })

const profileId = ref(String(route.query.profile || ''))
const da = ref(null)
const savedSnapshot = ref('')
const stored = ref(false)
const pack = ref({ kind: 'svg', baseUrl: '', generating: false, entries: [] })
const loadError = ref('')
const description = ref('')
const fromScratch = ref(false)
const composing = ref(false)
const saving = ref(false)
const preview = ref('')
const previewing = ref(false)
const previewError = ref('')

const dirty = computed(() => Boolean(da.value) && JSON.stringify(da.value) !== savedSnapshot.value)
const readyCount = computed(() => pack.value.entries.filter((entry) => entry.url).length)

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
    takeStyle(await $fetch(`/api/faceless/style/${id}`))
  } catch (error) {
    loadError.value = error?.data?.statusMessage || 'Impossible de charger la DA de cette persona.'
  }
}

watch(profileId, (id) => { loadStyle(id) })
onMounted(() => { if (profileId.value) loadStyle(profileId.value) })

function applyPreset(preset) {
  const keep = { avatar: da.value.avatar, voiceId: da.value.voiceId, avatarPrompt: da.value.avatarPrompt }
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
</script>
