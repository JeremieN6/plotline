<template>
  <div class="font-ui">
    <header class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p class="text-xs font-semibold uppercase tracking-[0.08em] text-ui-accent">Admin · laboratoire</p>
        <h1 class="mt-1 text-2xl font-bold tracking-[-0.01em] text-ui-ink">Générateur de personnalité</h1>
      </div>
      <div v-if="isAdmin && schema" class="flex flex-wrap items-center gap-3">
        <span v-if="saveMessage" class="text-xs text-ui-success-ink">{{ saveMessage }}</span>
        <UiButton variant="secondary" :disabled="!personality" @click="exportJson">Exporter JSON</UiButton>
      </div>
    </header>

    <UiAlert v-if="!isAdmin" class="mt-6" title="Page réservée aux administrateurs">
      Ton compte n'est pas dans la liste des administrateurs. Demande l'accès à la personne qui gère la variable ADMIN_ACCOUNTS.
    </UiAlert>

    <div v-else-if="!schema && !schemaError" class="mt-6"><UiSkeleton :lines="4" /></div>

    <UiAlert v-else-if="schemaError" class="mt-6" title="Impossible de charger le registre de personnalité">
      {{ errorMessage || 'Le serveur n\'a pas répondu.' }}
      <template #action><UiButton variant="secondary" size="sm" @click="loadSchema(kind)">Réessayer</UiButton></template>
    </UiAlert>

    <div v-else class="mt-6 grid items-start gap-5 lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[300px_minmax(0,1fr)_300px]">
      <!-- Colonne gauche : brief, progression, navigation -->
      <aside class="grid gap-5">
        <UiCard>
          <template #title>Brief</template>
          <template #actions>
            <UiButton variant="ghost" size="sm" :disabled="isBusy" @click="briefOpen = !briefOpen">
              {{ briefOpen ? 'Replier' : 'Modifier' }}
            </UiButton>
          </template>

          <div v-if="briefOpen" class="grid gap-4">
            <UiField label="Profil existant" for-id="pg-profile" hint="Nom, niche, style et physique du profil sont repris et ne sont jamais modifiés.">
              <UiSelect id="pg-profile" v-model="profileId" :options="profileOptions" :disabled="isBusy" @update:model-value="onProfileChange" />
            </UiField>
            <UiField v-if="!profileId" label="Type de profil">
              <UiSegmented v-model="kind" :options="kindOptions" label="Type de profil" :disabled="isBusy" @update:model-value="onKindChange" />
            </UiField>
            <UiSlider id="pg-ecc" v-model="eccentricity" label="Excentricité" :min="1" :max="5" :step="1" :disabled="isBusy" />
            <p class="-mt-2 text-xs text-ui-ink-muted">{{ eccentricityHint }}</p>
            <UiField label="Langue du contenu" for-id="pg-lang">
              <UiSelect id="pg-lang" v-model="language" :options="languages" :disabled="isBusy" />
            </UiField>
            <UiField label="Plateformes">
              <UiToggleChips v-model="platforms" :options="platformOptions" label="Plateformes" :disabled="isBusy" />
            </UiField>
            <UiField label="Consigne libre" for-id="pg-free">
              <UiTextarea id="pg-free" v-model="freeText" :rows="3" :maxlength="1500" :disabled="isBusy" placeholder="Ex : ton sec, pas de morale, plutôt rurale…" />
            </UiField>
          </div>

          <div v-else class="grid gap-2 text-sm text-ui-ink-2">
            <div class="flex flex-wrap gap-1.5">
              <span v-for="chip in briefChips" :key="chip" class="rounded-ui-tag bg-ui-subtle px-2 py-1 text-xs text-ui-ink">{{ chip }}</span>
            </div>
            <p v-if="freeText.trim()" class="text-ui-ink-muted">« {{ freeText.trim() }} »</p>
          </div>

          <div class="mt-5 grid gap-2">
            <UiButton v-if="!chain.running && !chain.paused" variant="primary" :disabled="isBusy" @click="runChain(0)">
              <template #icon>
                <svg class="h-4 w-4" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M10 2.5 11.7 8.3 17.5 10l-5.8 1.7L10 17.5l-1.7-5.8L2.5 10l5.8-1.7L10 2.5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" /></svg>
              </template>
              {{ personality ? 'Générer / compléter' : 'Tout générer' }}
            </UiButton>
            <UiButton v-else-if="chain.running" variant="primary" :disabled="chain.pauseRequested" @click="chain.pauseRequested = true">
              {{ chain.pauseRequested ? 'Pause après cette étape…' : 'Mettre en pause' }}
            </UiButton>
            <UiButton v-else variant="primary" @click="runChain(chain.cursor)">Reprendre</UiButton>

            <div class="grid grid-cols-2 gap-2">
              <UiButton variant="secondary" size="sm" :disabled="!profileId || !personality || isBusy" :loading="saving" @click="saveToProfile">
                Enregistrer sur ce profil
              </UiButton>
              <UiButton variant="danger" size="sm" :disabled="!personality || isBusy" @click="resetAll">Tout effacer</UiButton>
            </div>
            <p class="text-center text-xs text-ui-ink-muted">Les champs saisis ou verrouillés sont toujours conservés.</p>
            <p v-if="lastDuration" class="text-center text-xs text-ui-ink-muted">Dernière génération : {{ lastDuration }} s.</p>
          </div>
        </UiCard>

        <UiCard>
          <UiProgress label="Fiche personnalité" :value="validatedCount" :max="schema.blocks.length" />
          <!-- Sur mobile, la liste verticale des 9 blocs pousserait le contenu 400 px plus bas :
               on navigue par la vue d'ensemble et les boutons precedent / suivant. -->
          <div class="mt-3 hidden lg:block">
            <UiSectionNav :items="navItems" :active="mode === 'block' ? activeKey : ''" label="Blocs de la personnalité" @update:active="openBlock" />
          </div>
        </UiCard>

        <UiCard v-if="usageTotal.calls">
          <template #title>Consommation</template>
          <template #actions>
            <UiButton variant="ghost" size="sm" :disabled="isBusy" @click="resetUsage">Remettre à zéro</UiButton>
          </template>
          <dl class="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt class="text-ui-ink-muted">Appels Claude</dt>
            <dd class="text-right font-ui-mono font-medium text-ui-ink">{{ usageTotal.calls }}</dd>
            <dt class="text-ui-ink-muted">Tokens envoyés</dt>
            <dd class="text-right font-ui-mono font-medium text-ui-ink">{{ formatCount(usageTotal.inputTokens) }}</dd>
            <dt class="text-ui-ink-muted">Tokens reçus</dt>
            <dd class="text-right font-ui-mono font-medium text-ui-ink">{{ formatCount(usageTotal.outputTokens) }}</dd>
            <dt class="text-ui-ink-muted">Coût estimé</dt>
            <dd class="text-right font-ui-mono font-medium text-ui-ink">{{ usageCostLabel }}</dd>
          </dl>
          <p class="mt-3 text-xs text-ui-ink-muted">
            Modèle : <span class="font-ui-mono">{{ usageTotal.model || 'inconnu' }}</span>. Les tokens sont exacts (renvoyés par Anthropic) et comptent
            depuis l'ouverture de cette page ; le coût est une estimation à vérifier sur la console Anthropic.
          </p>
        </UiCard>
      </aside>

      <!-- Colonne centrale -->
      <main ref="mainRef" class="grid scroll-mt-20 gap-5">
        <UiAlert v-if="errorMessage && !schemaError" title="Une action a échoué">
          {{ errorMessage }}
        </UiAlert>

        <!-- Vue d'ensemble : enchaînement des blocs -->
        <template v-if="mode === 'overview'">
          <UiEmptyState
            v-if="!personality && !chain.running"
            title="Aucune personnalité pour l'instant"
            text="Règle le brief puis lance « Tout générer ». La génération se fait bloc par bloc et peut être mise en pause."
          />

          <template v-else>
            <div class="rounded-ui-card bg-ui-subtle px-5 py-3 text-sm text-ui-ink">
              <template v-if="chain.running">
                <strong>Génération en cours</strong> · étape {{ Math.min(chain.cursor + 1, chainGroups.length) }} / {{ chainGroups.length }}
                <span class="text-ui-ink-2"> : {{ currentGroupLabel }}</span>
                <span class="float-right font-ui-mono text-xs text-ui-ink-muted">{{ revealed.length }} {{ revealed.length > 1 ? 'blocs générés' : 'bloc généré' }}</span>
              </template>
              <template v-else-if="chain.paused && failedGroups.length">
                <strong>Génération interrompue après {{ revealed.length }} {{ revealed.length > 1 ? 'blocs' : 'bloc' }}.</strong> Les blocs déjà générés sont conservés.
              </template>
              <template v-else-if="chain.paused">
                <strong>En pause après {{ revealed.length }} {{ revealed.length > 1 ? 'blocs' : 'bloc' }}.</strong> Reprends quand tu veux.
              </template>
              <template v-else>
                <strong>{{ validatedCount }} / {{ schema.blocks.length }} blocs validés.</strong> Ouvre un bloc pour le relire ou le corriger.
              </template>
            </div>

            <UiAlert
              v-for="failure in failedGroups"
              :key="`group-${failure.index}`"
              :title="`Étape ${failure.index + 1} n'a pas pu être générée`"
            >
              {{ failure.message }} Blocs concernés : {{ failure.labels }}. Les autres blocs sont intacts.
              <template #action>
                <UiButton variant="secondary" size="sm" :disabled="isBusy" @click="retryFailed">Réessayer</UiButton>
              </template>
            </UiAlert>

            <UiAlert v-for="(message, key) in blockErrors" :key="`block-${key}`" :title="`« ${labelOf(key)} » n'a pas pu être régénéré`">
              {{ message }} Le contenu précédent est conservé.
              <template #action>
                <UiButton variant="secondary" size="sm" :disabled="isBusy" @click="regenerateBlock(key)">Réessayer ce bloc</UiButton>
              </template>
            </UiAlert>

            <UiSkeleton v-if="chain.running && !listedBlocks.length" :lines="3" />

            <UiCard v-for="block in listedBlocks" :key="block.key">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <div class="flex flex-wrap items-center gap-2">
                    <h2 class="text-[15px] font-semibold text-ui-ink">{{ block.label }}</h2>
                    <UiBadge :status="statusOf(block.key)" />
                    <span v-if="keptCount(block) && statusOf(block.key) !== 'error'" class="text-xs text-ui-ink-muted">
                      {{ keptCount(block) }} {{ keptCount(block) > 1 ? 'champs conservés' : 'champ conservé' }}
                    </span>
                  </div>
                  <p v-if="blockState[block.key] === 'running'" class="mt-1 text-sm text-ui-ink-muted">Génération en cours…</p>
                  <p v-else-if="blockState[block.key] === 'error'" class="mt-1 text-sm text-ui-danger-ink">Génération en échec : voir le message ci-dessus.</p>
                  <p v-else class="mt-1 text-sm text-ui-ink-2">{{ summaryOf(block) || 'Rien de renseigné pour l\'instant.' }}</p>
                </div>
                <div class="flex shrink-0 gap-2">
                  <UiButton variant="secondary" size="sm" :disabled="isBusy || blockState[block.key] === 'error'" @click="openBlock(block.key)">Ouvrir</UiButton>
                </div>
              </div>
            </UiCard>
          </template>
        </template>

        <!-- Édition d'un bloc -->
        <UiCard v-else-if="activeBlock">
          <div class="-mt-1 mb-5">
            <div class="flex items-center justify-between gap-3">
              <p class="font-ui-mono text-xs font-medium uppercase tracking-[0.08em] text-ui-ink-muted">Bloc {{ activeIndex + 1 }} / {{ schema.blocks.length }}</p>
              <UiButton variant="ghost" size="sm" @click="mode = 'overview'; scrollToMain()">Vue d'ensemble</UiButton>
            </div>
            <h2 class="mt-1 text-xl font-bold text-ui-ink">{{ activeBlock.label }}</h2>
            <p v-if="blockHint(activeBlock.key)" class="mt-1 max-w-xl text-sm text-ui-ink-2">{{ blockHint(activeBlock.key) }}</p>
            <div class="mt-4 flex flex-wrap gap-2">
              <UiButton variant="secondary" size="sm" :disabled="isBusy || !lockableCount(activeBlock)" @click="toggleBlockLock(activeBlock)">
                {{ blockFullyLocked(activeBlock) ? 'Déverrouiller le bloc' : 'Verrouiller le bloc' }}
              </UiButton>
              <UiButton variant="secondary" size="sm" :disabled="isBusy" :loading="blockState[activeBlock.key] === 'running'" @click="regenerateBlock(activeBlock.key)">
                Régénérer
              </UiButton>
            </div>
          </div>

          <div class="grid gap-5 border-t border-ui-line-soft pt-5 md:grid-cols-2">
            <UiField
              v-for="field in visibleFields(activeBlock)"
              :key="field.key"
              :label="field.label"
              :for-id="`f-${activeBlock.key}-${field.key}`"
              :hint="field.optional ? 'Facultatif' : ''"
              :class="isWide(field) ? 'md:col-span-2' : ''"
            >
              <template #meta>
                <span class="flex items-center gap-3 text-xs">
                  <UiBadge v-if="isReadOnly(activeBlock.key, field.key)" status="profile" />
                  <button
                    v-else-if="canLock(activeBlock.key, field.key)"
                    type="button"
                    class="text-ui-ink-muted underline decoration-ui-line-input underline-offset-2 hover:text-ui-ink"
                    :disabled="isBusy"
                    @click="toggleLock(activeBlock.key, field.key)"
                  >
                    {{ isLocked(activeBlock.key, field.key) ? 'Déverrouiller' : 'Verrouiller' }}
                  </button>
                  <button
                    v-if="isBio(field.key) && textOf(activeBlock.key, field)"
                    type="button"
                    class="text-ui-ink-muted underline decoration-ui-line-input underline-offset-2 hover:text-ui-ink"
                    @click="copy(textOf(activeBlock.key, field))"
                  >Copier</button>
                </span>
              </template>

              <UiTagInput
                v-if="field.type === 'list'"
                :model-value="listOf(activeBlock.key, field.key)"
                :max-items="field.max || 0"
                :item-max="field.itemMax || 0"
                :disabled="isBusy || isReadOnly(activeBlock.key, field.key)"
                :id="`f-${activeBlock.key}-${field.key}`"
                @update:model-value="setField(activeBlock, field, $event)"
              />
              <UiInput
                v-else-if="field.type === 'number'"
                :id="`f-${activeBlock.key}-${field.key}`"
                type="number"
                :min="field.min ?? undefined"
                :max="field.max ?? undefined"
                :model-value="textOf(activeBlock.key, field)"
                :disabled="isBusy || isReadOnly(activeBlock.key, field.key)"
                @update:model-value="setField(activeBlock, field, $event)"
              />
              <UiTextarea
                v-else-if="field.type === 'longtext' || (field.max || 0) > 120"
                :id="`f-${activeBlock.key}-${field.key}`"
                :rows="field.type === 'longtext' ? 5 : 2"
                :maxlength="field.max || 0"
                :model-value="textOf(activeBlock.key, field)"
                :disabled="isBusy || isReadOnly(activeBlock.key, field.key)"
                @update:model-value="setField(activeBlock, field, $event)"
              />
              <UiInput
                v-else
                :id="`f-${activeBlock.key}-${field.key}`"
                :maxlength="field.max || undefined"
                :model-value="textOf(activeBlock.key, field)"
                :disabled="isBusy || isReadOnly(activeBlock.key, field.key)"
                @update:model-value="setField(activeBlock, field, $event)"
              />
            </UiField>
          </div>

          <UiAlert v-if="blockErrors[activeBlock.key]" class="mt-5" :title="`« ${activeBlock.label} » n'a pas pu être régénéré`">
            {{ blockErrors[activeBlock.key] }} Le contenu précédent est conservé.
            <template #action>
              <UiButton variant="secondary" size="sm" :disabled="isBusy" @click="regenerateBlock(activeBlock.key)">Réessayer ce bloc</UiButton>
            </template>
          </UiAlert>
          <UiAlert v-else-if="groupErrorOf(activeBlock.key)" class="mt-5" title="Ce bloc n'a pas pu être généré">
            {{ groupErrorOf(activeBlock.key) }} Les autres blocs sont intacts.
            <template #action>
              <UiButton variant="secondary" size="sm" :disabled="isBusy" @click="retryFailed">Réessayer</UiButton>
            </template>
          </UiAlert>

          <div class="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-ui-line-soft pt-5">
            <UiButton v-if="previousBlock" variant="ghost" @click="openBlock(previousBlock.key)">‹ {{ previousBlock.label }}</UiButton>
            <span v-else />
            <UiButton variant="dark" :disabled="isBusy" @click="validateAndNext">
              {{ nextBlock ? `Valider et passer à ${nextBlock.label}` : 'Valider et terminer' }}
              <span aria-hidden="true">›</span>
            </UiButton>
          </div>
        </UiCard>
      </main>

      <!-- Colonne droite : persona -->
      <aside class="grid gap-5 lg:col-span-2 xl:col-span-1 xl:block">
        <UiCard>
          <div class="-m-5 mb-4 flex h-40 items-center justify-center overflow-hidden rounded-t-ui-card bg-ui-subtle">
            <img v-if="faceRefSrc" :src="faceRefSrc" alt="Fiche de référence du persona" class="h-full w-full object-contain">
            <span v-else class="font-ui-mono text-xs text-ui-ink-muted">[ Face ref du persona ]</span>
          </div>
          <p class="text-lg font-bold text-ui-ink">{{ selectedProfile?.name || 'Laboratoire libre' }}</p>
          <p class="mt-1 text-sm text-ui-ink-2">
            {{ selectedProfile ? 'Profil existant : son physique, sa niche et son style sont imposés.' : 'Aucun profil lié : rien n\'est enregistré tant que tu n\'en choisis pas un.' }}
          </p>
          <div v-if="selectedNiches.length" class="mt-3 flex flex-wrap gap-1.5">
            <span v-for="niche in selectedNiches" :key="niche" class="rounded-ui-tag bg-ui-subtle px-2 py-1 text-xs text-ui-ink">{{ niche }}</span>
          </div>
        </UiCard>
      </aside>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, reactive, ref } from 'vue'

