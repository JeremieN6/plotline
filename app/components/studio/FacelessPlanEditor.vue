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
            <button type="button" class="rounded-ui-ctl px-2 py-1 text-xs text-ui-ink-2 hover:bg-ui-subtle" @click="addAfter(index)">+ Scène</button>
            <button type="button" class="rounded-ui-ctl px-2 py-1 text-xs text-ui-danger-ink hover:bg-ui-danger-soft disabled:opacity-40" :disabled="plan.scenes.length <= 2" @click="remove(index)">Supprimer</button>
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
            :hint="field.hint || ''"
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
            <UiInput v-model="row.label" maxlength="24" placeholder="Libellé (ex. Avant)" :aria-label="`Libellé de la comparaison ${rowIndex + 1}`" />
            <UiInput v-model="row.value" maxlength="16" placeholder="Valeur (ex. 12 %)" :aria-label="`Valeur de la comparaison ${rowIndex + 1}`" />
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

const props = defineProps({
  modelValue: { type: Object, required: true },
  // Modele visuel de la DA choisie : il decide quels champs une mise en page lit vraiment.
  template: { type: String, default: 'classic' },
  // Persona dont le dossier fournit les images d'une scene Photo ; sans persona, pas de selecteur.
  profileId: { type: String, default: '' },
  illustrations: { type: Array, default: () => [] },
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

function blankScene() {
  return { say: '', layout: 'title', text: '', title: '', word: '', emoji: '', bg: 'main', captions: true, items: [], sfx: [], avatar: { mode: 'head', pose: 'idle', beats: [{ at: 0, expr: 'neutral', flip: false }] } }
}
function move(index, delta) {
  const scenes = plan.value.scenes
  const target = index + delta
  if (target < 0 || target >= scenes.length) return
  ;[scenes[index], scenes[target]] = [scenes[target], scenes[index]]
}
function addAfter(index) {
  plan.value.scenes.splice(index + 1, 0, blankScene())
  focused.value = index + 1
}
function remove(index) {
  if (plan.value.scenes.length <= 2) return
  plan.value.scenes.splice(index, 1)
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
