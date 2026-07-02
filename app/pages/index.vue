<script setup>
import '~/assets/css/landing.css'

useSeoMeta({
  title: 'Plotline - Face Consistency automatique pour influenceuses IA',
  description:
    "Plotline injecte automatiquement l'image de reference de ton influenceuse dans chaque generation. Meme visage, chaque post. Instagram & TikTok."
})
</script>

<template>
  <div class="landing-root">
    <div class="grain-overlay" />
    <LandingHeader />

    <main class="landing-main">
      <LandingHero />
      <LandingProblem />
      <LandingConcept />
      <LandingHowItWorks />
      <LandingWhoFor />
      <LandingTestimonials />
      <LandingPricing />
      <LandingComparison />
      <LandingFaq />
      <LandingFinalCta />
      <LandingBlogPreview />
    </main>

    <LandingFooter />
  </div>
</template>