useHead({ title: 'Générateur de personnalité' })

const { user: authUser, refreshAuth } = useAuthSession()
await refreshAuth()
const isAdmin = computed(() => Boolean(authUser.value?.isAdmin))

const requestFetch = useRequestFetch()

const languages = [
  { value: 'français', label: 'Français' },
  { value: 'English', label: 'English' },
  { value: 'español', label: 'Español' },
  { value: 'português', label: 'Português' },
  { value: 'Deutsch', label: 'Deutsch' },
  { value: 'italiano', label: 'Italiano' },
]
const kindOptions = [
  { value: 'PERSONA', label: 'Persona' },
  { value: 'BRAND', label: 'Marque' },
  { value: 'ACTIVITY', label: 'Activité' },
]
const eccentricityHints = {
  1: 'Crédible, proche de la niche, sans extravagance.',
  2: 'Plutôt crédible, un ou deux détails inattendus.',
  3: 'Crédible mais atypique dans son parcours ou ses obsessions.',
  4: 'Très atypique, tout en restant plausible.',
  5: 'Franchement décalé, combinaisons improbables mais cohérentes.',
}
const BLOCK_HINTS = {
  identity: 'Qui est le personnage : nom, âge, lieu, métier.',
  backstory: 'Son parcours et ce qui l\'a mené là.',
  beliefs: 'Ce qu\'il défend, ce qu\'il refuse, ses contradictions.',
  tastes: 'Ses goûts, ses obsessions et ses rituels.',
  voice: 'Comment il parle. Ce bloc alimente les captions et les scripts vidéo.',
  editorial: 'Niche, piliers de contenu et promesse faite à l\'audience.',
  appearance: 'Style visuel, déduit de son histoire et de son mode de vie.',
  lore: 'Son entourage et les anecdotes qui reviennent.',
  platforms: 'Bios et signature, plateforme par plateforme.',
}

