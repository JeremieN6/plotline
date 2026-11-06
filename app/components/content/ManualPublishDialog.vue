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
        <h2 :id="`${uid}-title`" class="text-lg font-semibold text-ui-ink">Marquer comme publié</h2>
        <p class="mt-1 text-sm text-ui-ink-2">
          Pour un contenu que tu as posté toi-même. Il passera en « Publié » et apparaîtra au calendrier à la date choisie.
        </p>

        <div class="mt-5 space-y-4">
          <div class="grid grid-cols-2 gap-3">
            <UiField label="Date" :for-id="`${uid}-date`">
              <UiInput :id="`${uid}-date`" v-model="date" type="date" :max="today" />
            </UiField>
            <UiField label="Heure" :for-id="`${uid}-time`">
              <UiInput :id="`${uid}-time`" v-model="time" type="time" />
            </UiField>
          </div>

          <UiField label="Publié sur" hint="Tu peux en choisir plusieurs.">
            <UiToggleChips v-model="platforms" :options="MANUAL_PLATFORMS" label="Plateformes" />
          </UiField>
        </div>

        <UiAlert v-if="problem" class="mt-4">{{ problem }}</UiAlert>

        <div class="mt-6 flex flex-wrap justify-end gap-2">
          <UiButton :disabled="loading" @click="emit('cancel')">Annuler</UiButton>
          <UiButton variant="primary" :loading="loading" :disabled="!canConfirm" @click="confirm">Marquer comme publié</UiButton>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, ref, useId, watch } from 'vue'
import { fromLocalDateTimeFields, toLocalDateTimeFields } from '~/utils/formatDate'
import { MANUAL_PLATFORMS } from '~/utils/manualPlatforms'

// Fenetre « Marquer comme publie » : date et heure reelles de la publication faite a la main + plateformes.
const props = defineProps({
  open: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
})
const emit = defineEmits(['confirm', 'cancel'])

const uid = useId()
const date = ref('')
const time = ref('')
const platforms = ref([])
const problem = ref('')

const today = computed(() => toLocalDateTimeFields(new Date().toISOString()).date)

// A chaque ouverture : maintenant, aucune plateforme choisie.
watch(() => props.open, (value) => {
  if (!value) return
  const fields = toLocalDateTimeFields(new Date().toISOString())
  date.value = fields.date
  time.value = fields.time
  platforms.value = []
  problem.value = ''
})

const canConfirm = computed(() => Boolean(date.value) && platforms.value.length > 0 && !props.loading)

function confirm() {
  const iso = fromLocalDateTimeFields({ date: date.value, time: time.value || '12:00' })
  if (!iso) {
    problem.value = 'Date invalide.'
    return
  }
  if (new Date(iso).getTime() > Date.now() + 10 * 60 * 1000) {
    problem.value = 'La date ne peut pas être dans le futur : tu enregistres une publication déjà faite.'
    return
  }
  problem.value = ''
  emit('confirm', { publishedAt: iso, platforms: [...platforms.value] })
}
</script>
