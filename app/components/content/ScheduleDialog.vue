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
        <h2 :id="`${uid}-title`" class="text-lg font-semibold text-ui-ink">Planifier</h2>
        <p class="mt-1 text-sm text-ui-ink-2">
          Le contenu apparaît au calendrier à cette date. Il ne sera publié tout seul que si tu actives la publication automatique.
        </p>

        <div class="mt-5 grid grid-cols-2 gap-3">
          <UiField label="Date" :for-id="`${uid}-date`">
            <UiInput :id="`${uid}-date`" v-model="date" type="date" :min="auto ? today : undefined" data-autofocus />
          </UiField>
          <UiField label="Heure" :for-id="`${uid}-time`">
            <UiInput :id="`${uid}-time`" v-model="time" type="time" />
          </UiField>
        </div>

        <div class="mt-4">
          <p class="text-[13px] font-semibold text-ui-ink">Réseaux</p>
          <div class="mt-2">
            <UiToggleChips v-model="platforms" label="Réseaux" :options="MANUAL_PLATFORMS" />
          </div>
          <p class="mt-1 text-xs text-ui-ink-muted">Aucune vérification de connexion : ce choix sert de repère dans le calendrier.</p>
        </div>

        <div class="mt-4">
          <UiSwitch v-model="auto" label="Publier automatiquement à cette date" :disabled="!hasInstagram" />
          <p class="mt-1 text-xs text-ui-ink-muted">{{ autoHint }}</p>
        </div>

        <UiAlert v-if="auto && blockReason" class="mt-4" title="La publication automatique échouerait">
          {{ blockReason }}
          <template v-if="settingsHref" #action>
            <NuxtLink :to="settingsHref" class="inline-flex min-h-[44px] items-center text-sm font-semibold underline">Ouvrir les paramètres du profil</NuxtLink>
          </template>
        </UiAlert>
        <UiAlert v-if="problem || error" class="mt-4">{{ problem || error }}</UiAlert>

        <div class="mt-6 flex flex-wrap justify-end gap-2">
          <UiButton :disabled="loading" @click="emit('cancel')">Annuler</UiButton>
          <UiButton variant="primary" :loading="loading" :disabled="!date || (auto && Boolean(blockReason))" @click="confirm">Planifier</UiButton>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, ref, useId, watch } from 'vue'
import { fromLocalDateTimeFields, toLocalDateTimeFields } from '~/utils/formatDate'
import { MANUAL_PLATFORMS } from '~/utils/manualPlatforms'

// Date (et heure) d un contenu valide au calendrier, avec publication automatique en option (PATCH /api/content/:id/schedule).
const props = defineProps({
  open: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  initial: { type: String, default: '' }, // ISO de la date deja planifiee, sinon demain 09:00
  initialAuto: { type: Boolean, default: false }, // publication automatique deja activee sur ce contenu
  error: { type: String, default: '' },
  // Raison pour laquelle la publication automatique echouerait forcement (Instagram non connecte...) : Planifier est bloque.
  blockReason: { type: String, default: '' },
  initialPlatforms: { type: Array, default: () => [] }, // reseaux deja choisis, sinon deduits de la plateforme d origine
  settingsHref: { type: String, default: '' },
})
const emit = defineEmits(['confirm', 'cancel'])

const uid = useId()
const date = ref('')
const time = ref('')
const problem = ref('')
const auto = ref(false)
const platforms = ref([])
const hasInstagram = computed(() => platforms.value.includes('INSTAGRAM'))
// Le planificateur ne publie tout seul que sur Instagram : sans Instagram, l interrupteur est coupe.
watch(hasInstagram, (value) => { if (!value) auto.value = false })
const autoHint = computed(() => {
  if (!hasInstagram.value) return 'La publication automatique n’existe que pour Instagram pour l’instant : coche Instagram pour l’activer. Les autres réseaux restent un repère de calendrier.'
  return auto.value
    ? 'À l’heure prévue, l’outil publie le contenu validé sur Instagram, avec le compte connecté à ce profil. Les autres réseaux cochés restent un repère.'
    : 'Désactivé : rien n’est publié tout seul, la date sert de repère.'
})
const today = computed(() => toLocalDateTimeFields(new Date().toISOString()).date)

watch(() => props.open, (value) => {
  if (!value) return
  const base = props.initial && new Date(props.initial).getTime() > Date.now()
    ? new Date(props.initial)
    : new Date(Date.now() + 24 * 3600 * 1000)
  const fields = toLocalDateTimeFields(base.toISOString())
  date.value = fields.date
  time.value = props.initial && new Date(props.initial).getTime() > Date.now() ? fields.time : '09:00'
  platforms.value = [...props.initialPlatforms]
  auto.value = props.initialAuto && platforms.value.includes('INSTAGRAM')
  problem.value = ''
})

function confirm() {
  const iso = fromLocalDateTimeFields({ date: date.value, time: time.value || '09:00' })
  if (!iso) {
    problem.value = 'Date invalide.'
    return
  }
  if (auto.value && new Date(iso).getTime() <= Date.now()) {
    problem.value = 'Choisis une date à venir : avec la publication automatique, un contenu planifié dans le passé partirait aussitôt.'
    return
  }
  problem.value = ''
  emit('confirm', iso, auto.value, [...platforms.value])
}
</script>