const kind = ref('PERSONA')
const eccentricity = ref(3)
const language = ref('français')
const platforms = ref(['instagram', 'tiktok'])
const freeText = ref('')
const profileId = ref('')
const profiles = ref([])
const schema = ref(null)
const schemaError = ref(false)
const personality = ref(null)
const readOnly = ref([])
const errorMessage = ref('')
const lastDuration = ref(0)
// Consommation cumulee depuis l'ouverture de la page. `costUsd` vaut null des qu'un appel
// n'a pas de tarif connu (jamais un total partiel presente comme complet).
const usageTotal = ref({ calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0, model: '' })
const hasStored = ref(false)
const saving = ref(false)
const saveMessage = ref('')
const briefOpen = ref(true)
const mainRef = ref(null)

// Navigation : vue d'ensemble (enchainement) ou edition d'un bloc.
const mode = ref('overview')
const activeKey = ref('')
const validated = ref([])

// Etat par bloc ('running' | 'error') et messages d'erreur.
const blockState = reactive({})
const blockErrors = reactive({})
// Chaine : `cursor` = indice du groupe (2 groupes de blocs, 2 appels Claude).
const chain = reactive({ running: false, paused: false, pauseRequested: false, cursor: 0 })
const groupErrors = reactive({})
const pending = ref([])
const revealed = ref([])

