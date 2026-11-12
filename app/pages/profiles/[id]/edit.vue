<template>
  <div class="space-y-6 font-ui">
    <header class="rounded-ui-card border border-ui-line bg-ui-surface p-5">
      <p class="text-xs font-semibold uppercase tracking-[0.08em] text-ui-accent">Paramètres</p>
      <h1 class="mt-1 text-2xl font-bold tracking-tight text-ui-ink">Modifier le profil</h1>
      <p v-if="influencer" class="mt-2 text-sm font-semibold text-ui-ink">
        {{ influencer.name }} <span class="text-ui-ink-muted">•</span> {{ profileTypeLabelDisplay }}
      </p>
      <p v-if="linkedBrandLabel" class="mt-2 inline-flex items-center gap-2 rounded-full border border-ui-line bg-ui-subtle px-3 py-1.5 text-xs font-semibold text-ui-ink-2">
        <span class="h-2 w-2 rounded-full bg-ui-accent" aria-hidden="true"></span>
        {{ linkedBrandLabel }}
      </p>
      <p class="mt-2 text-sm text-ui-ink-2">{{ settingsDescription }}</p>
    </header>

    <UiSkeleton v-if="pending" :lines="4" />

    <UiAlert v-else-if="fetchError || !influencer" title="Impossible de charger ce profil">
      Le profil n’a pas pu être lu. Recharge la page ; s’il reste introuvable, il a peut-être été supprimé.
    </UiAlert>

    <div v-else class="space-y-6">
      <UiCard>
        <template #title>Informations</template>
        <div class="grid gap-4">
          <UiField label="Nom" for-id="profile-name">
            <UiInput id="profile-name" v-model="form.name" placeholder="ex : Luna" />
          </UiField>
          <UiField label="Niches" hint="Entrée pour ajouter une niche. Elles sont affichées comme des tags dans la liste.">
            <UiTagInput v-model="nicheTags" placeholder="ex : lifestyle, fitness, travel" />
          </UiField>
          <UiField label="Style" hint="Entrée pour ajouter un style. Ils sont affichés comme des tags dans la liste.">
            <UiTagInput v-model="styleTags" placeholder="ex : parisian chic" />
          </UiField>
        </div>
      </UiCard>

      <UiCard v-if="isAmbassadorProfile">
        <template #title>Face ref</template>
        <template #actions>
          <UiBadge :status="currentFaceRefPath ? 'ready' : 'empty'" :label="currentFaceRefPath ? 'Fichier présent' : 'Aucun fichier'" />
        </template>

        <p class="text-sm text-ui-ink-2">Dépose une photo classique de ce à quoi tu veux que ton {{ profileTypeLabel }} ressemble. Le pipeline génère automatiquement la fiche de cohérence visuelle (3 panneaux) à partir de cette photo.</p>

        <p v-if="currentFaceRefName" class="mt-3 text-sm text-ui-ink">
          Fichier actuel : <strong>{{ currentFaceRefName }}</strong>
        </p>

        <div v-if="currentFaceRefUrl && !sourcePreviewUrl && !generatedImageDataUrl" class="mt-4 overflow-hidden rounded-ui-card border border-ui-line">
          <img
            v-if="!currentFaceRefMissing"
            :src="currentFaceRefUrl"
            alt="Face ref actuelle"
            class="block max-h-72 w-full object-cover"
            @error="onCurrentFaceRefError"
          />
          <UiAlert v-else tone="info">
            Cette image de référence n’est pas disponible sur ce poste. Dépose une nouvelle photo source pour régénérer.
          </UiAlert>
        </div>

        <template v-if="!generatedImageDataUrl">
          <div
            class="mt-4 rounded-ui-card border-2 border-dashed p-6 text-center transition-colors"
            :class="isDragging ? 'border-ui-accent bg-ui-accent-soft' : fileError ? 'border-ui-danger bg-ui-danger-soft' : 'border-ui-line-input bg-ui-surface'"
            @dragenter.prevent="isDragging = true"
            @dragover.prevent="isDragging = true"
            @dragleave.prevent="isDragging = false"
            @drop.prevent="onDrop"
          >
            <input
              ref="fileInputRef"
              type="file"
              accept="image/jpeg,image/png,.jpg,.jpeg,.png"
              class="hidden"
              @change="onFileSelect"
            />
            <p class="font-semibold text-ui-ink">Dépose une photo source ici (visage dégagé, cadrage buste minimum)</p>
            <p class="mb-3 mt-2 text-sm text-ui-ink-muted">ou sélectionne un nouveau fichier</p>
            <UiButton variant="secondary" @click="openFilePicker">Choisir un fichier</UiButton>
          </div>

          <div v-if="sourcePreviewUrl" class="mt-4 overflow-hidden rounded-ui-card border border-ui-line">
            <img :src="sourcePreviewUrl" alt="Photo source" class="block max-h-72 w-full object-cover" />
          </div>

          <UiAlert v-if="fileError" class="mt-3" title="Fichier refusé">{{ fileError }}</UiAlert>
          <UiAlert v-if="generateError" class="mt-3" title="La génération a échoué">{{ generateError }}</UiAlert>

          <div v-if="sourceImageBase64" class="mt-4 space-y-2">
            <UiButton variant="dark" class="w-full" :loading="generatingRef" :disabled="generatingRef" @click="generateFaceReference('default')">
              {{ generatingRef ? 'Génération en cours... (~30s)' : 'Générer la nouvelle fiche référence' }}
            </UiButton>
            <UiButton class="w-full" :disabled="generatingRef" @click="generateFaceReference('contact_sheet_9')">
              Essayer une autre méthode (fiche 9 vues)
            </UiButton>
            <UiButton class="w-full" :disabled="generatingRef" @click="generateFaceReference('close_up_4')">
              Essayer une autre méthode (4 vues en gros plan)
            </UiButton>
          </div>

          <div v-if="isAdmin" class="mt-4 rounded-ui-card border border-dashed border-ui-line-input bg-ui-surface p-4">
            <div class="flex flex-wrap items-center gap-2">
              <p class="text-[15px] font-semibold text-ui-ink">Importer directement une fiche 3 vues</p>
              <span class="rounded-full bg-ui-ink px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">Admin</span>
            </div>
            <p class="mt-1 text-xs text-ui-ink-muted">
              Remplace la face ref actuelle par ta propre fiche, sans passer par la génération. Format conseillé : 3 vues du visage (face, 3/4, profil) sur fond blanc, c’est le format qui a le mieux tenu l’identité faciale.
            </p>
            <input
              ref="adminSheetInputRef"
              type="file"
              accept="image/jpeg,image/png,.jpg,.jpeg,.png"
              class="hidden"
              @change="onAdminSheetSelect"
            />
            <UiButton class="mt-3" :loading="uploadingAdminSheet" :disabled="uploadingAdminSheet" @click="openAdminSheetPicker">
              {{ uploadingAdminSheet ? 'Import en cours...' : 'Importer ma fiche' }}
            </UiButton>
            <UiAlert v-if="adminSheetError" class="mt-3" title="Import impossible">{{ adminSheetError }}</UiAlert>
          </div>

          <div class="mt-4 rounded-ui-card border border-dashed border-ui-line-input bg-ui-surface p-4">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div class="min-w-0">
                <p class="text-[15px] font-semibold text-ui-ink">Reprendre une fiche déjà générée</p>
                <p class="mt-0.5 text-xs text-ui-ink-muted">Gratuit : choisis parmi les fiches conservées dans ta bibliothèque, sans relancer de génération.</p>
              </div>
              <UiButton variant="secondary" size="sm" :loading="galleryLoading" @click="toggleGallery">
                {{ galleryOpen ? 'Masquer' : 'Choisir une fiche' }}
              </UiButton>
            </div>

            <UiAlert v-if="galleryError" class="mt-3" title="Les fiches n’ont pas pu être chargées">
              {{ galleryError }}
              <template #action><UiButton variant="secondary" size="sm" @click="loadGallery">Réessayer</UiButton></template>
            </UiAlert>

            <template v-else-if="galleryOpen && !galleryLoading">
              <p v-if="!gallerySheets.length" class="mt-3 text-sm text-ui-ink-muted">
                Aucune fiche conservée pour l’instant. Celles que tu génères sont ajoutées automatiquement dans
                <NuxtLink to="/library/fiches" class="font-semibold text-ui-accent hover:underline">Bibliothèque › Fiches générées</NuxtLink>.
              </p>
              <ul v-else class="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                <li v-for="sheet in gallerySheets" :key="sheet.id" class="overflow-hidden rounded-ui-card border border-ui-line bg-ui-surface">
                  <img :src="sheet.imageUrl" :alt="`Fiche du ${formatSheetDate(sheet.createdAt)}`" class="aspect-[3/4] w-full bg-ui-subtle object-cover" loading="lazy" />
                  <div class="space-y-2 p-3">
                    <p class="text-xs text-ui-ink-muted">
                      <span class="font-semibold text-ui-ink">{{ sheet.profileId === id ? 'Cette persona' : (sheet.profileName || 'Sans persona') }}</span>
                      · {{ formatSheetDate(sheet.createdAt) }}
                    </p>
                    <UiButton
                      variant="secondary"
                      size="sm"
                      class="w-full"
                      :loading="applyingGalleryId === sheet.id"
                      :disabled="Boolean(applyingGalleryId)"
                      @click="applyGallerySheet(sheet)"
                    >
                      Utiliser
                    </UiButton>
                  </div>
                </li>
              </ul>
            </template>
          </div>
        </template>

        <template v-else>
          <p class="mt-4 text-sm text-ui-ink">Nouvelle fiche référence générée. Valide-la pour remplacer la face ref actuelle, ou régénère à partir de la même photo.</p>
          <div class="mt-3 overflow-hidden rounded-ui-card border border-ui-line">
            <img :src="generatedImageDataUrl" alt="Nouvelle fiche référence" class="block max-h-96 w-full object-cover" />
          </div>
          <UiAlert v-if="applyError" class="mt-3" title="Le remplacement a échoué">{{ applyError }}</UiAlert>
          <div class="mt-4 flex flex-wrap gap-3">
            <UiButton :disabled="generatingRef || applyingFaceRef" @click="regenerateFaceReference">Régénérer</UiButton>
            <UiButton variant="dark" :loading="applyingFaceRef" :disabled="applyingFaceRef" @click="applyGeneratedFaceRef">
              {{ applyingFaceRef ? 'Application...' : 'Valider et remplacer' }}
            </UiButton>
          </div>
        </template>
      </UiCard>

      <UiCard v-if="isAmbassadorProfile">
        <template #title>Marques représentées</template>
        <p class="text-sm text-ui-ink-2">
          {{ isMaleProfile ? 'Un même' : 'Une même' }} {{ profileTypeLabel }} peut représenter plusieurs marques. Sélectionne celles pour lesquelles {{ isMaleProfile ? 'il' : 'elle' }} peut générer du contenu.
        </p>

        <UiEmptyState v-if="!brandOptions.length" class="mt-4" title="Aucune marque pour l’instant" text="Aucune marque n’existe encore sur ce compte." />

        <template v-else>
          <div class="mt-4">
            <UiToggleChips v-model="selectedBrandIds" label="Marques représentées" :options="brandChipOptions" @update:model-value="brandLinksMessage = ''" />
          </div>
          <div class="mt-4 flex flex-wrap items-center gap-3">
            <UiButton :loading="savingBrands" :disabled="savingBrands" @click="saveBrandLinks">
              {{ savingBrands ? 'Enregistrement...' : 'Enregistrer les marques' }}
            </UiButton>
            <p v-if="brandLinksMessage" class="text-xs text-ui-ink-muted" role="status">{{ brandLinksMessage }}</p>
          </div>
        </template>
      </UiCard>

      <UiCard v-if="isAmbassadorProfile">
        <template #title>Genre et silhouette</template>
        <p class="text-sm text-ui-ink-2">Définit le gabarit de base qui sera utilisé par ton persona. Tu peux également le laisser par défaut.</p>

        <div class="mt-4 grid gap-4">
          <UiField label="Genre">
            <UiSegmented v-model="genderModel" label="Genre" :options="[{ value: 'FEMALE', label: 'Femme' }, { value: 'MALE', label: 'Homme' }]" />
          </UiField>
          <UiField label="Silhouette" for-id="profile-silhouette" :hint="selectedSilhouetteDescription">
            <UiSelect id="profile-silhouette" v-model="form.silhouette" :options="silhouetteSelectOptions" />
          </UiField>
        </div>
      </UiCard>

      <UiCard v-if="isAmbassadorProfile">
        <template #title>Identité</template>
        <p class="text-sm text-ui-ink-2">Ces informations, demandées à la création, servent aussi à décrire la persona dans les widgets Studio.</p>

        <div class="mt-4 grid gap-4 sm:grid-cols-2">
          <UiField label="Couleur des yeux" for-id="profile-eyes">
            <UiInput id="profile-eyes" v-model="form.eyeColor" placeholder="ex : Bleus" />
          </UiField>
          <UiField label="Origine ethnique" for-id="profile-ethnicity">
            <UiInput id="profile-ethnicity" v-model="form.ethnicity" placeholder="ex : origine méditerranéenne" />
          </UiField>
          <UiField class="sm:col-span-2" label="Particularités" for-id="profile-particularities">
            <UiInput id="profile-particularities" v-model="form.particularities" placeholder="ex : taches de rousseur, grain de beauté" />
          </UiField>
        </div>
      </UiCard>

      <UiCard>
        <template #title>Cadence de publication</template>
        <p class="text-sm text-ui-ink-2">Détermine le rythme utilisé par le planificateur éditorial quand tu prépares un plan.</p>

        <div class="mt-4 grid gap-4 sm:grid-cols-3">
          <UiField label="Posts par semaine" for-id="profile-ppw">
            <UiInput id="profile-ppw" v-model="postsPerWeekModel" type="number" min="1" max="21" />
          </UiField>
          <UiField label="Heure de publication" for-id="profile-hour">
            <UiSelect id="profile-hour" v-model="publishHourModel" :options="hourOptions" />
          </UiField>
          <UiField label="Rotation des formats" hint="FEED = image, STORY = clip Pinterest, REEL = vidéo faceless pour l’instant.">
            <UiToggleChips v-model="formatRotationModel" label="Rotation des formats" :options="formatOptions" />
          </UiField>
        </div>
      </UiCard>

      <UiCard>
        <template #title>Plans précédents</template>
        <p class="text-sm text-ui-ink-2">Retrouve les plans déjà préparés pour ce profil.</p>

        <UiSkeleton v-if="plansPending" class="mt-4" :lines="2" />
        <UiEmptyState v-else-if="!previousPlans.length" class="mt-4" title="Aucun plan pour l’instant" text="Les plans que tu prépares depuis le calendrier apparaissent ici." />
        <ul v-else class="mt-4 space-y-2">
          <li
            v-for="planItem in previousPlans"
            :key="planItem.id"
            class="flex flex-wrap items-center justify-between gap-3 rounded-ui-ctl border border-ui-line bg-ui-surface px-3 py-2.5"
          >
            <div class="flex items-center gap-2.5">
              <UiBadge :status="planBadgeStatus(planItem.status)" :label="planStatusLabel(planItem.status)" />
              <span class="text-sm text-ui-ink-2">
                {{ planItem._count?.items || 0 }} idée{{ (planItem._count?.items || 0) > 1 ? 's' : '' }} · {{ formatPlanDate(planItem.createdAt) }}
              </span>
            </div>
            <div class="flex items-center gap-1">
              <NuxtLink :to="`/plans/${planItem.id}`" class="inline-flex min-h-[44px] items-center px-2 text-sm font-semibold text-ui-accent hover:text-ui-accent-hover">Ouvrir</NuxtLink>
              <UiButton
                v-if="planItem.status === 'DRAFT'"
                variant="ghost"
                size="sm"
                :disabled="discardingPlanIds.includes(planItem.id)"
                @click="discardPreviousPlan(planItem)"
              >
                {{ discardingPlanIds.includes(planItem.id) ? 'Abandon...' : 'Jeter' }}
              </UiButton>
            </div>
          </li>
        </ul>
      </UiCard>

      <UiCard>
        <template #title>Instagram</template>
        <template #actions>
          <UiButton size="sm" :loading="savingInstagram" :disabled="savingInstagram" @click="saveInstagramCredentials">
            {{ savingInstagram ? 'Sauvegarde...' : 'Sauvegarder Instagram' }}
          </UiButton>
        </template>
        <p class="text-sm text-ui-ink-2">Configure ici le compte et le token utilisés pour publier le contenu.</p>

        <div class="mt-4 grid gap-4">
          <UiField label="Instagram account ID" for-id="profile-ig-id">
            <UiInput id="profile-ig-id" v-model="instagramForm.instagramAccountId" placeholder="17841400000000000" />
          </UiField>
          <UiField label="Instagram access token" for-id="profile-ig-token">
            <UiTextarea id="profile-ig-token" v-model="instagramForm.instagramAccessToken" :rows="4" placeholder="EAAG..." />
          </UiField>
        </div>

        <div class="mt-6 border-t border-ui-line-soft pt-6">
          <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 class="text-[15px] font-semibold text-ui-ink">Twitter / X</h3>
              <p class="mt-1 text-sm text-ui-ink-2">Connecte le compte X utilisé pour publier le contenu.</p>
            </div>
            <UiButton
              :variant="twitterConnected ? 'secondary' : 'dark'"
              :loading="twitterConnecting"
              :disabled="twitterConnecting || twitterStatusLoading"
              @click="connectTwitter"
            >
              {{ twitterButtonLabel }}
            </UiButton>
          </div>
        </div>
      </UiCard>

      <UiAlert v-if="submitError" title="Enregistrement impossible">{{ submitError }}</UiAlert>

      <div class="flex flex-wrap justify-end gap-3">
        <UiButton @click="router.push('/content')">Annuler</UiButton>
        <UiButton variant="primary" :loading="saving" :disabled="saving || !canSubmit" @click="submit">
          {{ saving ? 'Enregistrement...' : 'Enregistrer' }}
        </UiButton>
      </div>

      <UiCard>
        <template #title><span class="text-ui-danger-ink">Zone de danger</span></template>
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p class="text-sm text-ui-ink-2">Supprime définitivement ce profil {{ profileTypeLabel }} ainsi que tous ses contenus générés.</p>
          <UiButton variant="danger" class="shrink-0" :loading="deleting" :disabled="deleting" @click="deleteProfile">
            {{ deleting ? 'Suppression...' : `Supprimer ce profil ${profileTypeLabel}` }}
          </UiButton>
        </div>
        <UiAlert v-if="deleteError" class="mt-3" title="Suppression impossible">{{ deleteError }}</UiAlert>
      </UiCard>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
