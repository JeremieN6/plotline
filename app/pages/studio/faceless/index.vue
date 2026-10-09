<template>
  <div class="space-y-6">
    <header class="rounded-[20px] border border-[#E5E3DF] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
      <NuxtLink to="/studio" class="text-xs font-semibold text-[#B45F1D] hover:underline">← Studio</NuxtLink>
      <p class="mt-3 text-xs font-semibold uppercase tracking-[0.22em] text-[#E8873A]">Studio</p>
      <h1 class="mt-2 text-3xl font-bold tracking-tight text-[#111111]">Vidéo faceless</h1>
      <p class="mt-2 text-sm text-[#666666]">
        Une voix off, un avatar qui réagit et des cartes animées, dans la direction artistique de ta persona.
        Montage fait par du code : aucun modèle de génération vidéo, seulement quelques centimes de texte et de voix.
      </p>
    </header>

    <div class="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.9fr)]">
      <section class="space-y-5 rounded-[20px] border border-[#E5E3DF] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
        <div>
          <label class="text-sm font-semibold text-[#111111]" for="faceless-idea">1. Ton idée</label>
          <p class="mt-1 text-xs text-[#666666]">Le sujet, l angle, ce qu il faut absolument dire. Claude écrit le script et le montage.</p>
          <textarea
            id="faceless-idea"
            v-model="idea"
            rows="5"
            maxlength="2000"
            placeholder="Ex. : 3 business simples à lancer avec 0 € : affiliation, produit digital, communauté. Ton motivant, pour des filles de 18-30 ans."
            class="mt-2 w-full rounded-[12px] border border-[#E5E3DF] bg-white px-3 py-2.5 text-sm text-[#111111] outline-none focus:border-[#E8873A] focus:shadow-[0_0_0_3px_rgba(232,135,58,0.10)]"
          />
        </div>

        <div class="rounded-[12px] border border-[#E5E3DF] bg-[#FAFAF8] p-3">
          <p class="text-sm font-semibold text-[#111111]">Quelle voix ?</p>
          <div class="mt-2 flex flex-wrap gap-2">
            <button
              v-for="mode in VOICE_MODES"
              :key="mode.id"
              type="button"
              class="rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors"
              :class="voiceMode === mode.id ? 'border-[#E8873A] bg-[#FFF5EC] text-[#B45F1D]' : 'border-[#E5E3DF] bg-white text-[#444] hover:border-[#E6B78E]'"
              @click="voiceMode = mode.id"
            >
              {{ mode.label }}
            </button>
          </div>

          <div v-if="voiceMode === 'own'" class="mt-4 space-y-4">
            <p class="text-xs text-[#666666]">
              Tu enregistres ta voix, le reste est fait pour toi : transcription, suppression des silences et des reprises, puis montage sur ton audio.
              Tu peux dire les changements de montage à voix haute (« là, fond sombre »).
            </p>

            <div>
              <button
                type="button"
                class="rounded-[10px] bg-[#111111] px-3.5 py-2 text-xs font-bold text-white transition-colors hover:bg-[#2a2a2a] disabled:cursor-not-allowed disabled:opacity-50"
                :disabled="!idea.trim() || outlineLoading"
                @click="makeOutline"
              >
                {{ outlineLoading ? 'Préparation de la trame…' : (outline ? 'Refaire la trame' : 'Que dire ? Générer la trame') }}
              </button>
              <p v-if="!idea.trim()" class="mt-1 text-xs text-[#888]">Écris d abord ton idée ci-dessus.</p>
              <p v-if="outlineError" class="mt-2 text-xs text-[#A33]">{{ outlineError }}</p>
            </div>

            <div v-if="outline" class="space-y-3 rounded-[12px] border border-[#EFE3D6] bg-[#FFFAF4] p-3">
              <p class="text-sm font-semibold text-[#7B5A3F]">{{ outline.title || 'Trame à suivre' }}</p>
              <ol class="space-y-3">
                <li v-for="(beat, index) in outline.beats" :key="index" class="text-xs text-[#444]">
                  <p class="font-semibold text-[#111111]">{{ index + 1 }}. {{ beat.label }} <span class="font-normal text-[#888]">· ~{{ beat.seconds }} s</span></p>
                  <p class="mt-0.5 text-[#666666]">{{ beat.goal }}</p>
                  <ul v-if="beat.points.length" class="mt-1 list-disc pl-4">
                    <li v-for="(point, k) in beat.points" :key="k">{{ point }}</li>
                  </ul>
                  <p v-if="beat.example" class="mt-1 italic text-[#7B5A3F]">Exemple : « {{ beat.example }} »</p>
                  <p v-if="beat.cue" class="mt-1 text-[#B45F1D]">À dire à voix haute si tu veux : « {{ beat.cue }} »</p>
                </li>
              </ol>
              <p class="text-xs text-[#888]">Ce n est pas un texte à lire : reformule avec tes mots, ça sonnera plus vrai.</p>
            </div>

            <ul class="list-disc space-y-1 pl-4 text-xs text-[#666666]">
              <li v-for="tip in ownVoiceTips" :key="tip">{{ tip }}</li>
            </ul>

            <div>
              <label class="text-sm font-semibold text-[#111111]" for="faceless-audio">Mon enregistrement</label>
              <input
                id="faceless-audio"
                type="file"
                accept="audio/*,.mp3,.wav,.m4a,.ogg,.flac,.webm"
                class="mt-2 block w-full text-xs text-[#444] file:mr-3 file:rounded-[10px] file:border-0 file:bg-[#E8873A] file:px-3 file:py-2 file:text-xs file:font-bold file:text-white"
                @change="onAudioChange"
              >
              <p v-if="audioFile" class="mt-1 text-xs text-[#666666]">{{ audioFile.name }} · {{ (audioFile.size / 1048576).toFixed(1) }} Mo</p>
            </div>
          </div>
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <div>
            <label class="text-sm font-semibold text-[#111111]" for="faceless-profile">2. Persona (optionnel)</label>
            <p class="mt-1 text-xs text-[#666666]">Donne son ton et son public au script, et range la vidéo chez elle.</p>
            <select
              id="faceless-profile"
              v-model="profileId"
              class="mt-2 w-full rounded-[10px] border border-[#E5E3DF] bg-white px-3 py-2.5 text-sm text-[#111111] outline-none focus:border-[#E8873A]"
            >
              <option value="">Aucune (narratrice neutre)</option>
              <option v-for="profile in profiles" :key="profile.id" :value="profile.id">{{ profile.name }}</option>
            </select>
            <p v-if="!profileId" class="mt-2 text-xs text-[#888]">
              Sans persona : DA par défaut (papercraft pastel, avatar dessiné). Choisis une persona pour utiliser sa DA.
            </p>
            <div v-else-if="styleInfo" class="mt-2 rounded-[10px] border border-[#EFE3D6] bg-[#FFFAF4] px-3 py-2 text-xs text-[#7B5A3F]">
              <p>
                <span class="font-semibold">DA : {{ styleInfo.style.name }}</span>
                · avatar : {{ avatarSummary }}
              </p>
              <p class="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                <NuxtLink :to="`/studio/faceless/style?profile=${profileId}`" class="inline-block font-semibold text-[#B45F1D] hover:underline">
                  {{ styleInfo.stored ? 'Modifier la DA →' : 'Créer sa DA →' }}
                </NuxtLink>
                <NuxtLink :to="`/library/personas/${profileId}`" class="inline-block font-semibold text-[#B45F1D] hover:underline">
                  Dossier de la persona →
                </NuxtLink>
              </p>
            </div>
          </div>

          <div v-if="voiceMode === 'synth'">
            <label class="text-sm font-semibold text-[#111111]" for="faceless-voice">3. Voix</label>
            <p class="mt-1 text-xs text-[#666666]">Voix ElevenLabs qui parlent français.</p>
            <select
              id="faceless-voice"
              v-model="voiceId"
              class="mt-2 w-full rounded-[10px] border border-[#E5E3DF] bg-white px-3 py-2.5 text-sm text-[#111111] outline-none focus:border-[#E8873A]"
            >
              <option v-for="voice in voices" :key="voice.id" :value="voice.id">{{ voice.label }}</option>
            </select>
          </div>

          <div v-if="voiceMode === 'synth'">
            <label class="text-sm font-semibold text-[#111111]" for="faceless-duration">4. Durée visée</label>
            <select
              id="faceless-duration"
              v-model.number="durationSeconds"
              class="mt-2 w-full rounded-[10px] border border-[#E5E3DF] bg-white px-3 py-2.5 text-sm text-[#111111] outline-none focus:border-[#E8873A]"
            >
              <option v-for="d in durations" :key="d" :value="d">{{ d }} secondes</option>
            </select>
          </div>

          <label class="flex items-start gap-3 self-end rounded-[12px] border border-[#E5E3DF] bg-[#FAFAF8] p-3 text-sm">
            <input v-model="captions" type="checkbox" class="mt-0.5 h-4 w-4 accent-[#E8873A]">
            <span>
              <span class="font-semibold text-[#111111]">Sous-titres</span>
              <span class="block text-xs text-[#666666]">Seulement quand l écran ne montre pas déjà les mots dits.</span>
            </span>
          </label>
        </div>

        <div v-if="profileId && voiceMode === 'synth'" class="rounded-[12px] border border-[#E5E3DF] bg-[#FAFAF8] p-3">
          <label class="text-sm font-semibold text-[#111111]" for="faceless-new-images">5. Illustrations</label>
          <p class="mt-1 text-xs text-[#666666]">
            Le dossier de la persona contient {{ styleInfo?.illustrationCount || 0 }} illustration(s) : Claude les utilise quand elles servent le propos (gratuit).
          </p>
          <select
            id="faceless-new-images"
            v-model.number="newIllustrations"
            class="mt-2 w-full max-w-sm rounded-[10px] border border-[#E5E3DF] bg-white px-3 py-2.5 text-sm text-[#111111] outline-none focus:border-[#E8873A]"
          >
            <option :value="0">Pas de nouvelle image</option>
            <option v-for="n in [1, 2, 3]" :key="n" :value="n">Jusqu’à {{ n }} nouvelle(s) image(s) — ≈ {{ (Math.round(n * imageCost * 100) / 100).toFixed(2) }} $ au maximum</option>
          </select>
          <p v-if="newIllustrations > 0" class="mt-1 text-xs text-[#B45F1D]">Les nouvelles images sont rangées dans le dossier et réutilisables ensuite.</p>
        </div>

        <div class="flex flex-wrap items-center gap-3 border-t border-[#F0EEEA] pt-4">
          <button
            type="button"
            class="rounded-[12px] bg-[#E8873A] px-5 py-2.5 text-sm font-bold text-white shadow-[0_1px_2px_rgba(0,0,0,0.12)] transition-colors hover:bg-[#D97629] disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="!canGenerate"
            @click="generate"
          >
            {{ polling ? 'Montage en cours…' : (voiceMode === 'own' ? 'Monter avec ma voix' : 'Générer la vidéo') }}
          </button>
          <p class="text-xs text-[#666666]">{{ voiceMode === 'own' ? 'Environ 2 à 4 minutes (transcription, nettoyage, montage).' : 'Environ 1 à 3 minutes.' }} Tu peux quitter la page : la vidéo arrive dans Mes créations.</p>
        </div>

        <p v-if="errorMessage" class="rounded-[12px] border border-[#F3C1C1] bg-[#FFF4F4] p-3 text-sm text-[#A33]">{{ errorMessage }}</p>
      </section>

      <aside class="space-y-4 rounded-[20px] border border-[#E5E3DF] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
        <p class="text-sm font-semibold text-[#111111]">Résultat</p>
        <div v-if="polling" class="rounded-[14px] border border-[#F2CCAA] bg-[#FFF5EC] p-4 text-sm text-[#B45F1D]">
          {{ pollingLabel }} ({{ elapsedLabel }})
        </div>
        <p v-if="lastFailure" class="rounded-[12px] border border-[#F3C1C1] bg-[#FFF4F4] p-3 text-sm text-[#A33]">
          {{ lastFailure }}
        </p>
        <div v-if="videoUrl" class="space-y-3">
          <video :key="videoUrl" :src="videoUrl" controls playsinline class="w-full rounded-[14px] border border-[#E5E3DF] bg-black" />
          <NuxtLink to="/content" class="inline-block text-sm font-semibold text-[#B45F1D] hover:underline">Voir dans Mes créations →</NuxtLink>
        </div>
        <p v-else-if="!polling" class="text-sm text-[#888]">La vidéo apparaîtra ici.</p>

        <div v-if="info?.retouchable && videoUrl && !polling" class="space-y-3 border-t border-[#F0EEEA] pt-4">
          <div>
            <label class="text-sm font-semibold text-[#111111]" for="faceless-retouch">Retoucher</label>
            <p class="mt-1 text-xs text-[#666666]">
              Dis ce qui ne va pas, comme à un monteur. Si le texte dit ne change pas, la même voix est réutilisée.
            </p>
          </div>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="suggestion in RETOUCH_SUGGESTIONS"
              :key="suggestion"
              type="button"
              class="rounded-full border border-[#E5E3DF] bg-[#FAFAF8] px-3 py-1 text-xs text-[#444] transition-colors hover:border-[#E6B78E] hover:bg-[#FFF5EC]"
              @click="instruction = suggestion"
            >
              {{ suggestion }}
            </button>
          </div>
          <textarea
            id="faceless-retouch"
            v-model="instruction"
            rows="3"
            maxlength="1000"
            placeholder="Ex. : l intro a trop de texte, coupe-la en deux écrans. Garde l avatar qui sourit pendant toute la phrase sur la communauté."
            class="w-full rounded-[12px] border border-[#E5E3DF] bg-white px-3 py-2.5 text-sm text-[#111111] outline-none focus:border-[#E8873A] focus:shadow-[0_0_0_3px_rgba(232,135,58,0.10)]"
          />
          <label v-if="info.personaId" class="flex items-start gap-2 text-xs text-[#555]">
            <input v-model="rememberRule" type="checkbox" class="mt-0.5 h-4 w-4 accent-[#E8873A]">
            <span>Retenir pour les prochaines vidéos de cette persona (ajoute la consigne aux règles de sa DA)</span>
          </label>
          <button
            type="button"
            class="rounded-[12px] bg-[#111111] px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-[#2a2a2a] disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="!instruction.trim() || !info.canRetouchNow"
            @click="retouch"
          >
            Créer la version retouchée
          </button>
          <p v-if="!info.canRetouchNow" class="text-xs text-[#888]">Seule une vidéo « en attente » peut être retouchée.</p>
          <div v-if="info.retouches?.length" class="text-xs text-[#666666]">
            <p class="font-semibold text-[#444]">Retouches déjà appliquées</p>
            <ol class="mt-1 list-decimal space-y-1 pl-4">
              <li v-for="(item, index) in info.retouches" :key="index">{{ item }}</li>
            </ol>
          </div>
        </div>
        <p v-else-if="info && !info.retouchable && videoUrl && !polling" class="border-t border-[#F0EEEA] pt-4 text-xs text-[#888]">
          Cette vidéo a été créée avant les retouches : elle n a pas de plan de montage enregistré.
        </p>
      </aside>
    </div>
  </div>
</template>

<script setup>
useSeoMeta({ title: 'Vidéo faceless' })

const { pushToast, requestConfirmation } = useUiFeedback()
const route = useRoute()

// Consignes types (inspirees des allers-retours du tuto) : un clic les place dans la zone de retouche.
const RETOUCH_SUGGESTIONS = [
  'L intro a trop de texte : coupe-la en deux écrans.',
  'Laisse chaque carte un peu plus longtemps à l écran.',
  'Varie davantage les expressions de l avatar.',
  'Rends l appel à l action final plus percutant.',
]

// Voix : synthetique (ElevenLabs, script ecrit par Claude) ou celle de l utilisateur (enregistrement).
const VOICE_MODES = [
  { id: 'synth', label: 'Voix de synthèse (Claude écrit le script)' },
  { id: 'own', label: 'Ma propre voix' },
]
const DEFAULT_TIPS = [
  'Enregistre dans une pièce calme, le micro à 15-20 cm de la bouche, et parle comme à une amie.',
  'Tu te rates ? Pause d une seconde puis reprends la phrase depuis le début : la mauvaise prise est supprimée.',
  'Tu peux dire une indication de montage à voix haute (« là, change de fond ») : elle est appliquée puis retirée.',
  'Un seul fichier (mp3, wav, m4a, ogg, flac ou webm), 25 Mo maximum.',
]

const idea = ref('')
const voiceMode = ref('synth')
const audioFile = ref(null)
const outline = ref(null)
const outlineLoading = ref(false)
const outlineError = ref('')
const ownVoiceTips = computed(() => outline.value?.tips || DEFAULT_TIPS)
const profileId = ref(String(route.query.profile || ''))
const newIllustrations = ref(0)
const voiceId = ref('')
const durationSeconds = ref(30)
const captions = ref(true)
const styleInfo = ref(null)
const rememberRule = ref(false)
const errorMessage = ref('')
const instruction = ref('')
const contentId = ref(String(route.query.content || ''))
const videoUrl = ref('')
const lastFailure = ref('')
const info = ref(null)
const polling = ref(false)
const pollingKind = ref('generate')
const startedAt = ref(0)
const now = ref(Date.now())
let pollTimer = null
let clockTimer = null

const requestFetch = useRequestFetch()
const { data: profilesData } = await useFetch('/api/profiles', { key: 'faceless-profiles' })
const { data: options } = await useFetch('/api/faceless/options', { key: 'faceless-options' })

const profiles = computed(() => (Array.isArray(profilesData.value) ? profilesData.value : []))
const voices = computed(() => options.value?.voices || [])
const durations = computed(() => options.value?.durations || [20, 30, 45, 60])
const imageCost = computed(() => options.value?.imageCostUsd || 0.134)

watch(options, (value) => {
  if (!voiceId.value && value?.defaultVoiceId) voiceId.value = value.defaultVoiceId
}, { immediate: true })

const avatarSummary = computed(() => {
  const pack = styleInfo.value?.pack
  if (!pack || pack.kind !== 'pack') return 'dessiné'
  const count = pack.entries.filter((entry) => entry.url).length
  return `pack de ${count} images`
})

// Le choix d une persona applique sa DA : voix et sous-titres par defaut.
async function loadStyleInfo(id) {
  styleInfo.value = null
  newIllustrations.value = 0
  if (!id) return
  try {
    const result = await $fetch(`/api/faceless/style/${id}`)
    if (profileId.value !== id) return
    styleInfo.value = result
    voiceId.value = result.style.voiceId || voiceId.value
    captions.value = result.style.captions.enabled
  } catch {
    styleInfo.value = null
  }
}

watch(profileId, (id) => { loadStyleInfo(id) })
// Persona deja choisie par l adresse (?profile=) : sa DA s applique des l ouverture.
onMounted(() => { if (profileId.value) loadStyleInfo(profileId.value) })

const canGenerate = computed(() => !polling.value && (voiceMode.value === 'own'
  ? Boolean(audioFile.value)
  : idea.value.trim().length > 0 && Boolean(voiceId.value)))
const pollingLabel = computed(() => (pollingKind.value === 'retouch'
  ? 'Retouche du plan, puis nouveau montage…'
  : 'Script, voix puis montage image par image…'))
const elapsedLabel = computed(() => {
  const seconds = Math.max(0, Math.round((now.value - startedAt.value) / 1000))
  return `${Math.floor(seconds / 60)} min ${String(seconds % 60).padStart(2, '0')} s`
})

async function loadInfo(id, fetcher = $fetch) {
  try {
    info.value = await fetcher(`/api/content/${id}/faceless`)
    if (info.value?.imageUrl) videoUrl.value = info.value.imageUrl
    if (info.value?.idea && !idea.value) idea.value = info.value.idea
  } catch {
    info.value = null
  }
}

function stopPolling() {
  if (pollTimer) clearInterval(pollTimer)
  if (clockTimer) clearInterval(clockTimer)
  pollTimer = null
  clockTimer = null
  polling.value = false
}

function startPolling(id, kind) {
  stopPolling()
  pollingKind.value = kind
  polling.value = true
  startedAt.value = Date.now()
  now.value = Date.now()
  clockTimer = setInterval(() => { now.value = Date.now() }, 1000)
  pollTimer = setInterval(() => checkStatus(id), 5000)
}

async function checkStatus(id) {
  try {
    const status = await $fetch(`/api/content/${id}/status`)
    if (!status?.done) return
    stopPolling()
    if (status.failed) {
      // Une retouche ratee garde le rendu precedent : on le laisse affiche.
      lastFailure.value = status.keptPreviousRender
        ? `${status.errorMessage || 'Échec.'} La version précédente est conservée.`
        : (status.errorMessage || 'La vidéo n a pas pu être montée.')
      pushToast({ title: 'Échec', message: lastFailure.value, tone: 'error' })
    } else {
      instruction.value = ''
      pushToast({ title: 'Vidéo prête !', message: 'Elle est aussi dans Mes créations.', tone: 'success' })
    }
    if (status.imageUrl) videoUrl.value = status.imageUrl
    await loadInfo(id)
  } catch {
    // Erreur transitoire : on reessaie au prochain tour.
  }
}

function onAudioChange(event) {
  audioFile.value = event.target?.files?.[0] || null
}

async function makeOutline() {
  outlineError.value = ''
  outlineLoading.value = true
  try {
    outline.value = await $fetch('/api/faceless/outline', {
      method: 'POST',
      body: { idea: idea.value, profileId: profileId.value || undefined, durationSeconds: durationSeconds.value },
    })
  } catch (error) {
    outlineError.value = error?.data?.statusMessage || error?.statusMessage || 'Impossible de préparer la trame.'
  } finally {
    outlineLoading.value = false
  }
}

async function generate() {
  if (voiceMode.value === 'synth' && newIllustrations.value > 0) {
    const max = (Math.round(newIllustrations.value * imageCost.value * 100) / 100).toFixed(2)
    const ok = await requestConfirmation({
      title: 'Autoriser de nouvelles images ?',
      message: `Claude peut générer jusqu'à ${newIllustrations.value} image(s) payante(s) pour cette vidéo, soit ${max} $ au maximum. Elles seront rangées dans le dossier de la persona.`,
      confirmLabel: 'Générer la vidéo',
    })
    if (!ok) return
  }
  errorMessage.value = ''
  lastFailure.value = ''
  videoUrl.value = ''
  info.value = null
  try {
    let response
    if (voiceMode.value === 'own') {
      const form = new FormData()
      form.append('audio', audioFile.value)
      form.append('idea', idea.value)
      if (profileId.value) form.append('profileId', profileId.value)
      form.append('captions', String(captions.value))
      response = await $fetch('/api/generate/faceless-voice', { method: 'POST', body: form })
    } else {
      response = await $fetch('/api/generate/faceless', {
        method: 'POST',
        body: {
          idea: idea.value,
          profileId: profileId.value || undefined,
          voiceId: voiceId.value,
          durationSeconds: durationSeconds.value,
          captions: captions.value,
          illustrations: { maxNew: profileId.value ? newIllustrations.value : 0, confirmCost: newIllustrations.value > 0 },
        },
      })
    }
    contentId.value = response.contentId
    startPolling(response.contentId, 'generate')
  } catch (error) {
    errorMessage.value = error?.data?.statusMessage || error?.statusMessage || 'Impossible de lancer la génération.'
  }
}

async function retouch() {
  lastFailure.value = ''
  try {
    await $fetch(`/api/content/${contentId.value}/faceless-retouch`, {
      method: 'POST',
      body: { instruction: instruction.value, rememberRule: rememberRule.value },
    })
    startPolling(contentId.value, 'retouch')
  } catch (error) {
    lastFailure.value = error?.data?.statusMessage || error?.statusMessage || 'Impossible de lancer la retouche.'
  }
}

// Ouverte depuis Mes créations (?content=...) : on reprend la video existante.
if (contentId.value) {
  await loadInfo(contentId.value, requestFetch)
}

onMounted(() => {
  if (contentId.value && info.value?.status === 'PROCESSING') startPolling(contentId.value, 'retouch')
})

onBeforeUnmount(stopPolling)
</script>
