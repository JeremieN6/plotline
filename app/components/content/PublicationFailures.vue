<template>
  <UiAlert v-if="items.length" tone="error" :title="title">
    <p>L’outil n’a pas pu publier {{ items.length > 1 ? 'ces contenus' : 'ce contenu' }} à l’heure prévue. Rien n’a été publié : choisis ce que tu veux en faire.</p>

    <ul class="mt-3 space-y-3">
      <li v-for="item in items" :key="item.id" class="rounded-ui-ctl border border-ui-danger-line bg-ui-surface p-3 text-ui-ink">
        <p class="text-sm font-semibold">{{ hookOf(item) }}</p>
        <p class="mt-0.5 text-xs text-ui-ink-muted">Prévu {{ formatShortDate(item.scheduledAt) }}</p>
        <p v-if="item.errorMessage" class="mt-1 text-xs text-ui-danger-ink">{{ item.errorMessage }}</p>

        <div class="mt-3 flex flex-wrap gap-2">
          <UiButton size="sm" :loading="item._loading" @click="emit('manual', item)">Marquer comme publié à la main</UiButton>
          <UiButton size="sm" :disabled="item._loading" @click="emit('reschedule', item)">Reprogrammer</UiButton>
          <UiButton size="sm" :disabled="item._loading" @click="emit('keep', item)">Garder en « Validé »</UiButton>
          <UiButton size="sm" variant="danger" :disabled="item._loading" @click="emit('remove', item)">Supprimer</UiButton>
        </div>
      </li>
    </ul>
  </UiAlert>
</template>

<script setup>
import { computed } from 'vue'
import { formatShortDate } from '~/utils/formatDate'
import { captionHook } from '~/utils/contentCards'

// Bandeau des publications automatiques ratees. Il n execute rien : la page agit (remise en « Valide » d abord).
const props = defineProps({
  items: { type: Array, default: () => [] },
})
const emit = defineEmits(['manual', 'reschedule', 'keep', 'remove'])

const title = computed(() => (props.items.length > 1
  ? `${props.items.length} publications automatiques ont échoué`
  : 'Une publication automatique a échoué'))

function hookOf(item) {
  const hook = captionHook(item.caption).hook
  return hook.length > 90 ? `${hook.slice(0, 90).trimEnd()}…` : hook || 'Contenu sans légende'
}
</script>
