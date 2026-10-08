<template>
  <div class="space-y-6">
    <header class="rounded-[20px] border border-[#E5E3DF] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
      <NuxtLink to="/studio" class="text-xs font-semibold text-[#B45F1D] hover:underline">← Studio</NuxtLink>
      <p class="mt-3 text-xs font-semibold uppercase tracking-[0.22em] text-[#E8873A]">Studio</p>
      <h1 class="mt-2 text-3xl font-bold tracking-tight text-[#111111]">Vidéo faceless</h1>
      <p class="mt-2 text-sm text-[#666666]">
        Une voix off, un avatar dessiné qui réagit et des cartes papier animées. Montage fait par du code :
        aucun modèle de génération vidéo, seulement quelques centimes de texte et de voix.
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
          </div>

          <div>
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

          <div>
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

        <div class="flex flex-wrap items-center gap-3 border-t border-[#F0EEEA] pt-4">
          <button
            type="button"
            class="rounded-[12px] bg-[#E8873A] px-5 py-2.5 text-sm font-bold text-white shadow-[0_1px_2px_rgba(0,0,0,0.12)] transition-colors hover:bg-[#D97629] disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="!canGenerate"
            @click="generate"
          >
            {{ polling ? 'Montage en cours…' : 'Générer la vidéo' }}
          </button>
          <p class="text-xs text-[#666666]">Environ 1 à 3 minutes. Tu peux quitter la page : la vidéo arrive dans Mes créations.</p>
        </div>

        <p v-if="errorMessage" class="rounded-[12px] border border-[#F3C1C1] bg-[#FFF4F4] p-3 text-sm text-[#A33]">{{ errorMessage }}</p>
      </section>

      <aside class="rounded-[20px] border border-[#E5E3DF] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
        <p class="text-sm font-semibold text-[#111111]">Résultat</p>
        <div v-if="polling" class="mt-4 rounded-[14px] border border-[#F2CCAA] bg-[#FFF5EC] p-4 text-sm text-[#B45F1D]">
          Script, voix puis montage image par image… ({{ elapsedLabel }})
        </div>
        <div v-else-if="result && !result.failed && result.imageUrl" class="mt-4 space-y-3">
          <video :src="result.imageUrl" controls playsinline class="w-full rounded-[14px] border border-[#E5E3DF] bg-black" />
          <NuxtLink to="/content" class="inline-block text-sm font-semibold text-[#B45F1D] hover:underline">Voir dans Mes créations →</NuxtLink>
        </div>
        <p v-else-if="result && result.failed" class="mt-4 text-sm text-[#A33]">{{ result.errorMessage || 'La génération a échoué.' }}</p>
        <p v-else class="mt-4 text-sm text-[#888]">La vidéo apparaîtra ici.</p>
      </aside>
    </div>
  </div>
</template>

<script setup>
useSeoMeta({ title: 'Vidéo faceless' })

const { pushToast } = useUiFeedback()

const idea = ref('')
const profileId = ref('')
const voiceId = ref('')
const durationSeconds = ref(30)
const captions = ref(true)
const errorMessage = ref('')
const result = ref(null)
const polling = ref(false)
const startedAt = ref(0)
const now = ref(Date.now())
let pollTimer = null
let clockTimer = null

const { data: profilesData } = await useFetch('/api/profiles', { key: 'faceless-profiles' })
const { data: options } = await useFetch('/api/faceless/options', { key: 'faceless-options' })

const profiles = computed(() => (Array.isArray(profilesData.value) ? profilesData.value : []))
const voices = computed(() => options.value?.voices || [])
const durations = computed(() => options.value?.durations || [20, 30, 45, 60])

watch(options, (value) => {
  if (!voiceId.value && value?.defaultVoiceId) voiceId.value = value.defaultVoiceId
}, { immediate: true })

const canGenerate = computed(() => idea.value.trim().length > 0 && Boolean(voiceId.value) && !polling.value)
const elapsedLabel = computed(() => {
  const seconds = Math.max(0, Math.round((now.value - startedAt.value) / 1000))
  return `${Math.floor(seconds / 60)} min ${String(seconds % 60).padStart(2, '0')} s`
})

function stopPolling() {
  if (pollTimer) clearInterval(pollTimer)
  if (clockTimer) clearInterval(clockTimer)
  pollTimer = null
  clockTimer = null
  polling.value = false
}

async function checkStatus(contentId) {
  try {
    const status = await $fetch(`/api/content/${contentId}/status`)
    if (!status?.done) return
    stopPolling()
    result.value = status
    pushToast(status.failed
      ? { title: 'Génération échouée', message: status.errorMessage || 'La vidéo n a pas pu être montée.', tone: 'error' }
      : { title: 'Vidéo prête !', message: 'Elle est aussi dans Mes créations.', tone: 'success' })
  } catch {
    // Erreur transitoire : on reessaie au prochain tour.
  }
}

async function generate() {
  errorMessage.value = ''
  result.value = null
  try {
    const response = await $fetch('/api/generate/faceless', {
      method: 'POST',
      body: {
        idea: idea.value,
        profileId: profileId.value || undefined,
        voiceId: voiceId.value,
        durationSeconds: durationSeconds.value,
        captions: captions.value,
      },
    })
    polling.value = true
    startedAt.value = Date.now()
    now.value = Date.now()
    clockTimer = setInterval(() => { now.value = Date.now() }, 1000)
    pollTimer = setInterval(() => checkStatus(response.contentId), 5000)
  } catch (error) {
    errorMessage.value = error?.data?.statusMessage || error?.statusMessage || 'Impossible de lancer la génération.'
  }
}

onBeforeUnmount(stopPolling)
</script>
