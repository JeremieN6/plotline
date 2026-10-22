<template>
  <div class="min-h-screen bg-ui-bg text-ui-ink">
    <div class="mx-auto flex min-h-screen w-full max-w-[1680px] flex-col lg:flex-row">
      <header class="sticky top-0 z-30 border-b border-ui-line bg-ui-surface/95 px-4 py-3 backdrop-blur lg:hidden">
        <div class="flex items-center justify-between gap-3">
          <UiIconButton label="Ouvrir le menu" @click="mobileMenuOpen = true">
            <Icon name="lucide:menu" class="h-5 w-5" />
          </UiIconButton>

          <div class="flex h-9 w-9 items-center justify-center rounded-ui-ctl bg-ui-accent font-ui text-sm font-bold text-white">
            P
          </div>
        </div>
      </header>

      <div
        v-if="mobileMenuOpen"
        class="fixed inset-0 z-40 bg-ui-ink/45 lg:hidden"
        @click="mobileMenuOpen = false"
      />

      <!-- Rail compact sur bureau (icones seules, comme la maquette du kit),
           libelles complets en tiroir sur mobile ou quand on le deplie. -->
      <aside
        class="fixed inset-y-0 left-0 z-50 w-[280px] border-r border-ui-line bg-ui-surface font-ui transition-transform duration-200 lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:flex-shrink-0 lg:translate-x-0"
        :class="[mobileMenuOpen ? 'translate-x-0' : '-translate-x-full', rail ? 'lg:w-[76px]' : 'lg:w-[248px]']"
      >
        <div class="flex h-full flex-col px-3 py-4">
          <div class="mb-5 flex items-center justify-between gap-3 px-1" :class="rail ? 'lg:justify-center' : ''">
            <div class="flex items-center gap-3">
              <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-ui-ctl bg-ui-accent text-sm font-bold text-white">
                P
              </div>
              <div :class="labelClass">
                <p class="text-base font-semibold tracking-tight text-ui-ink">Plotline</p>
                <p class="text-xs text-ui-ink-muted">Back office</p>
              </div>
            </div>

            <button
              type="button"
              aria-label="Fermer le menu"
              class="inline-flex h-10 w-10 items-center justify-center rounded-ui-ctl border border-ui-line-input text-ui-ink hover:bg-ui-subtle lg:hidden"
              @click="mobileMenuOpen = false"
            >
              <Icon name="lucide:x" class="h-4 w-4" />
            </button>
          </div>

          <div class="plotline-switcher relative mb-4">
            <p :class="labelClass" class="mb-2 px-1 font-ui-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-ui-ink-muted">{{ switcherLabel }}</p>
            <button
              type="button"
              :title="activeInfluencerName"
              class="flex w-full items-center gap-3 rounded-ui-ctl border border-ui-line bg-ui-bg p-2 text-left transition-colors hover:border-ui-accent/40 hover:bg-ui-surface"
              :class="rail ? 'lg:justify-center lg:border-transparent lg:bg-transparent lg:p-1' : ''"
              @click="switcherOpen = !switcherOpen"
            >
              <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ui-accent text-sm font-bold text-white">
                {{ activeInfluencerInitial }}
              </div>
              <div :class="labelClass" class="min-w-0 flex-1">
                <p class="truncate text-sm font-semibold text-ui-ink">{{ activeInfluencerName }}</p>
                <p class="truncate text-xs text-ui-ink-muted">{{ activeInfluencerNiche }}</p>
              </div>
              <Icon :class="labelClass" name="lucide:chevrons-up-down" class="h-4 w-4 shrink-0 text-ui-ink-muted" />
            </button>

            <div
              v-if="switcherOpen"
              class="absolute left-0 top-[calc(100%+8px)] z-20 w-[256px] overflow-hidden rounded-ui-card border border-ui-line bg-ui-surface shadow-lg"
            >
              <div class="max-h-72 overflow-y-auto p-2">
                <button
                  v-for="influencer in influencers"
                  :key="influencer.id"
                  type="button"
                  class="flex w-full items-center gap-3 rounded-ui-ctl px-3 py-2.5 text-left transition-colors hover:bg-ui-subtle"
                  @click="selectInfluencer(influencer.id)"
                >
                  <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ui-accent text-sm font-bold text-white">
                    {{ avatarLetter(influencer.name) }}
                  </div>
                  <div class="min-w-0 flex-1">
                    <p class="truncate text-sm font-semibold text-ui-ink">{{ influencer.name }}</p>
                    <p class="truncate text-xs text-ui-ink-muted">{{ profileSecondaryLabel(influencer) }}</p>
                  </div>
                  <span
                    v-if="influencer.id === activeInfluencerId"
                    class="rounded-ui-tag bg-ui-accent-soft px-2 py-1 text-[11px] font-semibold text-ui-accent-ink"
                  >
                    Actif
                  </span>
                </button>
              </div>
              <div class="border-t border-ui-line p-2">
                <template v-if="isContentCreator">
                  <NuxtLink to="/profiles/new" :class="addLinkClass" @click="switcherOpen = false; mobileMenuOpen = false">
                    <Icon name="lucide:plus" class="h-4 w-4" />
                    Nouveau profil
                  </NuxtLink>
                </template>
                <template v-else-if="isBrand">
                  <NuxtLink to="/brand-studio?newCampaign=1" :class="addLinkClass" class="mb-2" @click="switcherOpen = false; mobileMenuOpen = false">
                    <Icon name="lucide:plus" class="h-4 w-4" />
                    Nouvelle campagne
                  </NuxtLink>
                  <NuxtLink to="/profiles/new" :class="addLinkClass" @click="switcherOpen = false; mobileMenuOpen = false">
                    <Icon name="lucide:plus" class="h-4 w-4" />
                    Nouvelle ambassadrice
                  </NuxtLink>
                </template>
                <NuxtLink v-else to="/profiles/new" :class="addLinkClass" @click="switcherOpen = false; mobileMenuOpen = false">
                  <Icon name="lucide:plus" class="h-4 w-4" />
                  {{ addAmbassadorLabel }}
                </NuxtLink>
              </div>
            </div>
          </div>

          <!-- min-h-0 + overflow: sans quoi la liste ne peut pas retrecir et
               pousse le bloc compte (et sa deconnexion) hors de l ecran. -->
          <nav class="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto" aria-label="Navigation principale">
            <template v-for="item in navigation" :key="item.to">
              <span
                v-if="item.disabled"
                :class="navClass(item)"
                :title="item.badge ? `${item.label} (${item.badge})` : item.label"
                aria-disabled="true"
              >
                <Icon :name="item.icon" class="h-[18px] w-[18px] shrink-0" />
                <span :class="labelClass" class="flex-1 truncate">{{ item.label }}</span>
                <span v-if="item.badge" :class="labelClass" class="rounded-ui-tag bg-ui-accent-soft px-2 py-0.5 text-[11px] font-semibold text-ui-accent-ink">
                  {{ item.badge }}
                </span>
              </span>

              <NuxtLink
                v-else
                :to="item.to"
                :class="navClass(item)"
                :title="item.label"
                :aria-current="item.to === activeNavTo ? 'page' : undefined"
                @click="mobileMenuOpen = false"
              >
                <Icon :name="item.icon" class="h-[18px] w-[18px] shrink-0" :class="item.to === activeNavTo ? 'text-ui-accent' : ''" />
                <span :class="labelClass" class="flex-1 truncate">{{ item.label }}</span>
              </NuxtLink>
            </template>
          </nav>

          <div class="mt-4 shrink-0 border-t border-ui-line pt-3">
            <button
              type="button"
              class="mb-2 hidden h-10 w-full items-center gap-3 rounded-ui-ctl px-3 text-sm font-semibold text-ui-ink-2 transition-colors hover:bg-ui-subtle hover:text-ui-ink lg:flex"
              :class="rail ? 'lg:justify-center lg:px-0' : ''"
              :title="rail ? 'Déplier le menu' : 'Replier le menu'"
              :aria-label="rail ? 'Déplier le menu' : 'Replier le menu'"
              @click="toggleRail"
            >
              <Icon :name="rail ? 'lucide:panel-left-open' : 'lucide:panel-left-close'" class="h-[18px] w-[18px] shrink-0" />
              <span :class="labelClass">Replier le menu</span>
            </button>

            <div class="rounded-ui-ctl border border-ui-line bg-ui-bg p-2" :class="rail ? 'lg:border-transparent lg:bg-transparent lg:p-0' : ''">
              <NuxtLink
                to="/settings"
                :title="userEmail"
                class="flex items-center gap-3 rounded-ui-ctl p-1 transition-colors hover:bg-ui-surface"
                :class="rail ? 'lg:justify-center' : ''"
                @click="mobileMenuOpen = false"
              >
                <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ui-ink text-sm font-bold text-white">
                  {{ userInitial }}
                </div>
                <div :class="labelClass" class="min-w-0 flex-1">
                  <p class="truncate text-sm font-semibold text-ui-ink">{{ userEmail }}</p>
                  <p class="text-xs text-ui-ink-muted">Compte connecté</p>
                </div>
              </NuxtLink>

              <UiButton :class="labelClass" class="mt-2 w-full" size="sm" @click="logout">
                Se déconnecter
              </UiButton>
              <button
                type="button"
                title="Se déconnecter"
                aria-label="Se déconnecter"
                class="mt-1 hidden h-10 w-full items-center justify-center rounded-ui-ctl text-ui-ink-2 transition-colors hover:bg-ui-subtle hover:text-ui-ink"
                :class="rail ? 'lg:flex' : ''"
                @click="logout"
              >
                <Icon name="lucide:log-out" class="h-[18px] w-[18px]" />
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
            class="fixed inset-0 z-[100] flex items-center justify-center bg-ui-ink/55 p-5 font-ui backdrop-blur-[2px]"
          >
            <div class="relative w-full max-w-xl rounded-ui-card border border-ui-line bg-ui-surface p-7 shadow-xl sm:p-9">
              <p class="font-ui-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-ui-accent">Onboarding</p>
              <h2 class="mt-3 text-2xl font-semibold tracking-tight text-ui-ink">Crée ta première {{ wording.ambassador }}</h2>
              <p class="mt-3 text-sm leading-relaxed text-ui-ink-2">
                Ton workspace est prêt, mais il n y a encore aucune identité active. Ajoute une première {{ wording.ambassador }} pour débloquer le dashboard, le calendrier et la génération.
              </p>

              <div class="mt-6 grid gap-3 rounded-ui-card border border-ui-line bg-ui-subtle p-4 text-sm">
                <p class="font-semibold text-ui-ink">Ce que tu vas configurer maintenant :</p>
                <ol class="list-inside list-decimal space-y-2 text-ui-ink-2">
                  <li>Nom et niche de ton {{ wording.visualIdentity }}</li>
                  <li>Style visuel de base</li>
                  <li>Cohérence Faciale pour verrouiller l'identité</li>
                </ol>
              </div>

              <div class="mt-7 flex flex-col gap-3 sm:flex-row">
                <NuxtLink
                  to="/profiles/new"
                  class="inline-flex h-11 flex-1 items-center justify-center rounded-ui-ctl bg-ui-accent px-4 text-sm font-semibold text-white transition-colors hover:bg-ui-accent-hover"
                >
                  {{ createAmbassadorLabel }}
                </NuxtLink>
                <UiButton @click="logout">Changer de compte</UiButton>
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
const { wording, ambassadorFor } = useWording()
const activeInfluencerId = useActiveInfluencer()
const switcherOpen = ref(false)
const mobileMenuOpen = ref(false)

