<script setup>
definePageMeta({
  middleware: ['auth'],
})

await navigateTo('/profiles/new')
</script>