const id = computed(() => String(route.params.id || ''))
const activeInfluencerId = useActiveInfluencer()
const { pushToast, requestConfirmation } = useUiFeedback()

// Import direct d une fiche reference, reserve aux comptes admin (le serveur
// re-verifie: ce drapeau ne sert qu a afficher la zone).
const { user: authUser, refreshAuth } = useAuthSession()
await refreshAuth()
const isAdmin = computed(() => Boolean(authUser.value?.isAdmin))
const adminSheetInputRef = ref(null)
const uploadingAdminSheet = ref(false)
const adminSheetError = ref('')

// Fiches deja generees (galerie du compte) : choisir au lieu de regenerer.
const galleryOpen = ref(false)
const galleryLoading = ref(false)
const galleryError = ref('')
const gallerySheets = ref([])
const applyingGalleryId = ref('')
const { ambassadorFor } = useWording()

watch(
  id,
  (value) => {
    if (value) {
      activeInfluencerId.value = value
    }
  },
  { immediate: true },
)

const fetchError = ref('')
const submitError = ref('')
const fileError = ref('')
const generateError = ref('')
const applyError = ref('')
const deleteError = ref('')
const saving = ref(false)
const deleting = ref(false)
const generatingRef = ref(false)
const applyingFaceRef = ref(false)
const savingInstagram = ref(false)
const twitterStatusLoading = ref(false)
const twitterConnecting = ref(false)
const twitterConnected = ref(false)
const twitterUsername = ref('')
const isDragging = ref(false)
const sourceImageBase64 = ref('')
const sourcePreviewUrl = ref('')
const generatedImageBase64 = ref('')
const generatedTempImagePath = ref('')
const currentFaceRefPath = ref('')
const currentFaceRefUrl = ref('')
const currentFaceRefMissing = ref(false)
const fileInputRef = ref(null)
const initialFormState = ref({
  bodyPrompt: '',
  silhouette: 'VOLUPTUOUS',
  gender: 'FEMALE',
  postsPerWeek: 3,
  formatRotation: 'FEED,STORY,REEL',
  publishHour: 18,
})

