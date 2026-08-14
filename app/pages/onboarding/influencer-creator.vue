<script setup>
// Cette page ne fait que rediriger vers la creation de profil.
//
// Elle declarait `middleware: ['auth']`, qui n a jamais existe: le seul
// middleware du projet est `auth.global.ts`, et un middleware global ne peut pas
// etre reference par son nom. Nuxt levait donc "Unknown route middleware".
// La protection est deja assuree: le middleware global redirige vers la
// connexion tout visiteur non authentifie, sur toutes les routes.
await navigateTo('/profiles/new')
</script>