const isBusy = computed(() => chain.running || Object.values(blockState).includes('running'))
const eccentricityHint = computed(() => eccentricityHints[eccentricity.value] || '')
const platformOptions = computed(() => (schema.value?.platforms || []).map((item) => ({ value: item, label: item.charAt(0).toUpperCase() + item.slice(1) })))
const profileOptions = computed(() => [
  { value: '', label: 'Aucun (laboratoire libre)' },
  ...profiles.value.map((item) => ({ value: item.id, label: `${item.name} · ${item.profileType}` })),
])
const selectedProfile = computed(() => profiles.value.find((item) => item.id === profileId.value) || null)
const selectedNiches = computed(() => String(selectedProfile.value?.niche || '').split(',').map((item) => item.trim()).filter(Boolean).slice(0, 5))
const faceRefSrc = computed(() => {
  const path = String(selectedProfile.value?.faceRefPath || '').trim()
  if (!path) return ''
  if (/^https?:\/\//i.test(path)) return path
  return `/api/media/face-refs/${encodeURIComponent(path.split(/[\\/]/).pop())}`
})
const briefChips = computed(() => [
  kindOptions.find((item) => item.value === kind.value)?.label || kind.value,
  `Excentricité ${eccentricity.value}`,
  languages.find((item) => item.value === language.value)?.label || language.value,
  platforms.value.map((item) => item.charAt(0).toUpperCase() + item.slice(1)).join(' · ') || 'Aucune plateforme',
])

const blocks = computed(() => schema.value?.blocks || [])
const activeBlock = computed(() => blocks.value.find((block) => block.key === activeKey.value) || null)
const activeIndex = computed(() => blocks.value.findIndex((block) => block.key === activeKey.value))
const previousBlock = computed(() => (activeIndex.value > 0 ? blocks.value[activeIndex.value - 1] : null))
const nextBlock = computed(() => (activeIndex.value >= 0 ? blocks.value[activeIndex.value + 1] || null : null))
const chainGroups = computed(() => schema.value?.steps || [])
const chainActive = computed(() => chain.running || chain.paused)
const currentGroupLabel = computed(() => (chainGroups.value[chain.cursor] || [])
  .map((key) => blocks.value.find((block) => block.key === key)?.label)
  .filter(Boolean)
  .join(', '))
const failedGroups = computed(() => Object.entries(groupErrors).map(([index, value]) => ({
  index: Number(index),
  message: value.message,
  labels: value.keys.map((key) => blocks.value.find((block) => block.key === key)?.label).filter(Boolean).join(', '),
})))
// Pendant une generation, seuls les blocs deja devoiles sont listes ; sinon tous.
const listedBlocks = computed(() => (chainActive.value
  ? blocks.value.filter((block) => revealed.value.includes(block.key) || blockState[block.key] === 'error')
  : blocks.value))

function errorText(error, fallback) {
  // statusMessage vit dans `data` : la ligne de statut HTTP perd les accents.
  return error?.data?.statusMessage || error?.statusMessage || error?.data?.message || fallback
}

async function loadSchema(nextKind) {
  schemaError.value = false
  errorMessage.value = ''
  try {
    const data = await requestFetch('/api/admin/personality/schema', { query: { kind: nextKind } })
    schema.value = data
    kind.value = data.kind
    if (!data.blocks.some((block) => block.key === activeKey.value)) activeKey.value = data.blocks[0]?.key || ''
  } catch (error) {
    schemaError.value = true
    errorMessage.value = errorText(error, 'Impossible de charger le registre.')
  }
}

if (isAdmin.value) {
  await loadSchema(kind.value)
  try {
    const list = await requestFetch('/api/profiles')
    profiles.value = Array.isArray(list) ? list : []
  } catch {
    profiles.value = []
  }
}

// --- Lecture / écriture d'un champ ------------------------------------------
const entryOf = (blockKey, fieldKey) => personality.value?.blocks?.[blockKey]?.[fieldKey] || null
const fieldId = (blockKey, fieldKey) => `${blockKey}.${fieldKey}`
const isReadOnly = (blockKey, fieldKey) => readOnly.value.includes(fieldId(blockKey, fieldKey))
const isLocked = (blockKey, fieldKey) => entryOf(blockKey, fieldKey)?.locked === true
const isBio = (fieldKey) => Object.values(schema.value?.platformBioFields || {}).includes(fieldKey)
const isWide = (field) => field.type === 'list' || field.type === 'longtext' || (field.max || 0) > 120

function canLock(blockKey, fieldKey) {
  const entry = entryOf(blockKey, fieldKey)
  return Boolean(entry) && !isReadOnly(blockKey, fieldKey)
}

function listOf(blockKey, fieldKey) {
  const value = entryOf(blockKey, fieldKey)?.value
  return Array.isArray(value) ? value : []
}

function textOf(blockKey, field) {
  const value = entryOf(blockKey, field.key)?.value
  if (value === undefined || value === null) return ''
  return Array.isArray(value) ? value.join(', ') : String(value)
}

function visibleFields(block) {
  const hidden = new Set(
    Object.entries(schema.value?.platformBioFields || {})
      .filter(([platform]) => !platforms.value.includes(platform))
      .map(([, fieldKey]) => fieldKey),
  )
  return block.fields.filter((field) => !(block.key === 'platforms' && hidden.has(field.key)))
}

function ensurePersonality() {
  if (!personality.value) {
    personality.value = { version: 1, kind: kind.value, eccentricity: eccentricity.value, seeds: {}, blocks: {} }
  }
  return personality.value
}

function setField(block, field, raw) {
  const target = ensurePersonality()
  const blocksCopy = { ...target.blocks }
  const fields = { ...(blocksCopy[block.key] || {}) }
  let value = raw
  let empty = false

  if (field.type === 'list') {
    value = (Array.isArray(raw) ? raw : []).map((item) => String(item).trim()).filter(Boolean).slice(0, field.max || 20)
    empty = !value.length
  } else if (field.type === 'number') {
    empty = String(raw ?? '').trim() === ''
    value = Number(raw)
    if (!empty && !Number.isFinite(value)) return
  } else {
    value = String(raw ?? '')
    empty = !value.trim()
  }

  if (empty) delete fields[field.key]
  else fields[field.key] = { value, origin: 'user', ...(fields[field.key]?.locked ? { locked: true } : {}) }

  blocksCopy[block.key] = fields
  personality.value = { ...target, blocks: blocksCopy }
}

function toggleLock(blockKey, fieldKey) {
  const target = ensurePersonality()
  const entry = entryOf(blockKey, fieldKey)
  if (!entry) return
  const next = { ...entry }
  if (next.locked) delete next.locked
  else next.locked = true
  personality.value = { ...target, blocks: { ...target.blocks, [blockKey]: { ...target.blocks[blockKey], [fieldKey]: next } } }
}

const lockableKeys = (block) => block.fields.map((field) => field.key).filter((key) => canLock(block.key, key))
const lockableCount = (block) => lockableKeys(block).length
const blockFullyLocked = (block) => lockableCount(block) > 0 && lockableKeys(block).every((key) => isLocked(block.key, key))

function toggleBlockLock(block) {
  const target = ensurePersonality()
  const lock = !blockFullyLocked(block)
  const fields = { ...(target.blocks[block.key] || {}) }
  for (const key of lockableKeys(block)) {
    const next = { ...fields[key] }
    if (lock) next.locked = true
    else delete next.locked
    fields[key] = next
  }
  personality.value = { ...target, blocks: { ...target.blocks, [block.key]: fields } }
}

// --- Statuts ----------------------------------------------------------------
function statusOf(blockKey) {
  if (blockState[blockKey] === 'running') return 'running'
  if (blockState[blockKey] === 'error') return 'error'
  if (chainActive.value && pending.value.includes(blockKey)) return 'pending'
  const fields = personality.value?.blocks?.[blockKey]
  if (!fields || !Object.keys(fields).length) return 'empty'
  if (!validated.value.includes(blockKey)) return 'review'
  const edited = Object.entries(fields).some(([fieldKey, entry]) => entry.origin === 'user' && !isReadOnly(blockKey, fieldKey))
  return edited ? 'edited' : 'ready'
}

const navItems = computed(() => blocks.value.map((block) => ({ key: block.key, label: block.label, status: statusOf(block.key) })))
const validatedCount = computed(() => blocks.value.filter((block) => ['ready', 'edited'].includes(statusOf(block.key))).length)

/** Champs conserves tels quels dans un bloc (saisis, verrouilles ou venus du profil). */
function keptCount(block) {
  const fields = personality.value?.blocks?.[block.key] || {}
  return Object.entries(fields).filter(([fieldKey, entry]) => entry.origin === 'user' || entry.locked || isReadOnly(block.key, fieldKey)).length
}

function summaryOf(block) {
  const fields = personality.value?.blocks?.[block.key]
  if (!fields) return ''
  const parts = []
  for (const field of block.fields) {
    const value = fields[field.key]?.value
    if (value === undefined || value === null || value === '') continue
    parts.push(Array.isArray(value) ? value.join(', ') : String(value))
    if (parts.join(' · ').length > 150) break
  }
  const text = parts.join(' · ')
  return text.length > 170 ? `${text.slice(0, 169).trimEnd()}…` : text
}

const blockHint = (key) => BLOCK_HINTS[key] || ''
const labelOf = (key) => blocks.value.find((block) => block.key === key)?.label || key
const groupErrorOf = (key) => Object.values(groupErrors).find((entry) => entry.keys.includes(key))?.message || ''

function openBlock(key) {
  activeKey.value = key
  mode.value = 'block'
  scrollToMain()
}

// Sur mobile (une seule colonne), le bloc ouvert est sous le brief : on y amene l'ecran.
async function scrollToMain() {
  if (typeof window === 'undefined' || window.innerWidth >= 1024) return
  await nextTick()
  mainRef.value?.scrollIntoView({ block: 'start' })
}

function validateAndNext() {
  const key = activeKey.value
  if (statusOf(key) !== 'empty' && !validated.value.includes(key)) validated.value = [...validated.value, key]
  if (nextBlock.value) openBlock(nextBlock.value.key)
  else mode.value = 'overview'
}

// --- Appels ---------------------------------------------------------------
function requestBody(extra) {
  return {
    kind: kind.value,
    eccentricity: eccentricity.value,
    language: language.value,
    platforms: platforms.value,
    freeText: freeText.value,
    ...(profileId.value ? { profileId: profileId.value } : {}),
    ...(personality.value ? { personality: personality.value } : {}),
    ...extra,
  }
}

const formatCount = (value) => new Intl.NumberFormat('fr-FR').format(value || 0)

const usageCostLabel = computed(() => {
  const cost = usageTotal.value.costUsd
  if (cost === null) return 'tarif inconnu'
  return `≈ ${cost.toLocaleString('fr-FR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} $`
})

/** Ajoute la consommation d'une reponse (ou d'un echec qui a quand meme ete facture) au cumul. */
function recordUsage(usage) {
  if (!usage || !usage.calls) return
  const total = usageTotal.value
  usageTotal.value = {
    calls: total.calls + usage.calls,
    inputTokens: total.inputTokens + usage.inputTokens,
    outputTokens: total.outputTokens + usage.outputTokens,
    costUsd: total.costUsd === null || usage.costUsd === null ? null : total.costUsd + usage.costUsd,
    model: usage.model || total.model,
  }
}

function resetUsage() {
  usageTotal.value = { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0, model: '' }
}

// Corps d'une erreur renvoyee par le serveur : `error.data` = { statusMessage, data: { code, usage } }.
const usageOfError = (error) => error?.data?.data?.usage || null

function applyResult(result) {
  recordUsage(result.usage)
  personality.value = result.personality
  readOnly.value = result.readOnlyFields || []
  if (result.kind) kind.value = result.kind
}

const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms) })

