<template>
  <div class="space-y-6">
    <header class="rounded-[20px] border border-[#E5E3DF] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
      <p class="text-xs font-semibold uppercase tracking-[0.22em] text-[#E8873A]">Brand Studio</p>
      <h1 class="mt-2 text-3xl font-bold tracking-tight text-[#111111]">Créez un visuel pour votre campagne</h1>
      <p class="mt-2 text-sm text-[#666666]">Un espace centré sur vos besoins de production visuelle de marque.</p>
    </header>

    <div class="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.9fr)]">
      <section class="rounded-[20px] border border-[#E5E3DF] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
        <label for="brand-prompt" class="text-sm font-bold text-[#111111]">Créez un visuel pour votre campagne</label>
        <textarea
          id="brand-prompt"
          v-model="prompt"
          class="mt-3 w-full rounded-[14px] border border-[#E5E3DF] bg-[#FAFAF8] p-4 text-sm text-[#111111] outline-none focus:border-[#E8873A]"
          style="min-height: 220px;"
          placeholder="Collez votre brief ou décrivez votre scène de campagne..."
        />

        <p v-if="errorMessage" class="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{{ errorMessage }}</p>

        <button
          type="button"
          class="mt-5 rounded-[12px] bg-[#E8873A] px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-[#d4762f] disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="loading || !canGenerate"
          @click="submit"
        >
          {{ loading ? 'Generation...' : 'Generer' }}
        </button>
      </section>

      <aside class="rounded-[20px] border border-[#E5E3DF] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
        <h2 class="text-lg font-bold text-[#111111]">Résultat</h2>
        <p class="mt-2 text-xs text-[#666666]">Le rendu apparaît ici après lancement.</p>

        <div v-if="lastResult" class="mt-4 space-y-3 rounded-[14px] border border-[#E5E3DF] bg-[#FAFAF8] p-4 text-sm text-[#222]">
          <p><strong>Status :</strong> {{ lastResult.status || '-' }}</p>
          <p><strong>Content ID :</strong> {{ lastResult.contentId || '-' }}</p>
          <p><strong>Job ID :</strong> {{ lastResult.jobId || '-' }}</p>
        </div>

        <p v-else class="mt-4 text-sm text-[#777]">Aucun résultat pour le moment.</p>
      </aside>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'

const { pushToast } = useUiFeedback()

const prompt = ref('')
const loading = ref(false)
const errorMessage = ref('')
const lastResult = ref(null)

const { data: influencersData } = await useFetch('/api/influencers', {
  key: 'brand-studio-influencers',
})

const primaryInfluencerId = computed(() => {
  const first = Array.isArray(influencersData.value) ? influencersData.value[0] : null
  return first?.id || ''
})

const canGenerate = computed(() => Boolean(prompt.value.trim() && primaryInfluencerId.value))

async function submit() {
  if (loading.value || !canGenerate.value) return

  loading.value = true
  errorMessage.value = ''

  try {
    lastResult.value = await $fetch('/api/generate/image', {
      method: 'POST',
      body: {
        influencerId: primaryInfluencerId.value,
        workflowType: 'free',
        prompt: prompt.value.trim(),
        contentType: 'feed',
      },
    })

    pushToast({
      title: 'Generation lancée',
      message: 'Le contenu image a bien été envoyé au pipeline.',
      tone: 'success',
    })
  } catch (err) {
    errorMessage.value = err?.data?.statusMessage || err?.message || 'Generation impossible.'
  } finally {
    loading.value = false
  }
}
</script>
