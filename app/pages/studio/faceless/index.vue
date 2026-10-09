<template>
  <div class="font-ui">
    <header>
      <NuxtLink to="/studio" class="text-xs font-semibold text-ui-accent hover:underline">← Studio</NuxtLink>
      <p class="mt-3 text-xs font-semibold uppercase tracking-[0.08em] text-ui-accent">Studio</p>
      <h1 class="mt-1 text-2xl font-bold tracking-[-0.01em] text-ui-ink">Vidéo faceless</h1>
      <p class="mt-2 max-w-3xl text-sm leading-6 text-ui-ink-2">
        Une voix off, un avatar qui réagit et des cartes animées, dans la direction artistique de ta persona.
        Montage fait par du code : aucun modèle de génération vidéo, seulement quelques centimes de texte et de voix.
      </p>
    </header>

    <div class="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.9fr)]">
      <UiCard>
        <template #title>Ta vidéo</template>

        <div class="space-y-5">
          <UiField
            label="1. Ton idée"
            for-id="faceless-idea"
            hint="Le sujet, l’angle, ce qu’il faut absolument dire. Claude écrit le script et le montage."
          >
            <UiTextarea
              id="faceless-idea"
              v-model="idea"
              :rows="5"
              :maxlength="2000"
              placeholder="Ex. : 3 business simples à lancer avec 0 € : affiliation, produit digital, communauté. Ton motivant, pour des filles de 18-30 ans."
            />
          </UiField>

          <UiField label="Quelle voix ?">
            <UiSegmented v-model="voiceMode" label="Quelle voix ?" :options="VOICE_MODES" />
          </UiField>

          <div v-if="voiceMode === 'own'" class="space-y-4 rounded-ui-card border border-ui-line-soft bg-ui-subtle p-4">
            <p class="text-sm leading-6 text-ui-ink-2">
              Tu enregistres ta voix, le reste est fait pour toi : transcription, suppression des silences et des reprises, puis montage sur ton audio.
              Tu peux dire les changements de montage à voix haute (« là, fond sombre »).
            </p>

            <div>
              <UiButton variant="dark" size="sm" :loading="outlineLoading" :disabled="!idea.trim()" @click="makeOutline">
                {{ outlineLoading ? 'Préparation de la trame…' : (outline ? 'Refaire la trame' : 'Que dire ? Générer la trame') }}
              </UiButton>
              <p v-if="!idea.trim()" class="mt-1.5 text-xs text-ui-ink-muted">Écris d’abord ton idée ci-dessus.</p>
              <UiAlert v-if="outlineError" class="mt-3" title="La trame n’a pas pu être préparée">
                {{ outlineError }}
                <template #action><UiButton variant="secondary" size="sm" @click="makeOutline">Réessayer</UiButton></template>
              </UiAlert>
            </div>

            <div v-if="outline" class="space-y-3 rounded-ui-card border border-ui-line bg-ui-surface p-4">
              <p class="text-[15px] font-semibold text-ui-ink">{{ outline.title || 'Trame à suivre' }}</p>
              <ol class="space-y-4">
                <li v-for="(beat, index) in outline.beats" :key="index" class="text-sm text-ui-ink-2">
                  <p class="font-semibold text-ui-ink">
                    {{ index + 1 }}. {{ beat.label }}
                    <span class="font-ui-mono text-xs font-medium text-ui-ink-muted">~{{ beat.seconds }} s</span>
                  </p>
                  <p class="mt-0.5 text-xs text-ui-ink-muted">{{ beat.goal }}</p>
                  <ul v-if="beat.points.length" class="mt-1 list-disc pl-5">
                    <li v-for="(point, k) in beat.points" :key="k">{{ point }}</li>
                  </ul>
                  <p v-if="beat.example" class="mt-1 italic text-ui-ink">Exemple : « {{ beat.example }} »</p>
                  <p v-if="beat.cue" class="mt-1 text-xs text-ui-accent-ink">À dire à voix haute si tu veux : « {{ beat.cue }} »</p>
                </li>
              </ol>
              <p class="text-xs text-ui-ink-muted">Ce n’est pas un texte à lire : reformule avec tes mots, ça sonnera plus vrai.</p>
            </div>

            <ul class="list-disc space-y-1 pl-5 text-xs text-ui-ink-muted">
              <li v-for="tip in ownVoiceTips" :key="tip">{{ tip }}</li>
            </ul>

            <UiField label="Mon enregistrement" for-id="faceless-audio" :hint="audioFile ? `${audioFile.name} · ${(audioFile.size / 1048576).toFixed(1)} Mo` : 'mp3, wav, m4a, ogg, flac ou webm — 25 Mo maximum.'">
              <input
                id="faceless-audio"
                type="file"
                accept="audio/*,.mp3,.wav,.m4a,.ogg,.flac,.webm"
                class="block w-full text-sm text-ui-ink-2 file:mr-3 file:h-10 file:cursor-pointer file:rounded-ui-ctl file:border file:border-ui-line-input file:bg-ui-surface file:px-4 file:text-sm file:font-semibold file:text-ui-ink hover:file:bg-ui-subtle"
                @change="onAudioChange"
              >
            </UiField>
          </div>

          <div class="grid gap-4 sm:grid-cols-2">
            <div>
              <UiField label="2. Persona (optionnel)" for-id="faceless-profile" hint="Donne son ton et son public au script, et range la vidéo chez elle.">
                <UiSelect id="faceless-profile" v-model="profileId" :options="profileOptions" />
              </UiField>
              <p v-if="!profileId" class="mt-2 text-xs text-ui-ink-muted">
                Sans persona : DA par défaut (papercraft pastel, avatar dessiné). Choisis une persona pour utiliser sa DA.
              </p>
              <div v-else-if="styleInfo" class="mt-2 rounded-ui-ctl border border-ui-line-soft bg-ui-subtle px-3 py-2 text-xs text-ui-ink-2">
                <p>
                  <span class="font-semibold text-ui-ink">DA : {{ styleInfo.style.name }}</span>
                  · avatar : {{ avatarSummary }}
                </p>
                <p class="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                  <NuxtLink :to="`/studio/faceless/style?profile=${profileId}`" class="font-semibold text-ui-accent hover:underline">
                    {{ styleInfo.stored ? 'Modifier la DA →' : 'Créer sa DA →' }}
                  </NuxtLink>
                  <NuxtLink :to="`/library/personas/${profileId}`" class="font-semibold text-ui-accent hover:underline">
                    Dossier de la persona →
                  </NuxtLink>
                </p>
              </div>
            </div>

            <UiField v-if="voiceMode === 'synth'" label="3. Voix" for-id="faceless-voice" hint="Voix ElevenLabs qui parlent français.">
              <UiSelect id="faceless-voice" v-model="voiceId" :options="voiceOptions" />
            </UiField>

            <UiField v-if="voiceMode === 'synth'" label="4. Durée visée" for-id="faceless-duration">
              <UiSelect id="faceless-duration" :model-value="durationSeconds" :options="durationOptions" @update:model-value="durationSeconds = Number($event)" />
            </UiField>

            <label class="flex items-start gap-3 self-end rounded-ui-ctl border border-ui-line bg-ui-surface p-3 text-sm">
              <input v-model="captions" type="checkbox" class="mt-0.5 h-4 w-4 accent-ui-accent">
              <span>
                <span class="font-semibold text-ui-ink">Sous-titres</span>
                <span class="block text-xs text-ui-ink-muted">Seulement quand l’écran ne montre pas déjà les mots dits.</span>
              </span>
            </label>
          </div>

          <div v-if="profileId && voiceMode === 'synth'" class="rounded-ui-ctl border border-ui-line bg-ui-subtle p-3">
            <UiField
              label="5. Illustrations"
              for-id="faceless-new-images"
              :hint="`Le dossier de la persona contient ${styleInfo?.illustrationCount || 0} illustration(s) : Claude les utilise quand elles servent le propos (gratuit).`"
            >
              <UiSelect
                id="faceless-new-images"
                :model-value="newIllustrations"
                :options="newImageOptions"
                @update:model-value="newIllustrations = Number($event)"
              />
            </UiField>
            <p v-if="newIllustrations > 0" class="mt-2 text-xs text-ui-accent-ink">Les nouvelles images sont rangées dans le dossier et réutilisables ensuite.</p>
          </div>

          <div class="flex flex-wrap items-center gap-3 border-t border-ui-line-soft pt-4">
            <UiButton variant="primary" :loading="polling" :disabled="!canGenerate" @click="generate">
              {{ polling ? 'Montage en cours…' : (voiceMode === 'own' ? 'Monter avec ma voix' : 'Générer la vidéo') }}
            </UiButton>
            <p class="text-xs text-ui-ink-muted">
              {{ voiceMode === 'own' ? 'Environ 2 à 4 minutes (transcription, nettoyage, montage).' : 'Environ 1 à 3 minutes.' }}
              Tu peux quitter la page : la vidéo arrive dans Mes créations.
            </p>
          </div>

          <UiAlert v-if="errorMessage" title="La génération n’a pas pu démarrer">{{ errorMessage }}</UiAlert>
        </div>
      </UiCard>

      <UiCard>
        <template #title>Résultat</template>

        <div class="space-y-4">
          <UiAlert v-if="polling" tone="info">{{ pollingLabel }} ({{ elapsedLabel }})</UiAlert>
          <UiAlert v-if="lastFailure" title="Échec">{{ lastFailure }}</UiAlert>

          <div v-if="videoUrl" class="space-y-3">
            <video :key="videoUrl" :src="videoUrl" controls playsinline class="w-full rounded-ui-card border border-ui-line bg-black" />
            <NuxtLink to="/content" class="inline-block text-sm font-semibold text-ui-accent hover:underline">Voir dans Mes créations →</NuxtLink>
          </div>
          <UiEmptyState v-else-if="!polling" title="Pas encore de vidéo" text="La vidéo apparaîtra ici." />

          <div v-if="info?.retouchable && videoUrl && !polling" class="space-y-3 border-t border-ui-line-soft pt-4">
            <UiField
              label="Retoucher"
              for-id="faceless-retouch"
              hint="Dis ce qui ne va pas, comme à un monteur. Si le texte dit ne change pas, la même voix est réutilisée."
            >
              <div class="mb-2 flex flex-wrap gap-2">
                <button
                  v-for="suggestion in RETOUCH_SUGGESTIONS"
                  :key="suggestion"
                  type="button"
                  class="rounded-full border border-ui-line-input bg-ui-surface px-3 py-1.5 text-xs text-ui-ink-2 transition-colors hover:bg-ui-subtle focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ui-accent/20"
                  @click="instruction = suggestion"
                >
                  {{ suggestion }}
                </button>
              </div>
              <UiTextarea
                id="faceless-retouch"
                v-model="instruction"
                :rows="3"
                :maxlength="1000"
                placeholder="Ex. : l’intro a trop de texte, coupe-la en deux écrans. Garde l’avatar qui sourit pendant toute la phrase sur la communauté."
              />
            </UiField>
            <label v-if="info.personaId" class="flex items-start gap-2 text-xs text-ui-ink-2">
              <input v-model="rememberRule" type="checkbox" class="mt-0.5 h-4 w-4 accent-ui-accent">
              <span>Retenir pour les prochaines vidéos de cette persona (ajoute la consigne aux règles de sa DA)</span>
            </label>
            <UiButton variant="dark" :disabled="!instruction.trim() || !info.canRetouchNow" @click="retouch">Créer la version retouchée</UiButton>
            <p v-if="!info.canRetouchNow" class="text-xs text-ui-ink-muted">Seule une vidéo « en attente » peut être retouchée.</p>
            <div v-if="info.retouches?.length" class="text-xs text-ui-ink-muted">
              <p class="font-semibold text-ui-ink-2">Retouches déjà appliquées</p>
              <ol class="mt-1 list-decimal space-y-1 pl-4">
                <li v-for="(item, index) in info.retouches" :key="index">{{ item }}</li>
              </ol>
            </div>
          </div>
          <p v-else-if="info && !info.retouchable && videoUrl && !polling" class="border-t border-ui-line-soft pt-4 text-xs text-ui-ink-muted">
            Cette vidéo a été créée avant les retouches : elle n’a pas de plan de montage enregistré.
          </p>
        </div>
      </UiCard>
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
  { value: 'synth', label: 'Voix de synthèse (Claude écrit le script)' },
  { value: 'own', label: 'Ma propre voix' },
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

// Listes des selects du kit UI.
const profileOptions = computed(() => [
  { value: '', label: 'Aucune (narratrice neutre)' },
  ...profiles.value.map((profile) => ({ value: profile.id, label: profile.name })),
])
const voiceOptions = computed(() => voices.value.map((voice) => ({ value: voice.id, label: voice.label })))
const durationOptions = computed(() => durations.value.map((d) => ({ value: d, label: `${d} secondes` })))
const newImageOptions = computed(() => [
  { value: 0, label: 'Pas de nouvelle image' },
  ...[1, 2, 3].map((n) => ({ value: n, label: `Jusqu’à ${n} nouvelle(s) image(s) — ≈ ${(Math.round(n * imageCost.value * 100) / 100).toFixed(2)} $ au maximum` })),
])

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
