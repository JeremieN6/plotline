<template>
  <div class="auth-screen">
    <div class="auth-glow auth-glow-left" />
    <div class="auth-glow auth-glow-right" />

    <section class="auth-card">
      <p class="auth-kicker">Plotline Studio</p>
      <h1 class="auth-title">Confirmation email</h1>
      <p class="auth-subtitle">Validation de ta nouvelle adresse de connexion.</p>

      <p v-if="loading" class="auth-info">Validation en cours...</p>
      <p v-else-if="error" class="auth-error">{{ error }}</p>
      <p v-else class="auth-success">{{ success }}</p>

      <p class="auth-footnote">
        Retour au dashboard
        <NuxtLink to="/settings" class="auth-link">Ouvrir les paramètres</NuxtLink>
      </p>
    </section>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';

const route = useRoute();
const { refreshAuth } = useAuthSession();

const loading = ref(true);
const error = ref('');
const success = ref('');

onMounted(async () => {
  const token = String(route.query?.token || '').trim();

  if (!token) {
    loading.value = false;
    error.value = 'Lien invalide.';
    return;
  }

  try {
    await $fetch('/api/auth/email/confirm', {
      method: 'POST',
      body: { token },
    });

    await refreshAuth({ force: true });
    success.value = 'Ton adresse email a bien été mise à jour.';
  } catch (err) {
    error.value = err?.data?.statusMessage || err?.message || 'Impossible de confirmer ce lien';
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=Fraunces:opsz,wght@9..144,500;9..144,700&display=swap');

.auth-screen {
  min-height: 100vh;
  position: relative;
  display: grid;
  place-items: center;
  padding: 2rem 1rem;
  background:
    radial-gradient(circle at 12% 15%, rgba(245, 173, 104, 0.25), transparent 30%),
    radial-gradient(circle at 86% 10%, rgba(230, 142, 64, 0.28), transparent 32%),
    linear-gradient(155deg, #1b130d 0%, #100a06 58%, #070503 100%);
  overflow: hidden;
}

.auth-glow {
  position: absolute;
  border-radius: 999px;
  filter: blur(48px);
  opacity: 0.45;
  pointer-events: none;
}

.auth-glow-left {
  width: 260px;
  height: 260px;
  background: rgba(243, 183, 114, 0.4);
  left: -100px;
  bottom: -80px;
}

.auth-glow-right {
  width: 320px;
  height: 320px;
  background: rgba(217, 122, 44, 0.36);
  right: -130px;
  top: -140px;
}

.auth-card {
  position: relative;
  width: min(460px, 100%);
  border: 1px solid rgba(252, 214, 170, 0.34);
  background: rgba(23, 15, 9, 0.88);
  border-radius: 28px;
  padding: 2rem;
  color: #fff3e7;
  backdrop-filter: blur(8px);
  box-shadow: 0 28px 70px rgba(0, 0, 0, 0.4);
  animation: reveal 300ms ease-out;
}

.auth-kicker {
  margin: 0;
  font-family: 'Space Grotesk', sans-serif;
  font-size: 0.72rem;
  letter-spacing: 0.24em;
  text-transform: uppercase;
  color: #f8b989;
}

.auth-title {
  margin: 0.5rem 0 0;
  font-family: 'Fraunces', serif;
  font-size: clamp(2rem, 5vw, 2.5rem);
  line-height: 1.05;
}

.auth-subtitle {
  margin: 0.8rem 0 0;
  font-family: 'Space Grotesk', sans-serif;
  color: #f7d9bf;
  font-size: 0.95rem;
  line-height: 1.5;
}

.auth-info,
.auth-error,
.auth-success {
  margin: 1.4rem 0 0;
  font-family: 'Space Grotesk', sans-serif;
  font-size: 0.9rem;
}

.auth-info {
  color: #ffe4c4;
}

.auth-error {
  color: #ffb9a8;
}

.auth-success {
  color: #b9ffd9;
}

.auth-footnote {
  margin: 1.2rem 0 0;
  font-family: 'Space Grotesk', sans-serif;
  font-size: 0.86rem;
  color: #f5d6bf;
}

.auth-link {
  margin-left: 0.4rem;
  color: #ffc486;
  font-weight: 700;
  text-decoration: none;
}

.auth-link:hover {
  text-decoration: underline;
}

@keyframes reveal {
  from {
    opacity: 0;
    transform: translateY(8px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@media (max-width: 640px) {
  .auth-card {
    padding: 1.4rem;
    border-radius: 22px;
  }
}
</style>