/**
 * Une requete = un GROUPE de blocs (voir `steps` du schema : 2 appels Claude pour
 * toute la personnalite, pas un par bloc). Le cout reste donc celui de deux
 * appels ; l'affichage bloc par bloc est un simple devoilement cote client.
 */
async function requestGroup(keys) {
  const started = Date.now()
  const result = await $fetch('/api/admin/personality/generate', {
    method: 'POST',
    body: requestBody({ onlyBlocks: keys, onlyEmpty: true }),
  })
  applyResult(result)
  lastDuration.value = Math.round((Date.now() - started) * 0.001)
  return result
}

/** Devoile les blocs d'un groupe un par un (les contenus sont deja arrives). */
async function revealBlocks(keys, generatedSomething) {
  for (const key of keys) {
    await sleep(380)
    if (generatedSomething) validated.value = validated.value.filter((item) => item !== key)
    revealed.value = [...revealed.value, key]
    delete blockState[key]
  }
}

/** Enchaine les groupes ; s'arrete sur une pause demandee (apres le groupe en cours) ou sur un echec. */
async function runChain(fromGroup = 0) {
  if (!schema.value) return
  const groups = schema.value.steps || [blocks.value.map((block) => block.key)]
  errorMessage.value = ''
  mode.value = 'overview'
  chain.running = true
  chain.paused = false
  chain.pauseRequested = false
  chain.cursor = fromGroup
  briefOpen.value = false
  if (fromGroup === 0) {
    revealed.value = []
    pending.value = blocks.value.map((block) => block.key)
  }

  let failed = false
  for (let index = fromGroup; index < groups.length; index += 1) {
    if (chain.pauseRequested) break
    const keys = groups[index]
    chain.cursor = index
    pending.value = pending.value.filter((key) => !keys.includes(key))
    delete groupErrors[index]
    for (const key of keys) blockState[key] = 'running'
    try {
      const result = await requestGroup(keys)
      await revealBlocks(keys, result.generated > 0)
      chain.cursor = index + 1
    } catch (error) {
      failed = true
      for (const key of keys) blockState[key] = 'error'
      recordUsage(usageOfError(error))
      groupErrors[index] = { keys, message: errorText(error, 'La génération a échoué.') }
      break
    }
  }

  chain.running = false
  chain.pauseRequested = false
  const finished = !failed && chain.cursor >= groups.length
  chain.paused = !finished
  if (finished) {
    chain.cursor = 0
    pending.value = []
  }
}