const silhouetteOptions = computed(() => getSilhouetteOptions(form.gender))
const selectedSilhouetteDescription = computed(() => (
  silhouetteOptions.value.find((option) => option.value === form.silhouette)?.description || ''
))

function setGender(gender) {
  if (form.gender === gender) return
  form.gender = gender
  form.silhouette = getDefaultSilhouette(gender)
}

const form = reactive({
  name: '',
  niche: '',
  style: '',
  gender: 'FEMALE',
  silhouette: 'VOLUPTUOUS',
  bodyPrompt: '',
  hairPrompt: '',
  eyeColor: '',
  ethnicity: '',
  particularities: '',
  postsPerWeek: 3,
  formatRotation: 'FEED,STORY,REEL',
  publishHour: 18,
})

const instagramForm = reactive({
  instagramAccountId: '',
  instagramAccessToken: '',
})

const { data, pending, error, refresh } = await useFetch(() => `/api/profiles/${id.value}`, {
  key: computed(() => `influencer-edit-${id.value}`),
})

const influencer = computed(() => data.value ?? null)

// Rattachement aux marques: une ambassadrice peut en representer plusieurs, et
// jusqu ici rien ne permettait de modifier ce lien une fois le profil cree.
const { data: allProfiles, refresh: refreshProfiles } = await useFetch('/api/profiles', {
  key: 'influencer-edit-profiles',
})
const savingBrands = ref(false)
const brandLinksMessage = ref('')
const selectedBrandIds = ref([])

