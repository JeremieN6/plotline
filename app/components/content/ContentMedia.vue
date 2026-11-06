<template>
  <div class="relative h-full w-full overflow-hidden bg-ui-subtle" @mouseenter="onHover(true)" @mouseleave="onHover(false)">
    <!-- Echec reel (fichier introuvable, lecture impossible) : jamais affiche quand l image existe. -->
    <div v-if="failed" class="flex h-full w-full flex-col items-center justify-center gap-2 text-center font-ui" :class="compact ? 'p-1' : 'p-4'" :title="compact ? 'Aperçu indisponible' : undefined">
      <svg class="text-ui-ink-muted" :class="compact ? 'h-4 w-4' : 'h-6 w-6'" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" stroke-width="1.6" />
        <path d="m3 16 5-5 4 4 3-3 6 6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
      <template v-if="!compact">
        <p class="text-xs text-ui-ink-muted">Aperçu indisponible</p>
        <UiButton size="sm" @click.stop="retry">Réessayer</UiButton>
      </template>
    </div>

    <template v-else-if="src">
      <video
        v-if="isVideo"
        :key="attempt"
        ref="videoRef"
        :src="src"
        class="h-full w-full object-cover"
        muted
        loop
        playsinline
        preload="metadata"
        @loadedmetadata="onMetadata"
        @loadeddata="loaded = true"
        @error="failed = true"
      />
      <img
        v-else
        :key="attempt"
        :src="src"
        :alt="alt"
        class="h-full w-full object-cover"
        @load="loaded = true"
        @error="failed = true"
      />
      <!-- Chargement : squelette aux proportions du media. -->
      <div v-if="!loaded" class="absolute inset-0 animate-pulse bg-ui-subtle" role="status" aria-label="Chargement du média" />
    </template>

    <div v-else class="flex h-full w-full items-center justify-center p-4 text-center text-xs text-ui-ink-muted font-ui">Pas de média</div>

    <span
      v-if="isVideo && duration && !failed && !compact"
      class="pointer-events-none absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-ui-ink/70 px-2 py-0.5 font-ui text-[11px] font-semibold text-white"
    >
      <svg class="h-2.5 w-2.5" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true"><path d="M2 1.2v7.6L8.4 5z" /></svg>
      {{ formatDuration(duration) }}
    </span>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { formatDuration, posterTime } from '~/utils/contentCards'

// Media d une carte. Les videos d une meme direction artistique s'ouvrent toutes sur la meme image : l apercu est donc
// pris a 25 % de la duree (jamais l image 0). Pas de lecture automatique ; au survol, une pre-lecture muette
// (desactivee si l utilisateur prefere moins d animations). Aucun fichier d apercu n est stocke : l image est
// calculee dans le navigateur.
const props = defineProps({
  src: { type: String, default: '' },
  isVideo: { type: Boolean, default: false },
  alt: { type: String, default: 'Aperçu du contenu' },
  // Miniature de la vue liste : pas de texte ni de bouton dans l etat d erreur.
  compact: { type: Boolean, default: false },
})

const failed = ref(false)
const loaded = ref(false)
const attempt = ref(0)
const duration = ref(0)
const videoRef = ref(null)
let poster = 0

function onMetadata(event) {
  const video = event.target
  duration.value = Number.isFinite(video.duration) ? video.duration : 0
  poster = posterTime(video.duration)
  if (poster > 0) video.currentTime = poster
}

function onHover(on) {
  const video = videoRef.value
  if (!video || failed.value || !import.meta.client) return
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
  if (on) {
    video.play().catch(() => {})
  } else {
    video.pause()
    video.currentTime = poster
  }
}

function retry() {
  failed.value = false
  loaded.value = false
  attempt.value += 1
}
</script>
