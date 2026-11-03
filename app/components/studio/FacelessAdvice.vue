<template>
  <UiDrawer :open="open" title="L’avis de Claude" description="Il répond à ta question, il ne modifie rien" @update:open="$emit('update:open', $event)">
    <div class="space-y-4">
      <p v-if="!messages.length" class="text-sm leading-6 text-ui-ink-2">
        Pose-lui une question sur ton script ou sur la direction que tu veux donner. Il voit ton brief, ton texte source et ton plan actuel.
        {{ planReady ? '' : 'Pas encore de plan : il s’appuie sur ton brief.' }}
      </p>

      <div v-if="!messages.length" class="flex flex-wrap gap-2">
        <button
          v-for="suggestion in SUGGESTIONS"
          :key="suggestion"
          type="button"
          class="rounded-full border border-ui-line-input bg-ui-surface px-3 py-1.5 text-left text-xs text-ui-ink-2 transition-colors hover:bg-ui-subtle focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ui-accent/20"
          @click="question = suggestion"
        >
          {{ suggestion }}
        </button>
      </div>

      <ol v-if="messages.length" class="space-y-3" aria-live="polite">
        <li v-for="(message, index) in messages" :key="index" :class="message.role === 'user' ? 'flex justify-end' : ''">
          <div
            class="max-w-[94%] whitespace-pre-line rounded-ui-card px-3 py-2 text-sm leading-6"
            :class="message.role === 'user' ? 'bg-ui-accent-soft text-ui-accent-ink' : 'border border-ui-line bg-ui-surface text-ui-ink'"
          >
            {{ message.content }}
            <div v-if="message.role === 'assistant' && planReady" class="mt-2">
              <UiButton size="sm" variant="secondary" :disabled="applying" @click="$emit('apply', applyInstruction(message.content))">
                Appliquer ça au plan
              </UiButton>
            </div>
          </div>
        </li>
        <li v-if="loading" class="text-xs text-ui-ink-muted">Claude réfléchit…</li>
      </ol>

      <UiAlert v-if="error" title="Pas de réponse">{{ error }}</UiAlert>
    </div>

    <template #footer>
      <div class="space-y-2">
        <UiTextarea
          id="faceless-advice-question"
          v-model="question"
          :rows="3"
          :maxlength="MAX_QUESTION"
          placeholder="Ex. : je veux démonter une idée reçue sur la cold-mail. Comment bien structurer la vidéo ?"
          @keydown.ctrl.enter.prevent="send"
          @keydown.meta.enter.prevent="send"
        />
        <div class="flex items-center justify-between gap-2">
          <UiButton v-if="messages.length" variant="ghost" size="sm" :disabled="loading" @click="reset">Nouvelle discussion</UiButton>
          <span v-else />
          <UiButton variant="dark" size="sm" :loading="loading" :disabled="!question.trim()" @click="send">Demander</UiButton>
        </div>
      </div>
    </template>
  </UiDrawer>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
  // Contexte envoyé à chaque question (brief, texte source, persona, plan actuel...), évalué au moment de l'envoi.
  buildBody: { type: Function, required: true },
  planReady: { type: Boolean, default: false },
  applying: { type: Boolean, default: false },
  open: { type: Boolean, default: false },
})
defineEmits(['apply', 'update:open'])

const SUGGESTIONS = [
  'Ce script est-il bon ? Qu’est-ce que tu changerais, et pourquoi ?',
  'Mon accroche est-elle assez forte ?',
  'Quelle est la meilleure façon de structurer une vidéo comme celle-ci ?',
]
const MAX_QUESTION = 1500
const MAX_INSTRUCTION = 1000

const messages = ref([])
const question = ref('')
const loading = ref(false)
const error = ref('')

// La révision accepte 1 000 caractères : on borne la recommandation reprise telle quelle.
const applyInstruction = (answer) => `Applique cette recommandation au plan, sans toucher à ce qu’elle ne mentionne pas : ${answer}`.slice(0, MAX_INSTRUCTION)

async function send() {
  const text = question.value.trim()
  if (!text || loading.value) return
  error.value = ''
  loading.value = true
  const history = messages.value.map(({ role, content }) => ({ role, content }))
  messages.value = [...messages.value, { role: 'user', content: text }]
  question.value = ''
  try {
    const result = await $fetch('/api/faceless/plan-advice', { method: 'POST', body: { ...props.buildBody(), question: text, history } })
    messages.value = [...messages.value, { role: 'assistant', content: result.answer }]
  } catch (err) {
    error.value = err?.data?.statusMessage || err?.statusMessage || 'Claude n’a pas pu répondre.'
    // On rend la question pour pouvoir la renvoyer.
    messages.value = messages.value.slice(0, -1)
    question.value = text
  } finally {
    loading.value = false
  }
}

function reset() {
  messages.value = []
  error.value = ''
}
</script>
