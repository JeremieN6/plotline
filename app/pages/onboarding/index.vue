<template>
  <div class="min-h-screen bg-[#0C0A08] text-[#FFF5EB] px-4 py-10 sm:px-8">
    <div class="mx-auto max-w-4xl">
      <p class="text-xs uppercase tracking-[0.2em] text-[#F2B582]">Onboarding</p>
      <h1 class="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Choisis ton type de compte</h1>
      <p class="mt-3 text-sm text-[#F7D8BF]">Cette sélection personnalise ton espace Plotline.</p>

      <div class="mt-8 grid gap-4 md:grid-cols-3">
        <button
          v-for="card in cards"
          :key="card.value"
          type="button"
          class="rounded-[18px] border p-5 text-left transition-all duration-150"
          :class="selected === card.value
            ? 'border-[#E8873A] bg-[#1B120C] shadow-[0_0_0_2px_rgba(232,135,58,0.25)]'
            : 'border-[#3A2A1E] bg-[#120C07] hover:border-[#A06E46]'"
          @click="selected = card.value"
        >
          <p class="text-2xl">{{ card.icon }}</p>
          <h2 class="mt-3 text-lg font-bold text-white">{{ card.title }}</h2>
          <p class="mt-2 text-sm leading-relaxed text-[#F5D4B8]">{{ card.subtitle }}</p>
        </button>
      </div>

      <p v-if="errorMessage" class="mt-5 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
        {{ errorMessage }}
      </p>

      <div class="mt-8 flex justify-end">
        <button
          type="button"
          class="rounded-[12px] bg-[#E8873A] px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-[#d4762f] disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="!selected || loading"
          @click="submit"
        >
          {{ loading ? 'Enregistrement...' : 'Continuer' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const router = useRouter()
const { refreshAuth } = useAuthSession()

const selected = ref('')
const loading = ref(false)
const errorMessage = ref('')

const cards = [
  {
    value: 'INFLUENCER_CREATOR',
    icon: '🎭',
    title: 'Créateur·ice d\'identités virtuelles',
    subtitle: 'Tu crées et gères des personas digitaux avec une cohérence visuelle parfaite, post après post.',
  },
  {
    value: 'CONTENT_CREATOR',
    icon: '✨',
    title: 'Créateur·ice de contenu',
    subtitle: 'Tu génères des visuels et vidéos IA pour ton activité, ta marque personnelle ou tes clients.',
  },
  {
    value: 'BRAND',
    icon: '🏢',
    title: 'Marque & Entreprise',
    subtitle: 'Tu crées des visuels cohérents pour tes campagnes avec une ambassadrice digitale reconnaissable.',
  },
]

const nextPathByType = {
  INFLUENCER_CREATOR: '/onboarding/influencer-creator',
  CONTENT_CREATOR: '/influencers/new',
  BRAND: '/onboarding/brand',
}

async function submit() {
  if (!selected.value || loading.value) return

  loading.value = true
  errorMessage.value = ''

  try {
    await $fetch('/api/user/account-type', {
      method: 'PATCH',
      body: { accountType: selected.value },
    })

    await refreshAuth({ force: true })
    await router.push(nextPathByType[selected.value] || '/onboarding')
  } catch (err) {
    errorMessage.value = err?.data?.statusMessage || err?.message || 'Impossible d enregistrer votre choix.'
  } finally {
    loading.value = false
  }
}
</script>
