<template>
  <section class="rounded-[14px] border border-[#E5E3DF] bg-[#FAFAF8] p-3 font-ui">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <p class="text-xs font-semibold uppercase tracking-[0.16em] text-[#A37A58]">Assets de la bibliothèque (optionnel)</p>
      <p class="text-xs font-semibold" :class="selected.length >= maxSlots ? 'text-ui-danger-ink' : 'text-[#7B5A3F]'">
        {{ selected.length }} / {{ maxSlots }} références
      </p>
    </div>
    <p class="mt-1 text-xs text-[#7B5A3F]">
      La fiche de chaque asset est envoyée au modèle pour que la voiture, le lieu ou le bijou reste fidèle. Choisis-les dans l'ordre où ils comptent.
    </p>

    <UiAlert v-if="selected.length > recommendedMax" tone="info" class="mt-3">
      Au-delà de {{ recommendedMax }} assets, le modèle en ignore souvent certains. Commence avec peu d'assets.
    </UiAlert>

    <UiAlert v-if="loadError" class="mt-3" title="Bibliothèque indisponible">
      Impossible de charger tes assets pour le moment.
      <template #action>
        <UiButton variant="secondary" size="sm" @click="refresh()">Réessayer</UiButton>
      </template>
    </UiAlert>

    <UiEmptyState
      v-else-if="loaded && !assets.length"
      class="mt-3"
      title="Aucun asset dans ta bibliothèque"
      text="Crée une voiture, un lieu ou un bijou, puis génère sa fiche pour le retrouver ici."
    />

    <ul v-else-if="assets.length" class="mt-3 grid gap-2 sm:grid-cols-2">
      <li v-for="asset in assets" :key="asset.id">
        <div class="relative rounded-[12px] border bg-white p-2 transition-colors" :class="cardClass(asset)">
          <button
            type="button"
            class="flex w-full items-center gap-3 text-left disabled:cursor-not-allowed"
            :disabled="isDisabled(asset)"
            :aria-pressed="isSelected(asset.id)"
            @click="toggle(asset)"
          >
            <span class="relative h-14 w-14 shrink-0 overflow-hidden rounded-[8px] bg-[#F2EEE8]">
              <img v-if="asset.sheetUrl" :src="asset.sheetUrl" :alt="`Fiche ${asset.name}`" class="h-full w-full object-cover" />
              <span v-else class="flex h-full w-full items-center justify-center text-[10px] font-semibold text-[#999999]">Sans fiche</span>
            </span>
            <span class="min-w-0 flex-1">
              <span class="block truncate text-sm font-semibold text-[#111111]">{{ asset.code }}</span>
              <span class="block truncate text-xs text-[#888888]">{{ typeLabel(asset.type) }} · {{ asset.name }}</span>
              <UiBadge v-if="asset.sheetUrl && asset.sheetOutdated" status="review" label="Fiche à régénérer" class="mt-1" />
            </span>
          </button>
          <!-- Hors du bouton : un lien dans un bouton désactivé ne serait pas cliquable. -->
          <p v-if="!asset.sheetUrl" class="mt-1 px-1 text-xs text-[#B45F1D]">
            Générer la fiche d'abord :
            <NuxtLink to="/library" class="font-bold underline">ouvrir la bibliothèque</NuxtLink>
          </p>
          <span
            v-if="isSelected(asset.id)"
            class="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-[#E8873A] text-xs font-bold text-white"
          >
            {{ orderOf(asset.id) }}
          </span>
        </div>
      </li>
    </ul>

    <div v-if="insertable && selectedAssets.length" class="mt-3 flex flex-wrap items-center gap-2">
      <span class="text-xs text-[#7B5A3F]">Ajouter au prompt :</span>
      <button
        v-for="asset in selectedAssets"
        :key="asset.id"
        type="button"
        class="rounded-full border border-[#D9C6B4] bg-white px-2.5 py-1 text-xs font-semibold text-[#7B5A3F] hover:bg-[#FDF3EA]"
        @click="emit('insert-code', asset.code)"
      >
        + {{ asset.code }}
      </button>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  // Emplacements restants (14 moins la face ref et le packshot).
  maxSlots: { type: Number, default: 14 },
  recommendedMax: { type: Number, default: 6 },
  // Affiche les chips qui ajoutent le code de l'asset au prompt (Prompt libre).
  insertable: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue', 'insert-code'])

// useFetch (et non un $fetch brut) : il transmet le cookie de session au rendu serveur.
const { data, error: loadError, status, refresh } = await useFetch('/api/assets', { key: 'studio-library-assets' })

const assets = computed(() => data.value?.assets || [])
const types = computed(() => data.value?.meta?.types || [])
const loaded = computed(() => status.value === 'success')
const selected = computed(() => props.modelValue)
const selectedAssets = computed(() => selected.value.map((id) => assets.value.find((item) => item.id === id)).filter(Boolean))

function typeLabel(type) {
  return types.value.find((item) => item.type === type)?.label || type
}
function isSelected(id) {
  return selected.value.includes(id)
}
function orderOf(id) {
  return selected.value.indexOf(id) + 1
}
function isDisabled(asset) {
  if (!asset.sheetUrl) return true
  return !isSelected(asset.id) && selected.value.length >= props.maxSlots
}
function cardClass(asset) {
  if (isSelected(asset.id)) return 'border-[#E8873A] ring-1 ring-[#E8873A]'
  if (isDisabled(asset)) return 'cursor-not-allowed border-[#E5E3DF] opacity-60'
  return 'border-[#E5E3DF] hover:border-[#E8873A]/50'
}
function toggle(asset) {
  if (isDisabled(asset)) return
  emit(
    'update:modelValue',
    isSelected(asset.id) ? selected.value.filter((id) => id !== asset.id) : [...selected.value, asset.id],
  )
}
</script>