// Rail compact par defaut sur bureau ; le choix est memorise dans un cookie
// (lisible cote serveur : pas de saut visuel a l hydratation).
const sidebarCookie = useCookie('plotline-sidebar', { default: () => 'rail', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' })
const rail = computed(() => sidebarCookie.value !== 'full')
// Les libelles n existent que si le menu est deplie (bureau) ; le tiroir mobile les garde toujours.
const labelClass = computed(() => (rail.value ? 'lg:hidden' : ''))
const addLinkClass = 'flex items-center justify-center gap-2 rounded-ui-ctl border border-dashed border-ui-accent/40 px-3 py-2 text-sm font-semibold text-ui-accent transition-colors hover:bg-ui-accent-soft'

function toggleRail() {
  sidebarCookie.value = rail.value ? 'full' : 'rail'
}

// `pending` et `error` sont indispensables ici: sans eux, une liste vide pendant
// le chargement ou apres un echec est indiscernable d un compte sans profil, et
// l assistant de creation s ouvre sur quelqu un qui en a deja.
const {
  data: influencersData,
  pending: influencersPending,
  error: influencersError,
} = await useFetch('/api/profiles', {
  key: 'plotline-shell-influencers',
})

const influencersLoaded = computed(
  () => !influencersPending.value && !influencersError.value && Array.isArray(influencersData.value),
)

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
  const profileType = String(activeInfluencer.value?.profileType || '').trim().toUpperCase()
  if (profileType === 'PERSONA') return ambassadorFor(activeInfluencer.value?.gender)
  if (profileType === 'BRAND') return 'marque'
  if (profileType === 'ACTIVITY') return 'activité'

  const hasFaceRef = Boolean(String(activeInfluencer.value?.faceRefPath || '').trim())
  return hasFaceRef ? ambassadorFor(activeInfluencer.value?.gender) : 'marque'
})
const settingsNavLabel = computed(() => {
  if (!activeInfluencer.value) return `Paramètres ${wording.value.ambassador}`
  return `Paramètres ${activeProfileTypeLabel.value}`
})
const showOnboardingModal = computed(() => {
  if (!isInfluencerCreator.value) return false
  // Ne rien affirmer tant que la liste n est pas reellement chargee.
  if (!influencersLoaded.value) return false
  if (route.path.startsWith('/onboarding')) return false
  if (route.path.startsWith('/profiles/new')) return false
  return influencers.value.length === 0
})