/** Reprend a partir du groupe en echec (les blocs deja generes ne sont pas refaits). */
function retryFailed() {
  return runChain(chain.cursor)
}

/** Regenere UN bloc, en remplacant ses champs generes non verrouilles. */
async function regenerateBlock(blockKey) {
  errorMessage.value = ''
  delete blockErrors[blockKey]
  blockState[blockKey] = 'running'
  try {
    const result = await $fetch('/api/admin/personality/regenerate-block', { method: 'POST', body: requestBody({ blockKey }) })
    applyResult(result)
    if (result.generated > 0) validated.value = validated.value.filter((key) => key !== blockKey)
    delete blockState[blockKey]
  } catch (error) {
    blockState[blockKey] = 'error'
    recordUsage(usageOfError(error))
    blockErrors[blockKey] = errorText(error, 'La régénération a échoué.')
  }
}

function resetAll() {
  personality.value = null
  readOnly.value = []
  errorMessage.value = ''
  saveMessage.value = ''
  validated.value = []
  revealed.value = []
  pending.value = []
  chain.paused = false
  chain.cursor = 0
  for (const key of Object.keys(blockState)) delete blockState[key]
  for (const key of Object.keys(blockErrors)) delete blockErrors[key]
  for (const key of Object.keys(groupErrors)) delete groupErrors[key]
  mode.value = 'overview'
  briefOpen.value = true
}