const brandOptions = computed(() => {
  const list = Array.isArray(allProfiles.value) ? allProfiles.value : []
  return list.filter((item) => item?.id !== id.value && item?.profileType === 'BRAND')
})

watch(
  [allProfiles, id],
  () => {
    const list = Array.isArray(allProfiles.value) ? allProfiles.value : []
    const current = list.find((item) => item?.id === id.value)
    const linked = Array.isArray(current?.brandIds) && current.brandIds.length
      ? current.brandIds
      : (current?.brandId ? [current.brandId] : [])
    selectedBrandIds.value = [...linked]
  },
  { immediate: true },
)

async function saveBrandLinks() {
  savingBrands.value = true
  brandLinksMessage.value = ''

  try {
    await $fetch(`/api/profiles/${id.value}/brands`, {
      method: 'PUT',
      body: { brandIds: selectedBrandIds.value },
    })
    await refreshProfiles()
    brandLinksMessage.value = selectedBrandIds.value.length
      ? 'Marques enregistrées.'
      : 'Plus aucune marque rattachée.'
  } catch (err) {
    brandLinksMessage.value = err?.statusMessage || 'Enregistrement impossible.'
  } finally {
    savingBrands.value = false
  }
}

// Plans editoriaux deja prepares pour ce profil, avec possibilite de les jeter
// sans passer par l ecran de revue.
const { data: plansData, pending: plansPending, refresh: refreshPlans } = await useFetch(
  () => `/api/plans?profileId=${id.value}`,
  { key: computed(() => `plans-for-profile-${id.value}`) },
)
const previousPlans = computed(() => plansData.value?.plans ?? [])
const discardingPlanIds = ref([])