const routeInfluencerId = computed(() => {
  const segments = String(route.path || '').split('/').filter(Boolean)
  if (segments[0] !== 'profiles') return ''
  const rawId = segments[1] || ''
  if (!rawId || rawId === 'new') return ''
  return rawId
})

// Le laboratoire de personnalite n est propose qu aux admins (la page et les
// routes serveur verifient de toute facon).
const navigation = computed(() => {
  const items = baseNavigation.value
  if (!user.value?.isAdmin) return items
  return [...items, { label: 'Personnalité (admin)', to: '/admin/personality', icon: 'lucide:flask-conical' }]
})

const baseNavigation = computed(() => {
  const settingsItem = {
    label: settingsNavLabel.value,
    to: activeInfluencer.value ? `/profiles/${activeInfluencer.value.id}/edit` : '/profiles/new',
    icon: 'lucide:settings',
    disabled: !activeInfluencer.value,
  }

  // La liste des profils n etait atteignable que depuis le menu des comptes
  // marque: ailleurs, il fallait taper l URL a la main. Elle est desormais
  // presente pour les trois types de compte.
  const profilesItem = { label: 'Mes profils', to: '/profiles', icon: 'lucide:users' }
  const libraryItem = { label: 'Bibliothèque', to: '/library', icon: 'lucide:library' }
  const homeItem = { label: 'Accueil', to: '/dashboard', icon: 'lucide:house' }
  const calendarItem = { label: 'Calendrier', to: '/calendar', icon: 'lucide:calendar' }
  const analyticsItem = { label: 'Analytics', to: '/analytics', icon: 'lucide:chart-column', badge: 'Bientôt', disabled: true }

  if (isContentCreator.value) {
    return [
      homeItem,
      { label: 'Studio', to: '/studio', icon: 'lucide:wand-sparkles' },
      libraryItem,
      { label: 'Mes créations', to: '/content', icon: 'lucide:layout-grid' },
      profilesItem,
      calendarItem,
      analyticsItem,
      settingsItem,
    ]
  }

  if (isBrand.value) {
    return [
      homeItem,
      { label: 'Brand Studio', to: '/brand-studio', icon: 'lucide:wand-sparkles' },
      libraryItem,
      profilesItem,
      calendarItem,
      analyticsItem,
      settingsItem,
    ]
  }

  return [
    homeItem,
    { label: 'Générer', to: activeInfluencer.value ? `/profiles/${activeInfluencer.value.id}/generate` : '/profiles', icon: 'lucide:sparkles', disabled: !activeInfluencer.value },
    { label: 'Studio', to: '/studio', icon: 'lucide:wand-sparkles' },
    libraryItem,
    { label: 'Contenu', to: '/content', icon: 'lucide:layout-grid' },
    profilesItem,
    calendarItem,
    analyticsItem,
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
  const profileType = String(influencer?.profileType || '').trim().toUpperCase()

  if (profileType === 'PERSONA') {
    return `Profil ${ambassadorFor(influencer?.gender)}`
  }

  if (profileType === 'BRAND') {
    return 'Profil marque'
  }

  if (profileType === 'ACTIVITY') {
    return 'Profil activité'
  }

  if (isContentCreator.value || isBrand.value) {
    const hasFaceRef = Boolean(String(influencer?.faceRefPath || '').trim())
    return hasFaceRef ? `Profil ${ambassadorFor(influencer?.gender)}` : 'Profil marque'
  }

  return summarizeNiches(influencer?.niche) || 'Sans niche'
}

function buildInfluencerScopedPath(path, influencerId) {
  const segments = String(path || '').split('/').filter(Boolean)
  if (segments[0] !== 'profiles') return null
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

/**
 * Une seule entree peut etre active: la plus specifique qui corresponde.
 * Un simple `startsWith` allumait "Mes profils" (/profiles) en meme temps que
 * "Reglages" (/profiles/:id/edit), puisque le second est un descendant du premier.
 */
const activeNavTo = computed(() => {
  const matches = navigation.value.filter((item) => {
    if (item.disabled || !item.to) return false
    return route.path === item.to || route.path.startsWith(`${item.to}/`)
  })

  if (!matches.length) return ''

  return matches.reduce((best, item) => (item.to.length > best.to.length ? item : best)).to
})

function navClass(item) {
  const base = 'flex h-10 items-center gap-3 rounded-ui-ctl px-3 text-sm font-semibold transition-colors'
  const centered = rail.value ? ' lg:justify-center lg:px-0' : ''

  if (item.disabled) {
    return `${base}${centered} cursor-not-allowed text-ui-ink opacity-50`
  }

  return item.to === activeNavTo.value
    ? `${base}${centered} bg-ui-subtle text-ui-ink`
    : `${base}${centered} text-ui-ink-2 hover:bg-ui-subtle hover:text-ui-ink`
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
