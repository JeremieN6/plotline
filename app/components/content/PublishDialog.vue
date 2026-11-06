<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center px-4 font-ui">
      <button type="button" class="absolute inset-0 bg-ui-ink/40" aria-label="Fermer" @click="emit('cancel')" />

      <div
        role="dialog"
        aria-modal="true"
        :aria-labelledby="`${uid}-title`"
        class="relative w-full max-w-md rounded-ui-card border border-ui-line bg-ui-surface p-6 shadow-lg"
        @keydown.esc.stop.prevent="emit('cancel')"
      >
        <h2 :id="`${uid}-title`" class="text-lg font-semibold text-ui-ink">Publier sur {{ platformLabel }} ?</h2>
        <p class="mt-1 text-sm text-ui-ink-2">La publication sera visible depuis l’extérieur dès maintenant.</p>

        <dl class="mt-4 space-y-3 text-sm">
          <div>
            <dt class="text-xs font-semibold text-ui-ink-muted">Légende</dt>
            <dd class="mt-1 max-h-32 overflow-y-auto whitespace-pre-line rounded-ui-ctl bg-ui-subtle px-3 py-2 text-ui-ink">{{ preview || 'Aucune légende' }}</dd>
          </div>
          <div class="flex gap-6">
            <div>
              <dt class="text-xs font-semibold text-ui-ink-muted">Plateforme</dt>
              <dd class="mt-1 text-ui-ink">{{ platformLabel }}</dd>
            </div>
            <div>
              <dt class="text-xs font-semibold text-ui-ink-muted">Quand</dt>
              <dd class="mt-1 text-ui-ink">Maintenant</dd>
            </div>
          </div>
        </dl>

        <UiAlert v-if="error" class="mt-4" title="Publication impossible">{{ error }}</UiAlert>

        <div class="mt-6 flex flex-wrap justify-end gap-2">
          <UiButton :disabled="loading" @click="emit('cancel')">Annuler</UiButton>
          <UiButton variant="primary" :loading="loading" data-autofocus @click="emit('confirm')">
            {{ error ? 'Réessayer' : `Publier sur ${platformLabel}` }}
          </UiButton>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, useId } from 'vue'

// Confirmation obligatoire avant toute publication : elle est visible depuis l exterieur.
// En cas d echec, la fenetre reste ouverte avec le message et « Reessayer ».
const props = defineProps({
  open: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  platformLabel: { type: String, default: '' },
  caption: { type: String, default: '' },
  error: { type: String, default: '' },
})
const emit = defineEmits(['confirm', 'cancel'])

const uid = useId()
const preview = computed(() => {
  const text = String(props.caption || '').trim()
  return text.length > 280 ? `${text.slice(0, 280).trimEnd()}…` : text
})
</script>
