<template>
  <section class="space-y-4 rounded-ui-card border border-ui-line bg-ui-surface p-4 font-ui" aria-label="Plan à valider">
    <header>
      <p class="font-ui-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-ui-accent">Plan à valider</p>
      <h3 class="mt-1 text-lg font-semibold text-ui-ink">Relis, corrige, puis lance la vidéo</h3>
      <p class="mt-1 text-xs leading-5 text-ui-ink-muted">
        Rien n’est encore dépensé en voix ni en montage. Pour chaque scène, choisis « Ce qui s’affiche » : les champs proposés dessous
        sont exactement ceux que cette mise en page lit. Tu peux aussi demander à Claude de réviser tout le plan. Ce que tu as écrit à la main est conservé.
      </p>
    </header>

    <div class="grid gap-3 sm:grid-cols-2">
      <UiField label="Titre de la vidéo" for-id="plan-title">
        <UiInput id="plan-title" v-model="plan.title" maxlength="80" />
      </UiField>
      <UiField label="Légende du post" for-id="plan-caption">
        <UiInput id="plan-caption" v-model="plan.caption" maxlength="600" />
      </UiField>
    </div>

    <div v-if="clone" class="rounded-ui-ctl border border-ui-line-soft bg-ui-subtle p-3">
      <p class="text-xs font-semibold text-ui-ink">Ton de la voix : clique pour insérer une balise là où tu es dans une scène</p>
      <div class="mt-2 flex flex-wrap gap-1.5">
        <button
          v-for="tag in audioTags"
          :key="tag.tag"
          type="button"
          :title="tag.description"
          class="rounded-full border border-ui-line-input bg-ui-surface px-2.5 py-1 font-ui-mono text-[11px] text-ui-ink-2 transition-colors hover:border-ui-accent hover:bg-ui-accent-soft hover:text-ui-accent-ink focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ui-accent/20"
          @click="insertTag(tag.tag)"
        >
          [{{ tag.tag }}]
        </button>
      </div>
      <p class="mt-2 text-[11px] leading-4 text-ui-ink-muted">
        Une balise colore ce qui suit : « [excited] Eh oui ! ». Elle n’est jamais lue ni affichée. La ponctuation compte aussi (? ! … et phrases courtes).
      </p>
    </div>

    <ol class="space-y-3">
      <li v-for="(scene, index) in plan.scenes" :key="index" class="space-y-3 rounded-ui-card border border-ui-line p-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <p class="text-sm font-semibold text-ui-ink">
            Scène {{ index + 1 }}
            <span class="font-ui-mono text-xs font-medium text-ui-ink-muted">~{{ wordsOf(scene.say) }} mots · ~{{ secondsOf(scene.say) }} s</span>
          </p>
          <div class="flex items-center gap-1">
            <button type="button" class="rounded-ui-ctl px-2 py-1 text-xs text-ui-ink-2 hover:bg-ui-subtle disabled:opacity-40" :disabled="index === 0" aria-label="Monter la scène" @click="move(index, -1)">↑</button>
            <button type="button" class="rounded-ui-ctl px-2 py-1 text-xs text-ui-ink-2 hover:bg-ui-subtle disabled:opacity-40" :disabled="index === plan.scenes.length - 1" aria-label="Descendre la scène" @click="move(index, 1)">↓</button>
            <button type="button" class="rounded-ui-ctl px-2 py-1 text-xs font-semibold text-ui-accent hover:bg-ui-accent-soft disabled:opacity-40" :disabled="previews[index]?.loading" @click="showPreview(index)">
              {{ previews[index]?.loading ? 'Aperçu…' : 'Aperçu' }}
            </button>
            <button type="button" class="rounded-ui-ctl px-2 py-1 text-xs text-ui-ink-2 hover:bg-ui-subtle" @click="addAfter(index)">+ Scène</button>
            <button type="button" class="rounded-ui-ctl px-2 py-1 text-xs text-ui-danger-ink hover:bg-ui-danger-soft disabled:opacity-40" :disabled="plan.scenes.length <= 2" @click="remove(index)">Supprimer</button>
          </div>
        </div>

        <div v-if="previews[index]?.image || previews[index]?.error" class="flex items-start gap-3 rounded-ui-ctl border border-ui-line-soft bg-ui-subtle p-3">
          <img v-if="previews[index].image" :src="previews[index].image" class="w-40 shrink-0 rounded-ui-tag border border-ui-line" alt="Aperçu de la scène">
          <div class="min-w-0 flex-1 space-y-1">
            <p v-if="previews[index].image" class="text-xs leading-5 text-ui-ink-muted">
              Image fixe de cette scène avec la DA de la vidéo, au moment où presque tout est affiché. Elle ne se met pas à jour toute seule : relance « Aperçu » après une modification.
            </p>
            <p v-else class="text-xs leading-5 text-ui-danger-ink">{{ previews[index].error }}</p>
            <button type="button" class="text-xs font-semibold text-ui-ink-2 hover:underline" @click="closePreview(index)">Fermer l’aperçu</button>
          </div>
        </div>

        <UiField label="Ce que dit la voix" :for-id="`plan-say-${index}`" :hint="clone ? 'Avec les balises de ton entre crochets si tu en veux.' : ''">
          <UiTextarea :id="`plan-say-${index}`" v-model="scene.say" :rows="2" :maxlength="400" @focus="focused = index" />
        </UiField>

        <div class="grid gap-3 sm:grid-cols-2">
          <UiField label="Ce qui s’affiche" :for-id="`plan-layout-${index}`" hint="Change les champs proposés juste dessous.">
            <UiSelect :id="`plan-layout-${index}`" v-model="scene.layout" :options="layoutOptions(scene)" />
          </UiField>
          <UiField label="Fond" :for-id="`plan-bg-${index}`">
            <UiSelect :id="`plan-bg-${index}`" v-model="scene.bg" :options="BG_OPTIONS" />
          </UiField>
        </div>

        <div class="grid gap-3 sm:grid-cols-2">
          <UiField
            v-for="field in specOf(scene).fields"
            :key="field.key"
            :label="field.required ? `${field.label} (obligatoire)` : field.label"
            :for-id="`plan-${field.key}-${index}`"
            :hint="fieldHint(field, scene)"
          >
            <UiInput :id="`plan-${field.key}-${index}`" v-model="scene[field.key]" :maxlength="field.max" />
          </UiField>
          <UiField v-if="specOf(scene).tab" :label="specOf(scene).tab.label" :for-id="`plan-tab-${index}`" hint="Facultatif.">
            <UiInput :id="`plan-tab-${index}`" v-model="scene.tab" :maxlength="specOf(scene).tab.max" />
          </UiField>
          <UiField v-if="specOf(scene).jp" :label="specOf(scene).jp.label" :for-id="`plan-jp-${index}`" hint="Facultatif, rien n’est dessiné si c’est vide.">
            <UiInput :id="`plan-jp-${index}`" v-model="scene.jp" :maxlength="specOf(scene).jp.max" />
          </UiField>
          <UiField v-if="specOf(scene).emoji" label="Emoji (autocollant)" :for-id="`plan-emoji-${index}`" hint="Facultatif.">
            <UiInput :id="`plan-emoji-${index}`" v-model="scene.emoji" maxlength="8" />
          </UiField>
        </div>

        <UiField v-if="specOf(scene).code" :label="specOf(scene).code.label" :for-id="`plan-code-${index}`" hint="Facultatif : sans code, une ligne est déduite du mot clé.">
          <UiTextarea :id="`plan-code-${index}`" :model-value="(scene.code || []).join('\n')" :rows="3" @update:model-value="setCode(scene, $event)" />
        </UiField>

        <div v-if="specOf(scene).items" class="space-y-2">
          <p class="text-xs font-semibold text-ui-ink">
            Éléments de la liste
            <span class="font-normal text-ui-ink-muted">({{ (scene.items || []).length }} sur {{ specOf(scene).items.max }}, 2 au minimum)</span>
          </p>
          <div v-for="(item, itemIndex) in scene.items || []" :key="itemIndex" class="grid gap-2 rounded-ui-ctl border border-ui-line-soft bg-ui-subtle p-2 sm:grid-cols-[4rem_1fr_1fr_auto]">
            <UiInput v-model="item.emoji" maxlength="8" placeholder="Emoji" :aria-label="`Emoji de l’élément ${itemIndex + 1}`" />
            <UiInput v-model="item.text" maxlength="40" placeholder="Texte de l’élément" :aria-label="`Texte de l’élément ${itemIndex + 1}`" />
            <UiInput v-model="item.at" maxlength="40" placeholder="Mot dit qui le déclenche" :aria-label="`Mot qui déclenche l’élément ${itemIndex + 1}`" />
            <UiButton variant="ghost" size="sm" @click="removeRow(scene.items, itemIndex)">Retirer</UiButton>
            <p v-if="!cueIsSpoken(scene.say, item.at)" class="text-xs text-ui-danger-ink sm:col-span-4">
              Ce mot n’est pas dans ce qui est dit : l’élément apparaîtra au milieu de la phrase. Mets un mot de « Ce que dit la voix ».
            </p>
            <div v-if="specOf(scene).items.subLabel || specOf(scene).items.tone" class="grid gap-2 sm:col-span-4 sm:grid-cols-2">
              <UiInput v-if="specOf(scene).items.subLabel" v-model="item.sub" maxlength="40" :placeholder="specOf(scene).items.subLabel" :aria-label="`${specOf(scene).items.subLabel}, élément ${itemIndex + 1}`" />
              <UiSelect v-if="specOf(scene).items.tone" v-model="item.tone" :options="TONE_OPTIONS" :aria-label="`Jugement de l’élément ${itemIndex + 1}`" />
            </div>
          </div>
          <UiButton variant="secondary" size="sm" :disabled="(scene.items || []).length >= specOf(scene).items.max" @click="addItem(scene)">+ Élément</UiButton>
        </div>

        <div v-if="specOf(scene).compare" class="space-y-2">
          <p class="text-xs font-semibold text-ui-ink">
            Comparaisons
            <span class="font-normal text-ui-ink-muted">(facultatif, uniquement des chiffres présents dans ce qui est dit)</span>
          </p>
          <div v-for="(row, rowIndex) in scene.compare || []" :key="rowIndex" class="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <div>
              <UiInput v-model="row.label" maxlength="24" placeholder="Libellé (ex. Avant)" :aria-label="`Libellé de la comparaison ${rowIndex + 1}`" />
              <p class="mt-1 text-xs text-ui-ink-muted">{{ String(row.label || '').length }} / 24 caractères</p>
            </div>
            <div>
              <UiInput v-model="row.value" maxlength="24" placeholder="Valeur (ex. 12 %)" :aria-label="`Valeur de la comparaison ${rowIndex + 1}`" />
              <p class="mt-1 text-xs text-ui-ink-muted">{{ String(row.value || '').length }} / 24 caractères</p>
            </div>
            <UiButton variant="ghost" size="sm" @click="removeRow(scene.compare, rowIndex)">Retirer</UiButton>
          </div>
          <UiButton variant="secondary" size="sm" :disabled="(scene.compare || []).length >= specOf(scene).compare.max" @click="addRow(scene, 'compare', specOf(scene).compare.max)">+ Comparaison</UiButton>
        </div>

        <div v-if="specOf(scene).series" class="space-y-2">
          <p class="text-xs font-semibold text-ui-ink">
            Points de la courbe
            <span class="font-normal text-ui-ink-muted">(facultatif, 2 au minimum pour tracer une courbe)</span>
          </p>
          <div v-for="(row, rowIndex) in scene.series || []" :key="rowIndex" class="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <UiInput v-model="row.label" maxlength="10" placeholder="Repère (ex. Jan)" :aria-label="`Repère du point ${rowIndex + 1}`" />
            <UiInput v-model="row.value" maxlength="16" placeholder="Valeur" :aria-label="`Valeur du point ${rowIndex + 1}`" />
            <UiButton variant="ghost" size="sm" @click="removeRow(scene.series, rowIndex)">Retirer</UiButton>
          </div>
          <UiButton variant="secondary" size="sm" :disabled="(scene.series || []).length >= specOf(scene).series.max" @click="addRow(scene, 'series', specOf(scene).series.max)">+ Point</UiButton>
        </div>

        <StudioFacelessImagePicker
          v-if="specOf(scene).kind === 'photo'"
          v-model="scene.image"
          :profile-id="profileId"
          :illustrations="illustrations"
          :scene-index="index"
          @imported="emit('imported', $event)"
        />
        <div v-if="specOf(scene).slideshow" class="space-y-3">
          <StudioFacelessImagePicker
            multiple
            :values="(scene.images || []).map((image) => image.id)"
            :max="specOf(scene).slideshow.max"
            :profile-id="profileId"
            :illustrations="illustrations"
            :scene-index="index"
            @update:values="setSlideshowImages(scene, $event)"
            @imported="emit('imported', $event)"
          />
          <ol v-if="(scene.images || []).length" class="space-y-2">
            <li v-for="(image, imageIndex) in scene.images" :key="image.id" class="flex flex-wrap items-center gap-2 rounded-ui-ctl border border-ui-line-soft p-2">
              <img :src="illustrationUrl(image.id)" alt="" class="h-12 w-10 shrink-0 rounded-ui-tag border border-ui-line object-cover">
              <span class="w-6 shrink-0 font-ui-mono text-xs font-semibold text-ui-ink-2">{{ imageIndex + 1 }}.</span>
              <div class="min-w-0 flex-1 basis-48">
                <UiInput
                  v-if="imageIndex > 0"
                  v-model="image.at"
                  maxlength="40"
                  placeholder="Mot dit qui déclenche cette image"
                  :aria-label="`Mot qui déclenche l’image ${imageIndex + 1}`"
                />
                <p v-else class="text-xs text-ui-ink-muted">Visible dès le début de la scène.</p>
                <p v-if="imageIndex > 0 && !cueIsSpoken(scene.say, image.at)" class="mt-1 text-xs text-ui-danger-ink">Ce mot n’est pas dans « Ce que dit la voix » : l’image apparaîtra à un moment approximatif.</p>
              </div>
              <button type="button" class="rounded-ui-ctl px-2 py-1 text-xs text-ui-ink-2 hover:bg-ui-subtle disabled:opacity-40" :disabled="imageIndex === 0" aria-label="Monter l’image" @click="moveImage(scene, imageIndex, -1)">↑</button>
              <button type="button" class="rounded-ui-ctl px-2 py-1 text-xs text-ui-ink-2 hover:bg-ui-subtle disabled:opacity-40" :disabled="imageIndex === scene.images.length - 1" aria-label="Descendre l’image" @click="moveImage(scene, imageIndex, 1)">↓</button>
              <button type="button" class="rounded-ui-ctl px-2 py-1 text-xs text-ui-danger-ink hover:bg-ui-danger-soft" @click="removeImage(scene, imageIndex)">Retirer</button>
            </li>
          </ol>
          <p class="text-xs leading-5 text-ui-ink-muted">
            Sans mot déclencheur, les images se partagent la scène à parts égales. Avec des mots, chaque image reste jusqu’au mot suivant.
          </p>
          <div class="grid gap-3 sm:grid-cols-2">
            <UiField label="Animation du passage d’une image à l’autre" :for-id="`plan-transition-${index}`">
              <UiSelect :id="`plan-transition-${index}`" :model-value="scene.transition || 'fade'" :options="transitions" @update:model-value="scene.transition = $event" />
            </UiField>
            <UiField label="Bruitage à chaque changement" :for-id="`plan-image-sound-${index}`" hint="Automatique : le son d’interface du modèle visuel.">
              <UiSelect :id="`plan-image-sound-${index}`" :model-value="scene.imageSound || ''" :options="soundOptions" @update:model-value="scene.imageSound = $event" />
            </UiField>
          </div>
        </div>
        <UiAlert v-if="problemOf(scene)" tone="info">{{ problemOf(scene) }}</UiAlert>
      </li>
    </ol>

    <div class="space-y-2 rounded-ui-card border border-ui-line-soft bg-ui-subtle p-3">
      <UiField
        label="Demander à Claude de réviser le plan"
        for-id="plan-revise"
        hint="Comme à un monteur : « trop mou, sois plus clivant », « accroche plus agressive », « fond sombre sur le chiffre », « étonne-toi sur le 70 % »."
      >
        <div class="mb-2 flex flex-wrap gap-1.5">
          <button
            v-for="suggestion in REVISE_SUGGESTIONS"
            :key="suggestion"
            type="button"
            class="rounded-full border border-ui-line-input bg-ui-surface px-3 py-1 text-xs text-ui-ink-2 transition-colors hover:bg-ui-subtle focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ui-accent/20"
            @click="instruction = suggestion"
          >
            {{ suggestion }}
          </button>
        </div>
        <UiTextarea id="plan-revise" v-model="instruction" :rows="2" :maxlength="1000" placeholder="Ex. : l’accroche est trop sage, prends position dès la première phrase." />
      </UiField>
      <UiButton variant="secondary" size="sm" :loading="revising" :disabled="!instruction.trim() || generating" @click="emit('revise', instruction.trim())">
        {{ revising ? 'Claude révise…' : 'Réviser avec Claude' }}
      </UiButton>
    </div>

    <footer class="flex flex-wrap items-center gap-3 border-t border-ui-line-soft pt-3">
      <UiButton variant="primary" :loading="generating" :disabled="revising || totalWords === 0" @click="emit('generate')">
        {{ generating ? 'Montage en cours…' : 'Lancer la vidéo avec ce plan' }}
      </UiButton>
      <UiButton variant="ghost" size="sm" :disabled="generating" @click="emit('discard')">Abandonner ce plan</UiButton>
      <p class="text-xs text-ui-ink-muted">
        {{ plan.scenes.length }} scènes · ~{{ totalWords }} mots · ~{{ Math.round(totalWords / WORDS_PER_SECOND) }} s de voix
      </p>
    </footer>
  </section>
