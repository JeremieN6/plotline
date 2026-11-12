<template>
  <UiAlert v-if="items.length" tone="info" :title="title">
    <p>Tu les as peut-être déjà postés toi-même : l’outil ne peut pas le savoir.</p>

    <ul class="mt-3 space-y-2">
      <li v-for="item in items" :key="item.id" class="flex flex-wrap items-center justify-between gap-3 rounded-ui-ctl bg-ui-surface px-3 py-2 text-ui-ink">
        <div class="min-w-0">
          <p class="truncate text-sm font-semibold">{{ hookOf(item) }}</p>
          <p class="text-xs text-ui-ink-muted">Prévu {{ formatShortDate(item.scheduledAt) }}{{ networks(item) ? ` · ${networks(item)}` : '' }}</p>
        </div>
        <div class="flex shrink-0 flex-wrap gap-2">
          <UiButton size="sm" :disabled="item._loading" @click="emit('confirm', item)">Oui, c’est publié</UiButton>
          <UiButton size="sm" variant="ghost" :disabled="item._loading" @click="emit('reschedule', item)">Pas encore</UiButton>
        </div>
      </li>
    </ul>
  </UiAlert>
</template>

<script setup>
import { computed } from 'vue'
import { formatShortDate } from '~/utils/formatDate'
import { captionHook, plannedPlatformsOf } from '~/utils/contentCards'
import { formatPlatforms } from '~/utils/manualPlatforms'

// Rappel discret : contenus « Prevus » dont la date est passee. Il n execute rien : la page ouvre la fenetre voulue.
const props = defineProps({
  items: { type: Array, default: () => [] },
})
const emit = defineEmits(['confirm', 'reschedule'])

const title = computed(() => (props.items.length > 1
  ? `${props.items.length} contenus prévus sont passés. Les as-tu publiés ?`
  : 'Un contenu prévu est passé. L’as-tu publié ?'))

function hookOf(item) {
  const hook = captionHook(item.caption).hook
  return hook.length > 90 ? `${hook.slice(0, 90).trimEnd()}…` : hook || 'Contenu sans légende'
}
const networks = (item) => formatPlatforms(plannedPlatformsOf(item))
</script>
