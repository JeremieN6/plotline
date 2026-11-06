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
        <h2 :id="`${uid}-title`" class="text-lg font-semibold text-ui-ink">Planifier la publication</h2>
        <p class="mt-1 text-sm text-ui-ink-2">
          Le contenu validé sera publié automatiquement sur Instagram à cette date, et apparaîtra au calendrier.
        </p>

        <div class="mt-5 grid grid-cols-2 gap-3">
          <UiField label="Date" :for-id="`${uid}-date`">
            <UiInput :id="`${uid}-date`" v-model="date" type="date" :min="today" data-autofocus />
          </UiField>
          <UiField label="Heure" :for-id="`${uid}-time`">
            <UiInput :id="`${uid}-time`" v-model="time" type="time" />
          </UiField>
        </div>

        <UiAlert v-if="problem || error" class="mt-4">{{ problem || error }}</UiAlert>

        <div class="mt-6 flex flex-wrap justify-end gap-2">
          <UiButton :disabled="loading" @click="emit('cancel')">Annuler</UiButton>
          <UiButton variant="primary" :loading="loading" :disabled="!date" @click="confirm">Planifier</UiButton>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, ref, useId, watch } from 'vue'
import { fromLocalDateTimeFields, toLocalDateTimeFields } from '~/utils/formatDate'

// Date et heure de publication automatique d un contenu valide (route existante PATCH /api/content/:id/schedule).
const props = defineProps({
  open: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  initial: { type: String, default: '' }, // ISO de la date deja planifiee, sinon demain 09:00
  error: { type: String, default: '' },
})
const emit = defineEmits(['confirm', 'cancel'])

const uid = useId()
const date = ref('')
const time = ref('')
const problem = ref('')
const today = computed(() => toLocalDateTimeFields(new Date().toISOString()).date)

watch(() => props.open, (value) => {
  if (!value) return
  const base = props.initial && new Date(props.initial).getTime() > Date.now()
    ? new Date(props.initial)
    : new Date(Date.now() + 24 * 3600 * 1000)
  const fields = toLocalDateTimeFields(base.toISOString())
  date.value = fields.date
  time.value = props.initial && new Date(props.initial).getTime() > Date.now() ? fields.time : '09:00'
  problem.value = ''
})

function confirm() {
  const iso = fromLocalDateTimeFields({ date: date.value, time: time.value || '09:00' })
  if (!iso) {
    problem.value = 'Date invalide.'
    return
  }
  if (new Date(iso).getTime() <= Date.now()) {
    problem.value = 'Choisis une date à venir : un contenu planifié dans le passé partirait aussitôt.'
    return
  }
  problem.value = ''
  emit('confirm', iso)
}
</script>
