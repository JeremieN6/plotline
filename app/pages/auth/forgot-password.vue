<template>
  <div class="auth-screen">
    <div class="auth-glow auth-glow-left" />
    <div class="auth-glow auth-glow-right" />

    <section class="auth-card">
      <NuxtLink to="/"><p class="router-link-active router-link-exact-active nav-logo pl-main-color">Plotline Studio</p></NuxtLink>
      <h1 class="auth-title">Mot de passe oublié</h1>
      <p class="auth-subtitle">
        Saisis l'adresse liée à ton compte, on t'envoie un lien pour choisir un nouveau mot de passe.
      </p>

      <form class="auth-form" @submit.prevent="submit">
        <label class="auth-label" for="email">Email</label>
        <input id="email" v-model="form.email" type="email" autocomplete="email" class="auth-input" placeholder="toi@exemple.com" required />

        <p v-if="error" class="auth-error">{{ error }}</p>
        <p v-if="success" class="auth-success">{{ success }}</p>

        <button type="submit" class="auth-submit" :disabled="loading">
          <span v-if="loading">Envoi...</span>
          <span v-else>Envoyer le lien</span>
        </button>
      </form>

      <p class="auth-footnote">
        Retour à la connexion
        <NuxtLink to="/auth/login" class="auth-link">Se connecter</NuxtLink>
      </p>
    </section>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue';

const loading = ref(false);
const error = ref('');
const success = ref('');

const form = reactive({
  email: '',
});

async function submit() {
  if (loading.value) return;

  loading.value = true;
  error.value = '';
  success.value = '';

  try {
    await $fetch('/api/auth/password/forgot', {
      method: 'POST',
      body: {
        email: form.email,
      },
    });

    success.value = 'Si un compte existe avec cet email, un lien de réinitialisation a été envoyé.';
  } catch (err) {
    error.value = err?.data?.statusMessage || err?.message || 'Impossible d envoyer le mail';
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=Fraunces:opsz,wght@9..144,500;9..144,700&display=swap');

.pl-main-color{
  color: #f8b989;
}

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

.auth-form {
  margin-top: 1.4rem;
  display: grid;
  gap: 0.72rem;
}

.auth-label {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 0.8rem;
  color: #f6d6b8;
}

.auth-input {
  width: 100%;
  border-radius: 12px;
  border: 1px solid rgba(247, 204, 164, 0.32);
  background: rgba(255, 248, 241, 0.08);
  color: #fff7ed;
  padding: 0.75rem 0.9rem;
  outline: none;
  font-family: 'Space Grotesk', sans-serif;
  transition: border-color 180ms ease, background 180ms ease;
}

.auth-input:focus {
  border-color: #eda464;
  background: rgba(255, 248, 241, 0.15);
}

.auth-input::placeholder {
  color: rgba(255, 236, 218, 0.52);
}

.auth-error {
  margin: 0.35rem 0 0;
  font-family: 'Space Grotesk', sans-serif;
  font-size: 0.82rem;
  color: #ffb9a8;
}

.auth-success {
  margin: 0.35rem 0 0;
  font-family: 'Space Grotesk', sans-serif;
  font-size: 0.82rem;
  color: #b9ffd9;
}

.auth-submit {
  margin-top: 0.35rem;
  border: none;
  border-radius: 13px;
  background: linear-gradient(92deg, #eb8a40, #d8722e);
  color: white;
  font-family: 'Space Grotesk', sans-serif;
  font-weight: 700;
  padding: 0.84rem 1rem;
  cursor: pointer;
  transition: transform 150ms ease, filter 150ms ease;
}

.auth-submit:hover {
  transform: translateY(-1px);
  filter: brightness(1.05);
}

.auth-submit:disabled {
  opacity: 0.7;
  cursor: not-allowed;
  transform: none;
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