function planStatusLabel(status) {
  if (status === 'APPROVED') return 'Approuvé'
  if (status === 'DISCARDED') return 'Abandonné'
  return 'Brouillon'
}

function planBadgeStatus(status) {
  if (status === 'APPROVED') return 'ready'
  if (status === 'DISCARDED') return 'empty'
  return 'review'
}

function formatPlanDate(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

async function discardPreviousPlan(planItem) {
  discardingPlanIds.value = [...discardingPlanIds.value, planItem.id]

  try {
    await $fetch(`/api/plans/${planItem.id}/discard`, { method: 'POST' })
    await refreshPlans()
  } catch (err) {
    pushToast({
      title: 'Abandon impossible',
      message: err?.statusMessage || 'Le plan n\'a pas pu être abandonné.',
      tone: 'error',
    })
  } finally {
    discardingPlanIds.value = discardingPlanIds.value.filter((planId) => planId !== planItem.id)
  }
}

const nicheItems = computed(() => splitNiches(form.niche))
const styleItems = computed(() => splitNiches(form.style))

// Les niches et les styles restent des chaines separees par des virgules dans le formulaire (et pour l API) ;
// les champs a tags les lisent et les ecrivent sous forme de liste.
const nicheTags = computed({
  get: () => nicheItems.value,
  set: (list) => { form.niche = list.join(', ') },
})
const styleTags = computed({
  get: () => styleItems.value,
  set: (list) => { form.style = list.join(', ') },
})
const genderModel = computed({
  get: () => form.gender,
  set: (value) => setGender(value),
})
const silhouetteSelectOptions = computed(() => silhouetteOptions.value.map((option) => ({
  value: option.value,
  label: `${option.label}${option.isDefault ? ' (par défaut)' : ''}`,
})))
const postsPerWeekModel = computed({
  get: () => form.postsPerWeek,
  set: (value) => { form.postsPerWeek = Number(value) },
})
const hourOptions = Array.from({ length: 24 }, (_, hour) => ({ value: hour, label: `${String(hour).padStart(2, '0')}h` }))
const publishHourModel = computed({
  get: () => form.publishHour,
  set: (value) => { form.publishHour = Number(value) },
})
const FORMAT_CHOICES = ['FEED', 'STORY', 'REEL']
const formatOptions = FORMAT_CHOICES.map((value) => ({ value, label: value }))
const formatRotationModel = computed({
  get: () => String(form.formatRotation || '').split(',').map((part) => part.trim().toUpperCase()).filter((part) => FORMAT_CHOICES.includes(part)),
  set: (list) => { form.formatRotation = FORMAT_CHOICES.filter((choice) => list.includes(choice)).join(',') },
})
const brandChipOptions = computed(() => brandOptions.value.map((brand) => ({ value: brand.id, label: brand.name })))
const isAmbassadorProfile = computed(() => {
  return Boolean(String(influencer.value?.faceRefPath || currentFaceRefPath.value || '').trim())
})
const isMaleProfile = computed(() => String(influencer.value?.gender || '').trim().toUpperCase() === 'MALE')
const profileTypeLabel = computed(() => (isAmbassadorProfile.value ? ambassadorFor(influencer.value?.gender) : 'marque'))
const profileTypeLabelDisplay = computed(() => {
  const label = profileTypeLabel.value
  return label.charAt(0).toUpperCase() + label.slice(1)
})
const linkedBrandLabel = computed(() => {
  const brandName = String(influencer.value?.brandName || '').trim()
  if (isAmbassadorProfile.value && brandName) {
    return `${profileTypeLabel.value} rattaché${isMaleProfile.value ? '' : 'e'} à la marque ${brandName}`
  }

  if (!isAmbassadorProfile.value && brandName) {
    return `${profileTypeLabelDisplay.value} rattaché${isMaleProfile.value ? '' : 'e'} à la marque ${brandName}`
  }

  return ''
})
const settingsDescription = computed(() => {
  if (isAmbassadorProfile.value) {
    return 'Ajoute plusieurs niches si besoin, et remplace la face ref depuis le même écran.'
  }
  return 'Ajoute plusieurs niches et styles si besoin, et connecte tes réseaux sociaux depuis le même écran.'
})
const generatedImageDataUrl = computed(() => {
  if (!generatedImageBase64.value) return ''
  if (generatedImageBase64.value.startsWith('data:image/')) return generatedImageBase64.value
  return `data:image/jpeg;base64,${generatedImageBase64.value}`
})
const currentFaceRefName = computed(() => currentFaceRefPath.value.split(/[\\/]/).pop() || '')
const currentFaceRefFilename = computed(() => currentFaceRefPath.value.split(/[\\/]/).pop() || '')
const canSubmit = computed(() => Boolean(form.name.trim() && nicheItems.value.length && form.style.trim()))

const twitterButtonLabel = computed(() => {
  if (twitterConnecting.value) {
    return 'En attente de connexion... (120s)'
  }

  if (twitterConnected.value) {
    return twitterUsername.value
      ? `Twitter connecté @${twitterUsername.value}`
      : 'Twitter connecté'
  }

  return 'Connecter Twitter'
})

watch(
  () => influencer.value,
  (value) => {
    if (!value) {
      return
    }

    form.name = value.name || ''
    form.niche = value.niche || ''
    form.style = value.style || ''
    form.gender = value.gender || 'FEMALE'
    form.silhouette = value.silhouette || 'VOLUPTUOUS'
    form.bodyPrompt = value.bodyPrompt || ''
    form.hairPrompt = value.hairPrompt || ''
    form.eyeColor = value.eyeColor || ''
    form.ethnicity = value.ethnicity || ''
    form.particularities = value.particularities || ''
    form.postsPerWeek = Number.isFinite(Number(value.postsPerWeek)) ? Number(value.postsPerWeek) : 3
    form.formatRotation = value.formatRotation || 'FEED,STORY,REEL'
    form.publishHour = Number.isFinite(Number(value.publishHour)) ? Number(value.publishHour) : 18
    instagramForm.instagramAccountId = value.instagramAccountId || ''
    instagramForm.instagramAccessToken = value.instagramAccessToken || ''
    initialFormState.value = {
      bodyPrompt: form.bodyPrompt,
      silhouette: form.silhouette,
      gender: form.gender,
      eyeColor: form.eyeColor,
      ethnicity: form.ethnicity,
      particularities: form.particularities,
      postsPerWeek: form.postsPerWeek,
      formatRotation: form.formatRotation,
      publishHour: form.publishHour,
    }
    currentFaceRefPath.value = value.faceRefPath || ''
    currentFaceRefUrl.value = value.faceRefUrl || (currentFaceRefFilename.value ? `/api/media/face-refs/${encodeURIComponent(currentFaceRefFilename.value)}` : '')
    currentFaceRefMissing.value = false
  },
  { immediate: true },
)

watch(
  id,
  async (value) => {
    if (!value) {
      twitterConnected.value = false
      twitterUsername.value = ''
      return
    }

    await loadTwitterStatus(value)
  },
  { immediate: true },
)

watch(
  () => error.value,
  (value) => {
    fetchError.value = value?.data?.statusMessage || value?.message || ''
  },
  { immediate: true },
)

function extractHttpErrorDetails(err) {
  const statusCode = Number(err?.statusCode || err?.response?.status || err?.data?.statusCode || 0)
  const statusMessage = String(err?.statusMessage || err?.data?.statusMessage || err?.data?.message || err?.message || '')
  return { statusCode, statusMessage }
}

function openFilePicker() {
  fileInputRef.value?.click()
}

function validImage(file) {
  if (!file) return false
  return ['image/jpeg', 'image/png'].includes(file.type)
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => {
      const result = String(reader.result || '')
      const base64 = result.includes(',') ? result.split(',')[1] : ''
      if (!base64) {
        reject(new Error('Impossible de lire l\'image source'))
        return
      }
      resolve(base64)
    }

    reader.onerror = () => {
      reject(new Error('Impossible de lire l\'image source'))
    }

    reader.readAsDataURL(file)
  })
}

