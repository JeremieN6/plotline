<template>
  <div class="min-h-screen bg-[#FAFAF8] text-[#111111]">
    <div class="mx-auto flex min-h-screen w-full max-w-[1680px] flex-col lg:flex-row">
      <header class="sticky top-0 z-30 border-b border-[#E5E3DF] bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
        <div class="flex items-center justify-between gap-3">
          <button
            type="button"
            class="rounded-[10px] border border-[#E5E3DF] bg-white px-3 py-2 text-sm font-bold text-[#111111]"
            @click="mobileMenuOpen = true"
          >
            <Icon name="lucide:menu" />
          </button>

          <div class="flex items-center gap-3">
            <div class="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#E8873A] text-sm font-bold text-white shadow-[0_1px_3px_rgba(0,0,0,0.12)]">
              P
            </div>
            <!-- <div>
              <p class="text-base font-bold tracking-tight text-[#111111]">Plotline</p>
              <p class="text-xs text-[#666666]">Back office SaaS</p>
            </div> -->
          </div>
        </div>
      </header>

      <div
        v-if="mobileMenuOpen"
        class="fixed inset-0 z-40 bg-black/45 lg:hidden"
        @click="mobileMenuOpen = false"
      />

      <aside
        class="fixed inset-y-0 left-0 z-50 w-[280px] border-r border-[#E5E3DF] bg-white/95 backdrop-blur transition-transform duration-200 lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:w-[240px] lg:flex-shrink-0 lg:translate-x-0"
        :class="mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'"
      >
        <div class="flex h-full flex-col px-4 py-5">
          <div class="mb-6 flex items-center justify-between gap-3 px-1">
            <div class="flex items-center gap-3">
              <div class="flex h-10 w-10 items-center justify-center rounded-[12px] bg-[#E8873A] text-sm font-bold text-white shadow-[0_1px_3px_rgba(0,0,0,0.12)]">
                P
              </div>
              <div>
                <p class="text-lg font-bold tracking-tight text-[#111111]">Plotline</p>
                <p class="text-xs text-[#666666]">Back office SaaS</p>
              </div>
            </div>

            <button
              type="button"
              class="rounded-[10px] border border-[#E5E3DF] bg-white px-3 py-2 text-sm font-bold text-[#111111] lg:hidden"
              @click="mobileMenuOpen = false"
            >
              ✕
            </button>
          </div>

          <div class="plotline-switcher relative mb-5">
            <p class="mb-2 px-1 text-xs font-semibold uppercase tracking-[0.16em] text-[#666666]">{{ switcherLabel }}</p>
            <button
              type="button"
              class="flex w-full items-center gap-3 rounded-[12px] border border-[#E5E3DF] bg-[#FAFAF8] px-3 py-3 text-left shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-all duration-150 hover:border-[#E8873A]/40 hover:bg-white"
              @click="switcherOpen = !switcherOpen"
            >
              <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#E8873A] text-sm font-bold text-white shadow-sm">
                {{ activeInfluencerInitial }}
              </div>
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-bold text-[#111111]">{{ activeInfluencerName }}</p>
                <p class="truncate text-xs text-[#666666]">{{ activeInfluencerNiche }}</p>
              </div>
              <span class="text-xs text-[#999999]">▾</span>
            </button>

            <div
              v-if="switcherOpen"
              class="absolute left-0 right-0 top-[calc(100%+10px)] z-20 overflow-hidden rounded-[12px] border border-[#E5E3DF] bg-white shadow-[0_10px_30px_rgba(17,17,17,0.08)]"
            >
              <div class="max-h-72 overflow-y-auto p-2">
                <button
                  v-for="influencer in influencers"
                  :key="influencer.id"
                  type="button"
                  class="flex w-full items-center gap-3 rounded-[12px] px-3 py-2.5 text-left transition-colors duration-150 hover:bg-[#FAFAF8]"
                  @click="selectInfluencer(influencer.id)"
                >
                  <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#E8873A] text-sm font-bold text-white">
                    {{ avatarLetter(influencer.name) }}
                  </div>
                  <div class="min-w-0 flex-1">
                    <p class="truncate text-sm font-semibold text-[#111111]">{{ influencer.name }}</p>
                    <p class="truncate text-xs text-[#666666]">{{ profileSecondaryLabel(influencer) }}</p>
                  </div>
                  <span
                    v-if="influencer.id === activeInfluencerId"
                    class="rounded-full bg-[#FDE7D6] px-2 py-1 text-[11px] font-bold text-[#B45F1D]"
                  >
                    Actif
                  </span>
                </button>
              </div>
              <div class="border-t border-[#E5E3DF] p-2">
                <template v-if="isContentCreator">
                  <NuxtLink
                    to="/influencers/new"
                    class="flex items-center justify-center gap-2 rounded-[12px] border border-dashed border-[#E8873A]/40 px-3 py-2 text-sm font-bold text-[#E8873A] transition-colors duration-150 hover:bg-[#FDF3EA]"
                    @click="switcherOpen = false; mobileMenuOpen = false"
                  >
                    <span class="text-lg leading-none">+</span>
                    Nouveau profil
                  </NuxtLink>
                </template>
                <template v-else-if="isBrand">
                  <NuxtLink
                    to="/brand-studio?newCampaign=1"
                    class="mb-2 flex items-center justify-center gap-2 rounded-[12px] border border-dashed border-[#E8873A]/40 px-3 py-2 text-sm font-bold text-[#E8873A] transition-colors duration-150 hover:bg-[#FDF3EA]"
                    @click="switcherOpen = false; mobileMenuOpen = false"
                  >
                    <span class="text-lg leading-none">+</span>
                    Nouvelle campagne
                  </NuxtLink>
                  <NuxtLink
                    to="/influencers/new"
                    class="flex items-center justify-center gap-2 rounded-[12px] border border-dashed border-[#E5E3DF] px-3 py-2 text-sm font-bold text-[#111111] transition-colors duration-150 hover:bg-[#FAFAF8]"
                    @click="switcherOpen = false; mobileMenuOpen = false"
                  >
                    <span class="text-lg leading-none">+</span>
                    Nouvelle ambassadrice
                  </NuxtLink>
                </template>
                <NuxtLink
                  v-else
                  to="/influencers/new"
                  class="flex items-center justify-center gap-2 rounded-[12px] border border-dashed border-[#E8873A]/40 px-3 py-2 text-sm font-bold text-[#E8873A] transition-colors duration-150 hover:bg-[#FDF3EA]"
                  @click="switcherOpen = false; mobileMenuOpen = false"
                >
                  <span class="text-lg leading-none">+</span>
                  {{ addAmbassadorLabel }}
                </NuxtLink>
              </div>
            </div>
          </div>

          <nav class="flex flex-1 flex-col gap-2">
            <template v-for="item in navigation" :key="item.to">
              <button
                v-if="item.disabled"
                type="button"
                :class="navClass(item)"
                class="flex items-center justify-between rounded-[12px] px-3 py-2.5 text-sm font-semibold transition-all duration-150"
                disabled
              >
                <span>{{ item.label }}</span>
                <span
                  v-if="item.badge"
                  class="rounded-full bg-[#F4EFE8] px-2 py-0.5 text-[11px] font-bold text-[#B45F1D]"
                >
                  {{ item.badge }}
                </span>
              </button>

              <NuxtLink
                v-else
                :to="item.to"
                :class="navClass(item)"
                class="flex items-center justify-between rounded-[12px] px-3 py-2.5 text-sm font-semibold transition-all duration-150"
                @click="mobileMenuOpen = false"
              >
                <span>{{ item.label }}</span>
                <span
                  v-if="item.badge"
                  class="rounded-full bg-[#F4EFE8] px-2 py-0.5 text-[11px] font-bold text-[#B45F1D]"
                >
                  {{ item.badge }}
                </span>
              </NuxtLink>
            </template>
          </nav>

          <div class="mt-6 border-t border-[#E5E3DF] pt-4">
            <div class="rounded-[12px] border border-[#E5E3DF] bg-[#FAFAF8] p-3">
              <NuxtLink
                to="/settings"
                class="flex items-center gap-3 rounded-[10px] px-2 py-2 transition-colors duration-150 hover:bg-white"
                @click="mobileMenuOpen = false"
              >
                <div class="flex h-10 w-10 items-center justify-center rounded-full bg-[#111111] text-sm font-bold text-white">
                  {{ userInitial }}
                </div>
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-semibold text-[#111111]">{{ userEmail }}</p>
                  <p class="text-xs text-[#666666]">Compte connecté</p>
                </div>
              </NuxtLink>

              <button
                type="button"
                class="mt-2 inline-flex w-full items-center justify-center rounded-[10px] border border-[#E5E3DF] bg-white px-3 py-2 text-xs font-bold text-[#111111] transition-colors duration-150 hover:bg-[#F6F3EE]"
                @click="logout"
              >
                Se déconnecter
              </button>
            </div>
          </div>
        </div>
      </aside>

      <main class="min-w-0 flex-1 px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
        <div :class="showOnboardingModal ? 'pointer-events-none select-none blur-[2px] opacity-40' : ''">
          <slot />
        </div>

        <transition
          enter-active-class="transition duration-200 ease-out"
          enter-from-class="opacity-0 scale-[0.98]"
          enter-to-class="opacity-100 scale-100"
          leave-active-class="transition duration-150 ease-in"
          leave-from-class="opacity-100 scale-100"
          leave-to-class="opacity-0 scale-[0.98]"
        >
          <div
            v-if="showOnboardingModal"
            class="fixed inset-0 z-[70] flex items-center justify-center bg-[#0E0B07]/55 p-5 backdrop-blur-[2px]"
          >
            <div class="relative w-full max-w-xl overflow-hidden rounded-[28px] border border-[#F4CDA9]/40 bg-[#19110A] text-[#FFF4E6] shadow-[0_28px_80px_rgba(0,0,0,0.45)]">
              <div class="absolute inset-0 bg-[radial-gradient(circle_at_18%_15%,rgba(232,135,58,0.28),transparent_48%),radial-gradient(circle_at_86%_4%,rgba(246,177,102,0.18),transparent_38%)]" />

              <div class="relative p-7 sm:p-9">
                <p class="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#F6B37A]">Onboarding</p>
                <h2 class="mt-3 text-3xl font-black tracking-tight text-white">Crée ta première {{ wording.ambassador }}</h2>
                <p class="mt-3 text-sm leading-relaxed text-[#F7D8BF]">
                  Ton workspace est prêt, mais il n y a encore aucune identité active. Ajoute une première {{ wording.ambassador }} pour débloquer le dashboard, le calendrier et la génération.
                </p>

                <div class="mt-6 grid gap-3 rounded-[16px] border border-[#3A2A1E] bg-[#120C07]/85 p-4 text-sm">
                  <p class="font-semibold text-white">Ce que tu vas configurer maintenant :</p>
                  <ol class="space-y-2 text-[#F5D4B8]">
                    <li>Nom et niche de ton {{ wording.visualIdentity }}</li>
                    <li>Style visuel de base</li>
                    <li>Cohérence Faciale pour verrouiller l'identité</li>
                  </ol>
                </div>

                <div class="mt-7 flex flex-col gap-3 sm:flex-row">
                  <NuxtLink
                    to="/influencers/new"
                    class="inline-flex flex-1 items-center justify-center rounded-[12px] bg-[#E8873A] px-4 py-3 text-sm font-bold text-white transition-all duration-150 hover:-translate-y-0.5 hover:bg-[#d4762f]"
                  >
                    {{ createAmbassadorLabel }}
                  </NuxtLink>
                  <button
                    type="button"
                    class="inline-flex items-center justify-center rounded-[12px] border border-[#5C4633] bg-transparent px-4 py-3 text-sm font-bold text-[#F8DCC3] transition-colors duration-150 hover:bg-[#2A1C12]"
                    @click="logout"
                  >
                    Changer de compte
                  </button>
                </div>
              </div>
            </div>
          </div>
        </transition>
      </main>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
const { user, refreshAuth } = useAuthSession()
const { wording } = useWording()
const activeInfluencerId = useActiveInfluencer()
const switcherOpen = ref(false)
const mobileMenuOpen = ref(false)

const { data: influencersData } = await useFetch('/api/influencers', {
  key: 'plotline-shell-influencers',
})

const influencers = computed(() => influencersData.value || [])
const activeInfluencer = computed(() => {
  return influencers.value.find((item) => item.id === activeInfluencerId.value) || influencers.value[0] || null
})
const accountType = computed(() => String(user.value?.accountType || '').trim().toUpperCase())
const isInfluencerCreator = computed(() => accountType.value === 'INFLUENCER_CREATOR')
const isContentCreator = computed(() => accountType.value === 'CONTENT_CREATOR')
const isBrand = computed(() => accountType.value === 'BRAND')
const activeInfluencerName = computed(() => activeInfluencer.value?.name || `Choisir une ${wording.value.ambassador}`)
const activeInfluencerNiche = computed(() => summarizeNiches(activeInfluencer.value?.niche) || 'Aucune niche renseignée')
const activeInfluencerInitial = computed(() => avatarLetter(activeInfluencer.value?.name || 'P'))
const userEmail = computed(() => String(user.value?.email || 'compte@plotline.local'))
const userInitial = computed(() => avatarLetter(user.value?.email || 'U'))
const switcherLabel = computed(() => {
  if (isContentCreator.value) return 'Profils de création'
  if (isBrand.value) return 'Mes ambassadrices'
  return 'Mes influenceuses'
})
const addAmbassadorLabel = computed(() => {
  if (isBrand.value) return 'Nouvelle ambassadrice'
  if (isContentCreator.value) return 'Nouveau profil'
  return 'Nouvelle influenceuse'
})
const createAmbassadorLabel = computed(() => {
  if (isBrand.value) return 'Créer une ambassadrice'
  if (isContentCreator.value) return 'Créer une ambassadrice'
  return 'Créer une influenceuse'
})
const activeProfileTypeLabel = computed(() => {
  const hasFaceRef = Boolean(String(activeInfluencer.value?.faceRefPath || '').trim())
  return hasFaceRef ? wording.value.ambassador : 'marque'
})
const settingsNavLabel = computed(() => {
  if (!activeInfluencer.value) return `Paramètres ${wording.value.ambassador}`
  return `Paramètres ${activeProfileTypeLabel.value}`
})
const showOnboardingModal = computed(() => {
  if (!isInfluencerCreator.value) return false
  if (route.path.startsWith('/onboarding')) return false
  if (route.path.startsWith('/influencers/new')) return false
  return influencers.value.length === 0
})

const routeInfluencerId = computed(() => {
  const segments = String(route.path || '').split('/').filter(Boolean)
  if (segments[0] !== 'influencers') return ''
  const rawId = segments[1] || ''
  if (!rawId || rawId === 'new') return ''
  return rawId
})

const navigation = computed(() => {
  const settingsItem = {
    label: settingsNavLabel.value,
    to: activeInfluencer.value ? `/influencers/${activeInfluencer.value.id}/edit` : '/influencers/new',
    disabled: !activeInfluencer.value,
  }

  if (isContentCreator.value) {
    return [
      { label: 'Accueil', to: '/dashboard' },
      { label: 'Studio', to: '/studio' },
      { label: 'Mes créations', to: '/content' },
      { label: 'Calendrier', to: '/calendar' },
      { label: 'Analytics', to: '/analytics', badge: 'Bientôt', disabled: true },
      settingsItem,
    ]
  }

  if (isBrand.value) {
    return [
      { label: 'Accueil', to: '/dashboard' },
      { label: 'Brand Studio', to: '/brand-studio' },
      { label: 'Mes ambassadrices', to: '/influencers' },
      { label: 'Calendrier', to: '/calendar' },
      { label: 'Analytics', to: '/analytics', badge: 'Bientôt', disabled: true },
      settingsItem,
    ]
  }

  return [
    { label: 'Accueil', to: '/dashboard' },
    { label: 'Générer', to: activeInfluencer.value ? `/influencers/${activeInfluencer.value.id}/generate` : '/influencers', disabled: !activeInfluencer.value },
    { label: 'Contenu', to: '/content' },
    { label: 'Calendrier', to: '/calendar' },
    { label: 'Analytics', to: '/analytics', badge: 'Bientôt', disabled: true },
    settingsItem,
  ]
})

watch(
  influencers,
  (list) => {
    if (!activeInfluencerId.value && list.length) {
      activeInfluencerId.value = list[0].id
    }
  },
  { immediate: true },
)

watch(
  routeInfluencerId,
  (value) => {
    if (value && activeInfluencerId.value !== value) {
      activeInfluencerId.value = value
    }
  },
  { immediate: true },
)

watch(
  () => route.fullPath,
  () => {
    switcherOpen.value = false
    mobileMenuOpen.value = false
  },
)

watch(mobileMenuOpen, (open) => {
  if (!process.client) return
  document.body.style.overflow = open ? 'hidden' : ''
})

function avatarLetter(value) {
  return String(value || 'P').trim().charAt(0).toUpperCase() || 'P'
}

function profileSecondaryLabel(influencer) {
  if (isContentCreator.value || isBrand.value) {
    const hasFaceRef = Boolean(String(influencer?.faceRefPath || '').trim())
    return hasFaceRef ? `Profil ${wording.value.ambassador}` : 'Profil marque'
  }

  return summarizeNiches(influencer?.niche) || 'Sans niche'
}

function buildInfluencerScopedPath(path, influencerId) {
  const segments = String(path || '').split('/').filter(Boolean)
  if (segments[0] !== 'influencers') return null
  if (!segments[1] || segments[1] === 'new') return null

  segments[1] = influencerId
  return `/${segments.join('/')}`
}

async function selectInfluencer(id) {
  activeInfluencerId.value = id

  const scopedPath = buildInfluencerScopedPath(route.path, id)
  if (scopedPath && scopedPath !== route.path) {
    await router.replace({ path: scopedPath, query: route.query, hash: route.hash })
  }

  switcherOpen.value = false
}

async function logout() {
  await $fetch('/api/auth/logout', { method: 'POST' })
  await refreshAuth({ force: true })
  await router.push('/auth/login')
}

function navClass(item) {
  const isActive = route.path === item.to || route.path.startsWith(`${item.to}/`)
  if (item.disabled) {
    return 'cursor-not-allowed border border-transparent text-[#111111] opacity-50 hover:bg-transparent'
  }
  return isActive
    ? 'bg-[#111111] text-white shadow-[0_1px_3px_rgba(0,0,0,0.10)]'
    : 'text-[#111111] hover:bg-[#FAFAF8] hover:text-[#111111]'
}

function handleOutsideClick(event) {
  const target = event.target
  if (!switcherOpen.value) return
  if (!(target instanceof Element)) return
  if (target.closest('.plotline-switcher')) return
  switcherOpen.value = false
}

onMounted(() => {
  document.addEventListener('click', handleOutsideClick)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleOutsideClick)
  if (process.client) {
    document.body.style.overflow = ''
  }
})
</script>
