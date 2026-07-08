<template>
  <div class="min-h-screen bg-[#090B10] text-[#ECEFF8]">
    <div class="mx-auto flex min-h-screen w-full max-w-[1760px] flex-col lg:flex-row">
      <header class="sticky top-0 z-30 border-b border-white/10 bg-[#0C1018]/95 px-4 py-3 backdrop-blur lg:hidden">
        <div class="flex items-center justify-between gap-3">
          <button
            type="button"
            class="rounded-[10px] border border-white/15 bg-white/5 px-3 py-2 text-sm font-bold text-[#ECEFF8]"
            @click="mobileMenuOpen = true"
          >
            <Icon name="lucide:menu" />
          </button>

          <div class="flex items-center gap-3">
            <div class="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#E8873A] text-sm font-black text-[#1A0F06] shadow-[0_8px_26px_rgba(232,135,58,0.28)]">
              P
            </div>
            <p class="text-sm font-semibold text-white">Home</p>
          </div>
        </div>
      </header>

      <div
        v-if="mobileMenuOpen"
        class="fixed inset-0 z-40 bg-black/60 lg:hidden"
        @click="mobileMenuOpen = false"
      />

      <aside
        class="fixed inset-y-0 left-0 z-50 w-[292px] border-r border-white/10 bg-[linear-gradient(180deg,#0F141F_0%,#0C1018_100%)] backdrop-blur transition-transform duration-200 lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:w-[252px] lg:flex-shrink-0 lg:translate-x-0"
        :class="mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'"
      >
        <div class="flex h-full flex-col px-4 py-5">
          <div class="mb-6 flex items-center justify-between gap-3 px-1">
            <div class="flex items-center gap-3">
              <div class="flex h-10 w-10 items-center justify-center rounded-[12px] bg-[#E8873A] text-sm font-black text-[#1A0F06] shadow-[0_10px_24px_rgba(232,135,58,0.35)]">
                P
              </div>
              <div>
                <p class="text-lg font-black tracking-tight text-white">Plotline</p>
                <p class="text-xs text-[#A5B1C8]">Workspace</p>
              </div>
            </div>

            <button
              type="button"
              class="rounded-[10px] border border-white/15 bg-white/5 px-3 py-2 text-sm font-bold text-[#ECEFF8] lg:hidden"
              @click="mobileMenuOpen = false"
            >
              ✕
            </button>
          </div>

          <div class="plotline-switcher relative mb-4">
            <button
              type="button"
              class="flex w-full items-center gap-3 rounded-[14px] border border-white/10 bg-white/5 px-3 py-3 text-left shadow-[0_1px_2px_rgba(0,0,0,0.2)] transition-all duration-150 hover:border-[#E8873A]/55 hover:bg-white/10"
              @click="switcherOpen = !switcherOpen"
            >
              <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#E8873A] text-sm font-black text-[#1A0F06] shadow-[0_6px_16px_rgba(232,135,58,0.3)]">
                {{ activeInfluencerInitial }}
              </div>
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-bold text-white">{{ activeInfluencerName }}</p>
                <p class="truncate text-xs text-[#A5B1C8]">{{ activeInfluencerNiche }}</p>
              </div>
              <span class="text-xs text-[#92A0B8]">▾</span>
            </button>

            <div
              v-if="switcherOpen"
              class="absolute left-0 right-0 top-[calc(100%+10px)] z-20 overflow-hidden rounded-[14px] border border-white/15 bg-[#101725] shadow-[0_18px_46px_rgba(0,0,0,0.45)]"
            >
              <div class="max-h-72 overflow-y-auto p-2">
                <button
                  v-for="influencer in influencers"
                  :key="influencer.id"
                  type="button"
                  class="flex w-full items-center gap-3 rounded-[12px] px-3 py-2.5 text-left transition-colors duration-150 hover:bg-white/8"
                  @click="selectInfluencer(influencer.id)"
                >
                  <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#E8873A] text-sm font-black text-[#1A0F06]">
                    {{ avatarLetter(influencer.name) }}
                  </div>
                  <div class="min-w-0 flex-1">
                    <p class="truncate text-sm font-semibold text-[#F6F8FC]">{{ influencer.name }}</p>
                    <p class="truncate text-xs text-[#9BABCA]">{{ summarizeNiches(influencer.niche) || 'Sans niche' }}</p>
                  </div>
                  <span
                    v-if="influencer.id === activeInfluencerId"
                    class="rounded-full bg-[#F4B27A]/20 px-2 py-1 text-[11px] font-bold text-[#F7B26A]"
                  >
                    Actif
                  </span>
                </button>
              </div>
              <div class="border-t border-white/12 p-2">
                <NuxtLink
                  to="/influencers/new"
                  class="flex items-center justify-center gap-2 rounded-[12px] border border-dashed border-[#E8873A]/45 bg-white/5 px-3 py-2 text-sm font-bold text-[#F4B27A] transition-colors duration-150 hover:bg-[#E8873A]/18"
                  @click="switcherOpen = false; mobileMenuOpen = false"
                >
                  <span class="text-lg leading-none">+</span>
                  Nouvelle influenceuse
                </NuxtLink>
              </div>
            </div>
          </div>

          <button
            type="button"
            class="mb-4 inline-flex items-center gap-2 rounded-[12px] border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-[#C9D2E6]"
          >
            <Icon name="lucide:search" class="h-4 w-4" />
            <span class="flex-1 text-left">Search...</span>
            <span class="rounded border border-white/15 px-1.5 py-0.5 text-[10px]">CTRL K</span>
          </button>

          <nav class="flex flex-1 flex-col gap-2">
            <template v-for="item in navigation" :key="item.to">
              <button
                v-if="item.disabled"
                type="button"
                :class="navClass(item)"
                class="flex items-center justify-between rounded-[12px] px-3 py-2.5 text-sm font-semibold transition-all duration-150"
                disabled
              >
                <span class="inline-flex items-center gap-2">
                  <Icon v-if="item.icon" :name="item.icon" class="h-4 w-4" />
                  <span>{{ item.label }}</span>
                </span>
                <span
                  v-if="item.badge"
                  class="rounded-full bg-[#F4B27A]/18 px-2 py-0.5 text-[11px] font-bold text-[#F5B879]"
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
                <span class="inline-flex items-center gap-2">
                  <Icon v-if="item.icon" :name="item.icon" class="h-4 w-4" />
                  <span>{{ item.label }}</span>
                </span>
                <span
                  v-if="item.badge"
                  class="rounded-full bg-[#F4B27A]/18 px-2 py-0.5 text-[11px] font-bold text-[#F5B879]"
                >
                  {{ item.badge }}
                </span>
              </NuxtLink>

              <div
                v-if="item.to === '/settings' && route.path.startsWith('/settings')"
                class="ml-6 mt-1 space-y-1"
              >
                <NuxtLink
                  v-for="sub in settingsLinks"
                  :key="sub.label"
                  :to="sub.to"
                  class="block rounded-[10px] px-3 py-2 text-sm text-[#AEB9D0] transition-colors hover:bg-white/8 hover:text-white"
                  :class="route.path === sub.to ? 'bg-white/10 text-white' : ''"
                  @click="mobileMenuOpen = false"
                >
                  {{ sub.label }}
                </NuxtLink>
              </div>
            </template>
          </nav>

          <div class="mt-6 border-t border-white/10 pt-4">
            <div class="rounded-[14px] border border-white/10 bg-white/5 p-3">
              <NuxtLink
                to="/settings"
                class="flex items-center gap-3 rounded-[10px] px-2 py-2 transition-colors duration-150 hover:bg-white/8"
                @click="mobileMenuOpen = false"
              >
                <div class="flex h-10 w-10 items-center justify-center rounded-full bg-[#1B2437] text-sm font-bold text-white">
                  {{ userInitial }}
                </div>
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-semibold text-[#F5F7FC]">{{ userEmail }}</p>
                  <p class="text-xs text-[#9CABCB]">Compte connecté</p>
                </div>
              </NuxtLink>

              <button
                type="button"
                class="mt-2 inline-flex w-full items-center justify-center rounded-[10px] border border-white/15 bg-white/5 px-3 py-2 text-xs font-bold text-[#EBEEF8] transition-colors duration-150 hover:bg-white/10"
                @click="logout"
              >
                Se déconnecter
              </button>
            </div>
          </div>
        </div>
      </aside>

      <main class="min-w-0 flex-1 bg-[radial-gradient(circle_at_15%_0%,rgba(232,135,58,0.14),transparent_32%),radial-gradient(circle_at_85%_0%,rgba(56,189,248,0.08),transparent_28%),linear-gradient(180deg,#0D111A_0%,#090C13_100%)] px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
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
                <h2 class="mt-3 text-3xl font-black tracking-tight text-white">Crée ta première influenceuse</h2>
                <p class="mt-3 text-sm leading-relaxed text-[#F7D8BF]">
                  Ton workspace est prêt, mais il n y a encore aucune identité active. Ajoute une première influenceuse pour débloquer le dashboard, le calendrier et la génération.
                </p>

                <div class="mt-6 grid gap-3 rounded-[16px] border border-[#3A2A1E] bg-[#120C07]/85 p-4 text-sm">
                  <p class="font-semibold text-white">Ce que tu vas configurer maintenant :</p>
                  <ul class="space-y-2 text-[#F5D4B8]">
                    <li>Nom et niche de l influenceuse</li>
                    <li>Style visuel de base</li>
                    <li>Face reference pour verrouiller l identité</li>
                  </ul>
                </div>

                <div class="mt-7 flex flex-col gap-3 sm:flex-row">
                  <NuxtLink
                    to="/influencers/new"
                    class="inline-flex flex-1 items-center justify-center rounded-[12px] bg-[#E8873A] px-4 py-3 text-sm font-bold text-white transition-all duration-150 hover:-translate-y-0.5 hover:bg-[#d4762f]"
                  >
                    Créer une influenceuse
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
const activeInfluencerName = computed(() => activeInfluencer.value?.name || 'Choisir une influenceuse')
const activeInfluencerNiche = computed(() => summarizeNiches(activeInfluencer.value?.niche) || 'Aucune niche renseignée')
const activeInfluencerInitial = computed(() => avatarLetter(activeInfluencer.value?.name || 'P'))
const userEmail = computed(() => String(user.value?.email || 'compte@plotline.local'))
const userInitial = computed(() => avatarLetter(user.value?.email || 'U'))
const showOnboardingModal = computed(() => {
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

const navigation = computed(() => [
  { label: 'Home', to: '/dashboard', icon: 'lucide:house' },
  { label: 'Inbox', to: '/content', icon: 'lucide:inbox', badge: String(dashboardBadge.value) },
  { label: 'Customers', to: '/influencers', icon: 'lucide:users' },
  { label: 'Settings', to: '/settings', icon: 'lucide:settings' },
  { label: 'Générer', to: activeInfluencer.value ? `/influencers/${activeInfluencer.value.id}/generate` : '/influencers', icon: 'lucide:send', disabled: !activeInfluencer.value },
  { label: 'Calendrier', to: '/calendar', icon: 'lucide:calendar-days' },
  { label: 'Analytics', to: '/analytics', icon: 'lucide:bar-chart-3', badge: 'Bientôt', disabled: true },
])

const settingsLinks = [
  { label: 'General', to: '/settings' },
  { label: 'Members', to: '/settings' },
  { label: 'Notifications', to: '/settings' },
  { label: 'Security', to: '/settings' },
]

const dashboardBadge = computed(() => {
  return route.path.startsWith('/content') ? 0 : 4
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
    return 'cursor-not-allowed border border-transparent text-[#A4B0C8] opacity-55 hover:bg-transparent'
  }
  return isActive
    ? 'border border-[#E8873A]/65 bg-[linear-gradient(90deg,rgba(232,135,58,0.28),rgba(232,135,58,0.08))] text-[#FFF1E3] shadow-[0_10px_24px_rgba(232,135,58,0.2)]'
    : 'text-[#CCD4E6] hover:bg-white/8 hover:text-white'
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