function onCurrentFaceRefError() {
  currentFaceRefMissing.value = true
}

function resetFaceRefFlow() {
  if (sourcePreviewUrl.value) {
    URL.revokeObjectURL(sourcePreviewUrl.value)
  }
  sourceImageBase64.value = ''
  sourcePreviewUrl.value = ''
  generatedImageBase64.value = ''
  generatedTempImagePath.value = ''
  fileError.value = ''
  generateError.value = ''
  applyError.value = ''
}

async function setFile(file) {
  fileError.value = ''
  generateError.value = ''
  generatedImageBase64.value = ''
  generatedTempImagePath.value = ''

  if (!validImage(file)) {
    sourceImageBase64.value = ''
    fileError.value = 'Format invalide. Utilise un fichier JPG ou PNG.'
    return
  }

  if (sourcePreviewUrl.value) {
    URL.revokeObjectURL(sourcePreviewUrl.value)
  }
  sourcePreviewUrl.value = URL.createObjectURL(file)

  try {
    sourceImageBase64.value = await readFileAsBase64(file)
  } catch (err) {
    sourceImageBase64.value = ''
    fileError.value = err?.message || String(err)
  }
}

async function onFileSelect(event) {
  const file = event.target?.files?.[0]
  if (!file) return
  await setFile(file)
}

