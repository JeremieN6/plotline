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
                    <p class="truncate text-xs text-[#666666]">{{ summarizeNiches(influencer.niche) || 'Sans niche' }}</p>
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
                <NuxtLink
                  to="/influencers/new"
                  class="flex items-center justify-center gap-2 rounded-[12px] border border-dashed border-[#E8873A]/40 px-3 py-2 text-sm font-bold text-[#E8873A] transition-colors duration-150 hover:bg-[#FDF3EA]"
                  @click="switcherOpen = false; mobileMenuOpen = false"
                >
                  <span class="text-lg leading-none">+</span>
                  Nouvelle influenceuse
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
            <NuxtLink
              to="/settings"
              class="flex items-center gap-3 rounded-[12px] px-2 py-2 transition-colors duration-150 hover:bg-[#FAFAF8]"
              @click="mobileMenuOpen = false"
            >
              <div class="flex h-10 w-10 items-center justify-center rounded-full bg-[#111111] text-sm font-bold text-white">
                U
              </div>
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-semibold text-[#111111]">creator@plotline.local</p>
                <p class="text-xs text-[#666666]">Paramètres</p>
              </div>
            </NuxtLink>
          </div>
        </div>
      </aside>

      <main class="min-w-0 flex-1 px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
        <slot />
      </main>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const activeInfluencerId = useActiveInfluencer()
const switcherOpen = ref(false)
const mobileMenuOpen = ref(false)
const userId = 'user-test'

const { data: influencersData } = await useFetch('/api/influencers', {
  key: 'plotline-shell-influencers',
  query: { userId },
})

const influencers = computed(() => influencersData.value || [])
const activeInfluencer = computed(() => {
  return influencers.value.find((item) => item.id === activeInfluencerId.value) || influencers.value[0] || null
})
const activeInfluencerName = computed(() => activeInfluencer.value?.name || 'Choisir une influenceuse')
const activeInfluencerNiche = computed(() => summarizeNiches(activeInfluencer.value?.niche) || 'Aucune niche renseignée')
const activeInfluencerInitial = computed(() => avatarLetter(activeInfluencer.value?.name || 'P'))

const navigation = computed(() => [
  { label: 'Accueil', to: '/dashboard' },
  { label: 'Générer', to: activeInfluencer.value ? `/influencers/${activeInfluencer.value.id}/generate` : '/influencers', disabled: !activeInfluencer.value },
  { label: 'Contenu', to: '/content' },
  { label: 'Paramètres influenceuse', to: activeInfluencer.value ? `/influencers/${activeInfluencer.value.id}/edit` : '/influencers/new', disabled: !activeInfluencer.value },
  { label: 'Calendrier', to: '/calendar' },
  { label: 'Analytics', to: '/analytics', badge: 'Bientôt', disabled: true },
])

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

function selectInfluencer(id) {
  activeInfluencerId.value = id
  switcherOpen.value = false
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
