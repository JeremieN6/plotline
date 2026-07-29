<script setup>
definePageMeta({
  middleware: ['auth'],
})

await navigateTo('/influencers/new')
</script>