async function onDrop(event) {
  isDragging.value = false
  const file = event.dataTransfer?.files?.[0]
  if (!file) return
  await setFile(file)
}

async function generateFaceReference(method = 'default') {
  if (!sourceImageBase64.value || generatingRef.value) return

  generatingRef.value = true
  generateError.value = ''

  try {
    // "contact_sheet_9" est une methode alternative explicite (bouton
    // "Essayer une autre methode"), jamais choisie automatiquement.
    const customPrompt = getAltFaceRefPrompt(method) || FACE_REF_BASE_PROMPT

    const payload = await $fetch('/api/generate/face-ref', {
      method: 'POST',
      body: {
        sourceImageBase64: sourceImageBase64.value,
        customPrompt,
        method,
        profileId: id.value,
      },
    })

    generatedImageBase64.value = payload?.imageBase64 || ''
    generatedTempImagePath.value = payload?.tempImagePath || ''

    if (!generatedImageBase64.value || !generatedTempImagePath.value) {
      throw new Error('La génération n\'a pas retourné d\'image exploitable')
    }
  } catch (err) {
    generateError.value = err?.data?.statusMessage || err?.message || String(err)
  } finally {
    generatingRef.value = false
  }
}

function openAdminSheetPicker() {
  adminSheetInputRef.value?.click()
}

async function onAdminSheetSelect(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file || uploadingAdminSheet.value) return

  uploadingAdminSheet.value = true
  adminSheetError.value = ''

  try {
    const formData = new FormData()
    formData.append('file', file)

    await $fetch(`/api/profiles/${id.value}/face-ref-upload`, {
      method: 'POST',
      body: formData,
    })

    resetFaceRefFlow()
    await refresh()

    pushToast({
      title: 'Fiche importée',
      message: 'Ta fiche référence remplace la face ref actuelle.',
      tone: 'success',
    })
  } catch (err) {
    adminSheetError.value = err?.data?.statusMessage || err?.message || 'Import impossible'
  } finally {
    uploadingAdminSheet.value = false
  }
}

