<template>
  <section class="space-y-4 rounded-ui-card border border-ui-line bg-ui-surface p-4 font-ui" aria-label="Plan à valider">
    <header>
      <p class="font-ui-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-ui-accent">Plan à valider</p>
      <h3 class="mt-1 text-lg font-semibold text-ui-ink">Relis, corrige, puis lance la vidéo</h3>
      <p class="mt-1 text-xs leading-5 text-ui-ink-muted">
        Rien n’est encore dépensé en voix ni en montage. Tout est modifiable : ce que dit chaque scène, ce qui s’affiche, le fond,
        l’ordre. Tu peux aussi demander à Claude de réviser tout le plan. Ce que tu as écrit à la main est conservé.
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

        <div class="grid gap-3 sm:grid-cols-3">
          <UiField label="Ce qui s’affiche" :for-id="`plan-layout-${index}`">
            <UiSelect :id="`plan-layout-${index}`" v-model="scene.layout" :options="layoutOptions(scene)" />
          </UiField>
          <UiField label="Texte à l’écran" :for-id="`plan-text-${index}`" hint="**mot** = mis en avant">
            <UiInput :id="`plan-text-${index}`" v-model="scene.text" maxlength="110" />
          </UiField>
          <UiField label="Fond" :for-id="`plan-bg-${index}`">
            <UiSelect :id="`plan-bg-${index}`" v-model="scene.bg" :options="BG_OPTIONS" />
          </UiField>
        </div>

        <details class="text-xs text-ui-ink-2">
          <summary class="cursor-pointer font-semibold text-ui-ink-2">Autres champs de cette scène</summary>
          <div class="mt-2 grid gap-3 sm:grid-cols-3">
            <UiField label="Titre" :for-id="`plan-stitle-${index}`">
              <UiInput :id="`plan-stitle-${index}`" v-model="scene.title" maxlength="40" />
            </UiField>
            <UiField label="Mot en grand" :for-id="`plan-word-${index}`">
              <UiInput :id="`plan-word-${index}`" v-model="scene.word" maxlength="14" />
            </UiField>
            <UiField label="Emoji" :for-id="`plan-emoji-${index}`">
              <UiInput :id="`plan-emoji-${index}`" v-model="scene.emoji" maxlength="8" />
            </UiField>
          </div>
        </details>
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
const props = defineProps({
  modelValue: { type: Object, required: true },
  clone: { type: Boolean, default: false },
  audioTags: { type: Array, default: () => [] },
  revising: { type: Boolean, default: false },
  generating: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue', 'revise', 'generate', 'discard'])

const plan = computed(() => props.modelValue)
const instruction = ref('')
const focused = ref(0)

const WORDS_PER_SECOND = 2.6
const TAG = /\[[^\]\n]{1,24}\]/g

const LAYOUT_LABELS = {
  hook: 'Accroche (gros titre)',
  title: 'Phrase / chapitre',
  list: 'Liste',
  avatar: 'Avatar / appel à l’action',
  word: 'Mot géant',
  stat: 'Chiffre clé',
  photo: 'Photo',
  logo: 'Logo',
  label: 'Étiquette de produit',
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