async function onKindChange(value) {
  if (value) kind.value = value
  resetAll()
  hasStored.value = false
  await loadSchema(kind.value)
}

async function onProfileChange(value) {
  profileId.value = value ?? profileId.value
  resetAll()
  hasStored.value = false
  if (!profileId.value) return
  const profile = profiles.value.find((item) => item.id === profileId.value)
  if (profile?.profileType && profile.profileType !== kind.value) {
    kind.value = profile.profileType
    await loadSchema(kind.value)
  }
  // Charge ce qui est deja enregistre (les champs portes par une colonne du profil
  // reviennent en lecture seule).
  try {
    const result = await $fetch(`/api/profiles/${profileId.value}/personality`)
    applyResult(result)
    hasStored.value = Boolean(result.hasStored)
    if (result.personality?.eccentricity) eccentricity.value = result.personality.eccentricity
    if (result.hasStored) {
      validated.value = Object.entries(result.personality.blocks || {})
        .filter(([, fields]) => Object.keys(fields).length)
        .map(([key]) => key)
      briefOpen.value = false
    }
  } catch (error) {
    errorMessage.value = errorText(error, 'Impossible de charger la personnalité du profil.')
  }
}

async function saveToProfile() {
  if (!profileId.value || !personality.value) return
  if (hasStored.value && !window.confirm('Remplacer la personnalité déjà enregistrée sur ce profil ?')) return
  saving.value = true
  errorMessage.value = ''
  saveMessage.value = ''
  try {
    const result = await $fetch(`/api/profiles/${profileId.value}/personality`, {
      method: 'PUT',
      body: { personality: personality.value },
    })
    hasStored.value = true
    saveMessage.value = `Enregistré à ${new Date(result.updatedAt).toLocaleTimeString('fr-FR')}`
  } catch (error) {
    errorMessage.value = errorText(error, 'Enregistrement impossible.')
  } finally {
    saving.value = false
  }
}

function exportJson() {
  if (!personality.value) return
  const blob = new Blob([JSON.stringify(personality.value, null, 2)], { type: 'application/json' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `personnalite-${selectedProfile.value?.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'laboratoire'}.json`
  link.click()
  URL.revokeObjectURL(link.href)
}

async function copy(text) {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    errorMessage.value = 'Copie impossible depuis ce navigateur.'
  }
}
</script>