function formatSheetDate(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

async function loadGallery() {
  galleryLoading.value = true
  galleryError.value = ''
  try {
    const result = await $fetch('/api/face-ref-sheets')
    const sheets = Array.isArray(result?.sheets) ? result.sheets : []
    // Les fiches generees pour cette persona d abord.
    gallerySheets.value = [...sheets].sort((a, b) => Number(b.profileId === id.value) - Number(a.profileId === id.value))
  } catch (err) {
    galleryError.value = err?.statusCode === 503 || err?.data?.statusCode === 503
      ? 'La galerie n’est pas encore activée sur ce serveur.'
      : (err?.data?.statusMessage || err?.message || 'Erreur inconnue')
  } finally {
    galleryLoading.value = false
  }
}

async function toggleGallery() {
  galleryOpen.value = !galleryOpen.value
  if (galleryOpen.value && !gallerySheets.value.length) await loadGallery()
}

// La fiche choisie est recopiee puis appliquee par la route d application existante.
async function applyGallerySheet(sheet) {
  if (applyingGalleryId.value) return

  const confirmed = await requestConfirmation({
    title: 'Utiliser cette fiche ?',
    message: `Elle remplacera la fiche de référence actuelle de ce ${profileTypeLabel.value}. Les prochains contenus s’appuieront sur elle.`,
    confirmLabel: 'Remplacer la fiche',
    cancelLabel: 'Annuler',
  })
  if (!confirmed) return

  applyingGalleryId.value = sheet.id
  try {
    const prepared = await $fetch(`/api/face-ref-sheets/${sheet.id}/prepare`, { method: 'POST' })
    await $fetch('/api/upload/face-ref', {
      method: 'POST',
      body: { influencerId: id.value, tempImagePath: prepared.tempImagePath },
    })
    galleryOpen.value = false
    await refresh()
    pushToast({ title: 'Face ref mise à jour', message: 'La fiche choisie a été appliquée.', tone: 'success' })
  } catch (err) {
    pushToast({
      title: 'Application impossible',
      message: err?.data?.statusMessage || err?.message || 'Erreur inconnue',
      tone: 'error',
      duration: 6000,
    })
  } finally {
    applyingGalleryId.value = ''
  }
}

function regenerateFaceReference() {
  generatedImageBase64.value = ''
  generatedTempImagePath.value = ''
  applyError.value = ''
}

async function applyGeneratedFaceRef() {
  if (!generatedTempImagePath.value || applyingFaceRef.value) return

  applyingFaceRef.value = true
  applyError.value = ''

  try {
    await $fetch('/api/upload/face-ref', {
      method: 'POST',
      body: {
        influencerId: id.value,
        tempImagePath: generatedTempImagePath.value,
      },
    })

    resetFaceRefFlow()
    await refresh()

    pushToast({
      title: 'Face ref mise à jour',
      message: 'La nouvelle fiche référence a été appliquée.',
      tone: 'success',
    })
  } catch (err) {
    const message = err?.data?.statusMessage || err?.message || 'Application impossible'
    applyError.value = message
    pushToast({
      title: 'Application impossible',
      message,
      tone: 'error',
      duration: 4500,
    })
  } finally {
    applyingFaceRef.value = false
  }
}

async function saveInstagramCredentials() {
  if (savingInstagram.value) {
    return
  }

  savingInstagram.value = true
  try {
    await $fetch(`/api/profiles/${id.value}/instagram`, {
      method: 'PATCH',
      body: {
        instagramAccountId: instagramForm.instagramAccountId,
        instagramAccessToken: instagramForm.instagramAccessToken,
      },
    })

    pushToast({
      title: 'Instagram mis à jour',
      message: 'Les credentials Instagram ont été enregistrés.',
      tone: 'success',
    })
    await refresh()
  } catch (err) {
    const message = err?.data?.statusMessage || err?.message || 'Sauvegarde impossible'
    pushToast({
      title: 'Instagram',
      message,
      tone: 'error',
      duration: 4500,
    })
  } finally {
    savingInstagram.value = false
  }
}

async function loadTwitterStatus(influencerId) {
  twitterStatusLoading.value = true
  try {
    const response = await $fetch(`/api/profiles/${influencerId}/twitter-status`)
    twitterConnected.value = Boolean(response?.connected)
    twitterUsername.value = String(response?.username || '').trim()
  } catch {
    twitterConnected.value = false
    twitterUsername.value = ''
  } finally {
    twitterStatusLoading.value = false
  }
}

async function connectTwitter() {
  if (!id.value || twitterConnecting.value) {
    return
  }

  twitterConnecting.value = true
  try {
    const response = await $fetch(`/api/profiles/${id.value}/twitter-connect`, { method: 'POST' })
    twitterConnected.value = Boolean(response?.connected ?? response?.success)
    twitterUsername.value = String(response?.username || '').trim()

    pushToast({
      title: 'Twitter connecté',
      message: twitterUsername.value
        ? `Compte @${twitterUsername.value} prêt pour la publication.`
        : 'Compte connecté, publication prête.',
      tone: 'success',
    })
    await refresh()
  } catch (err) {
    const { statusMessage } = extractHttpErrorDetails(err)
    pushToast({
      title: 'Connexion Twitter impossible',
      message: statusMessage || 'La connexion n\'a pas pu être finalisée.',
      tone: 'error',
      duration: 6000,
    })
  } finally {
    twitterConnecting.value = false
  }
}

async function submit() {
  if (!canSubmit.value || saving.value) {
    return
  }

  saving.value = true
  submitError.value = ''

  try {
    const patchBody = {
      name: form.name.trim(),
      niche: form.niche,
      style: form.style.trim(),
    }

    if (form.bodyPrompt !== initialFormState.value.bodyPrompt) {
      patchBody.bodyPrompt = form.bodyPrompt
    }

    if (form.silhouette !== initialFormState.value.silhouette) {
      patchBody.silhouette = form.silhouette
    }

    if (form.gender !== initialFormState.value.gender) {
      patchBody.gender = form.gender
    }

    if (form.eyeColor !== initialFormState.value.eyeColor) {
      patchBody.eyeColor = form.eyeColor
    }

    if (form.ethnicity !== initialFormState.value.ethnicity) {
      patchBody.ethnicity = form.ethnicity
    }

    if (form.particularities !== initialFormState.value.particularities) {
      patchBody.particularities = form.particularities
    }

    if (form.postsPerWeek !== initialFormState.value.postsPerWeek) {
      patchBody.postsPerWeek = form.postsPerWeek
    }

    if (form.formatRotation !== initialFormState.value.formatRotation) {
      patchBody.formatRotation = form.formatRotation
    }

    if (form.publishHour !== initialFormState.value.publishHour) {
      patchBody.publishHour = form.publishHour
    }

    await $fetch(`/api/profiles/${id.value}`, {
      method: 'PATCH',
      body: patchBody,
    })

    await refresh()

    pushToast({
      title: `${profileTypeLabelDisplay.value} mis${isMaleProfile.value ? '' : 'e'} à jour`,
      message: 'Les modifications ont bien été enregistrées.',
      tone: 'success',
    })

    await router.push('/content')
  } catch (err) {
    const message = err?.data?.statusMessage || err?.message || String(err)
    submitError.value = message
    pushToast({
      title: 'Mise à jour impossible',
      message,
      tone: 'error',
      duration: 4500,
    })
  } finally {
    saving.value = false
  }
}

async function deleteProfile() {
  if (deleting.value || !id.value) {
    return
  }

  deleteError.value = ''

  const confirmed = await requestConfirmation({
    title: `Supprimer ce profil ${profileTypeLabel.value} ?`,
    message: `Cette action est irréversible : le profil "${form.name || influencer.value?.name || ''}" et tous ses contenus générés seront définitivement supprimés.`,
    confirmLabel: 'Supprimer définitivement',
    cancelLabel: 'Annuler',
    tone: 'danger',
  })

  if (!confirmed) {
    return
  }

  deleting.value = true
  try {
    await $fetch(`/api/profiles/${id.value}`, { method: 'DELETE' })

    if (activeInfluencerId.value === id.value) {
      activeInfluencerId.value = ''
    }

    pushToast({
      title: 'Profil supprimé',
      message: 'Le profil a bien été supprimé.',
      tone: 'success',
    })

    await router.push('/content')
  } catch (err) {
    const message = err?.data?.statusMessage || err?.message || 'Suppression impossible'
    deleteError.value = message
    pushToast({
      title: 'Suppression impossible',
      message,
      tone: 'error',
      duration: 4500,
    })
  } finally {
    deleting.value = false
  }
}

onBeforeUnmount(() => {
  if (sourcePreviewUrl.value) {
    URL.revokeObjectURL(sourcePreviewUrl.value)
  }
})
</script>