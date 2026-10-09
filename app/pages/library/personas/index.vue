<template>
  <div class="space-y-6">
    <header class="rounded-[20px] border border-[#E5E3DF] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
      <p class="text-xs font-semibold uppercase tracking-[0.22em] text-[#E8873A]">Bibliothèque</p>
      <h1 class="mt-2 text-3xl font-bold tracking-tight text-[#111111]">Dossiers personas</h1>
      <p class="mt-2 text-sm text-[#666666]">
        Pour chaque persona, tout ce qui sert à ses vidéos faceless au même endroit : sa direction artistique, son avatar et ses images,
        ses illustrations, sa voix et les vidéos déjà faites.
      </p>
      <div class="mt-4"><LibraryTabs /></div>
    </header>

    <p v-if="error" class="rounded-[12px] border border-[#F3C1C1] bg-[#FFF4F4] p-3 text-sm text-[#A33]">
      Impossible de charger les dossiers.
    </p>

    <p v-else-if="!folders.length" class="rounded-[20px] border border-dashed border-[#E5D8C9] bg-[#FAFAF8] p-6 text-sm text-[#7B5A3F]">
      Aucune persona pour l’instant. Crée une persona pour obtenir son dossier.
    </p>

    <div v-else class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <NuxtLink
        v-for="folder in folders"
        :key="folder.id"
        :to="`/library/personas/${folder.id}`"
        class="flex gap-4 rounded-[20px] border border-[#E5E3DF] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.08)] transition-colors hover:border-[#E8873A]/50"
      >
        <div class="h-24 w-24 shrink-0 overflow-hidden rounded-[14px] border border-[#E5E3DF] bg-[#F5F4F1]">
          <img v-if="folder.baseUrl" :src="folder.baseUrl" alt="" class="h-full w-full object-contain">
          <p v-else class="flex h-full items-center justify-center p-2 text-center text-[11px] text-[#999]">Pas encore d’avatar</p>
        </div>
        <div class="min-w-0 flex-1">
          <p class="truncate text-base font-bold text-[#111111]">{{ folder.name }}</p>
          <p class="mt-0.5 truncate text-xs text-[#666666]">DA : {{ folder.stored ? folder.daName : 'par défaut' }}</p>
          <div class="mt-2 flex gap-1">
            <span
              v-for="color in swatches(folder.palette)"
              :key="color"
              class="h-4 w-4 rounded-full border border-black/10"
              :style="{ backgroundColor: color }"
            />
          </div>
          <p class="mt-2 text-xs text-[#555]">
            {{ folder.packReady }} image(s) d’avatar · {{ folder.illustrations }} illustration(s) · {{ folder.videos }} vidéo(s)
          </p>
        </div>
      </NuxtLink>
    </div>
  </div>
</template>

<script setup>
useSeoMeta({ title: 'Dossiers personas' })

// Rendu serveur: useFetch transmet le cookie de session (un $fetch brut non).
const { data, error } = await useFetch('/api/faceless/folders', { key: 'faceless-folders' })
const folders = computed(() => data.value?.folders || [])

function swatches(palette) {
  return palette ? [palette.background, palette.backgroundAlt, palette.accent, palette.accent2, palette.text] : []
}
</script>