</template>

<script setup>
// Plan de montage d une video faceless, ecrit par Claude puis relu par le createur AVANT toute depense
// de voix ou de rendu. Le createur a le dernier mot : chaque scene est editable, et le plan peut etre
// revise en langage naturel. Les autres champs (elements de liste, poses d avatar, bruitages) sont gardes tels quels.
import { LAYOUT_LABELS, sceneFieldsFor, incompleteReason, cueIsSpoken } from '~/utils/facelessSceneFields'
import { blankScene } from '~/utils/facelessStarterPlan'

const props = defineProps({
  modelValue: { type: Object, required: true },
  // Modele visuel de la DA choisie : il decide quels champs une mise en page lit vraiment.
  template: { type: String, default: 'classic' },
  // Persona dont le dossier fournit les images d'une scene Photo ; sans persona, pas de selecteur.
  profileId: { type: String, default: '' },
  // DA choisie pour cette video (0 = principale, 1 et 2 = options) : l apercu d une scene la reprend.
  styleSlot: { type: Number, default: 0 },
  illustrations: { type: Array, default: () => [] },
  // Defile d'images : animations de passage et bruitages proposes par le serveur.
  transitionOptions: { type: Array, default: () => [] },
  sfxOptions: { type: Array, default: () => [] },
  clone: { type: Boolean, default: false },
  audioTags: { type: Array, default: () => [] },
  revising: { type: Boolean, default: false },
  generating: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue', 'revise', 'generate', 'discard', 'imported'])

const plan = computed(() => props.modelValue)
const instruction = ref('')
const focused = ref(0)

const WORDS_PER_SECOND = 2.6
const TAG = /\[[^\]\n]{1,24}\]/g

const TONE_OPTIONS = [
  { value: '', label: 'Sans jugement' },
  { value: 'good', label: 'Bon signe' },
  { value: 'avoid', label: 'À éviter' },
  { value: 'watch', label: 'À surveiller / à venir' },
]
// Ce que dit l'aide d'un champ, plus le nombre de caracteres utilises : au-dela de la limite, le texte est coupe.
const fieldHint = (field, scene) => [field.hint, `${String(scene[field.key] || '').length} / ${field.max} caractères`].filter(Boolean).join(' ')
const specOf = (scene) => sceneFieldsFor(scene.layout, props.template)
const problemOf = (scene) => incompleteReason(scene, props.template)

function setCode(scene, text) {
  scene.code = String(text || '').split('\n').slice(0, 6).map((line) => line.slice(0, 32))
}
function removeRow(rows, index) {
  rows.splice(index, 1)
}
function addRow(scene, key, max) {
  if (!Array.isArray(scene[key])) scene[key] = []
  if (scene[key].length < max) scene[key].push({ label: '', value: '' })
}
function addItem(scene) {
  if (!Array.isArray(scene.items)) scene.items = []
  scene.items.push({ emoji: '', text: '', sub: '', tone: '', at: '' })
}
const BG_OPTIONS = [
  { value: 'main', label: 'Fond principal' },
  { value: 'alt', label: 'Fond secondaire' },
  { value: 'dark', label: 'Fond sombre' },
]
const REVISE_SUGGESTIONS = [
  'Trop mou : prends position, sois plus clivant.',
  'Accroche plus agressive, dès la première phrase.',
  'Phrases plus courtes et plus de rythme.',
  'Plus d’énergie sur l’accroche, plus grave sur la conclusion.',
]

const wordsOf = (say) => String(say || '').replace(TAG, ' ').split(/\s+/).filter(Boolean).length
const secondsOf = (say) => Math.max(1, Math.round(wordsOf(say) / WORDS_PER_SECOND))
const totalWords = computed(() => plan.value.scenes.reduce((sum, scene) => sum + wordsOf(scene.say), 0))

// Une mise en page absente de la liste (ex. « label » hors Herbier) reste proposee si la scene l utilise deja.
function layoutOptions(scene) {
  const keys = Object.keys(LAYOUT_LABELS).filter((key) => key !== 'label' || scene.layout === 'label')
  return keys.map((value) => ({ value, label: LAYOUT_LABELS[value] }))
}

// Defile d'images.
const transitions = computed(() => (props.transitionOptions.length ? props.transitionOptions : [{ value: 'fade', label: 'Fondu' }, { value: 'cut', label: 'Coupe franche' }, { value: 'zoom', label: 'Zoom' }, { value: 'wipe', label: 'Balayage' }]))
const soundOptions = computed(() => [{ value: '', label: 'Automatique' }, { value: 'none', label: 'Aucun bruitage' }, ...props.sfxOptions])
const illustrationUrl = (id) => props.illustrations.find((item) => item.id === id)?.url || ''
function setSlideshowImages(scene, ids) {
  const known = new Map((scene.images || []).map((image) => [image.id, image]))
  scene.images = ids.map((id) => known.get(id) || { id, at: '' })
  previews.value = {}
}
function moveImage(scene, index, delta) {
  const target = index + delta
  if (target < 0 || target >= scene.images.length) return
  ;[scene.images[index], scene.images[target]] = [scene.images[target], scene.images[index]]
}
function removeImage(scene, index) {
  scene.images.splice(index, 1)
}

// Apercu d une scene : une image fixe rendue par le serveur (gratuit : ni Claude, ni voix). Par numero de scene.
const previews = ref({})
async function showPreview(index) {
  const scene = plan.value.scenes[index]
  if (!scene) return
  previews.value = { ...previews.value, [index]: { loading: true } }
  try {
    const result = await $fetch('/api/faceless/scene-preview', {
      method: 'POST',
      body: { scene: JSON.parse(JSON.stringify(scene)), profileId: props.profileId || undefined, styleSlot: props.styleSlot > 0 ? props.styleSlot : undefined },
    })
    previews.value = { ...previews.value, [index]: { image: result.image } }
  } catch (error) {
    previews.value = { ...previews.value, [index]: { error: error?.data?.statusMessage || error?.statusMessage || 'Aperçu impossible.' } }
  }
}
function closePreview(index) {
  const { [index]: removed, ...rest } = previews.value
  previews.value = rest
}

function move(index, delta) {
  const scenes = plan.value.scenes
  const target = index + delta
  if (target < 0 || target >= scenes.length) return
  ;[scenes[index], scenes[target]] = [scenes[target], scenes[index]]
  previews.value = {}
}
function addAfter(index) {
  plan.value.scenes.splice(index + 1, 0, blankScene())
  previews.value = {}
  focused.value = index + 1
}
function remove(index) {
  if (plan.value.scenes.length <= 2) return
  plan.value.scenes.splice(index, 1)
  previews.value = {}
}

// Insere la balise a l endroit du curseur de la scene en cours d edition.
function insertTag(tag) {
  const index = Math.min(focused.value, plan.value.scenes.length - 1)
  const scene = plan.value.scenes[index]
  const el = import.meta.client ? document.getElementById(`plan-say-${index}`) : null
  const text = String(scene.say || '')
  const position = typeof el?.selectionStart === 'number' ? el.selectionStart : text.length
  const insertion = `[${tag}] `
  scene.say = `${text.slice(0, position)}${insertion}${text.slice(position)}`
  nextTick(() => {
    if (!el) return
    el.focus()
    el.setSelectionRange(position + insertion.length, position + insertion.length)
  })
}
</script>
