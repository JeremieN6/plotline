<template>
  <div class="auth-screen">
    <div class="auth-glow auth-glow-left" />
    <div class="auth-glow auth-glow-right" />

    <section class="auth-card">
      <!-- <p class="auth-kicker">Plotline Studio</p> -->      
      <NuxtLink to="/"><p class="router-link-active router-link-exact-active nav-logo pl-main-color">Plotline Studio</p></NuxtLink>
      <h1 class="auth-title">Connexion</h1>
      <p class="auth-subtitle">Accède à ton back-office de production d'influenceuses IA.</p>

      <form class="auth-form" @submit.prevent="submit">
        <label class="auth-label" for="email">Email</label>
        <input id="email" v-model="form.email" type="email" autocomplete="email" class="auth-input" placeholder="toi@exemple.com" required />

        <label class="auth-label" for="password">Mot de passe</label>
        <input id="password" v-model="form.password" type="password" autocomplete="current-password" class="auth-input" placeholder="Minimum 8 caractères" required />
        <NuxtLink to="/auth/forgot-password" class="auth-secondary-link">Mot de passe oublié ?</NuxtLink>

        <p v-if="error" class="auth-error">{{ error }}</p>

        <button type="submit" class="auth-submit" :disabled="loading">
          <span v-if="loading">Connexion...</span>
          <span v-else>Entrer dans le dashboard</span>
        </button>
      </form>

      <div class="auth-divider"><span>ou</span></div>

      <!-- Navigation pleine page, pas un fetch: le parcours OAuth quitte le site. -->
      <a href="/api/auth/google" class="auth-google">
        <svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true">
          <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
          <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
          <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z" />
          <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.42 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
        </svg>
        Continuer avec Google
      </a>

      <p class="auth-footnote">
        Nouveau sur Plotline ?
        <NuxtLink to="/auth/signup" class="auth-link">Créer un compte</NuxtLink>
      </p>
    </section>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue';

const route = useRoute();
const router = useRouter();
const { refreshAuth } = useAuthSession();

const loading = ref(false);
// Le retour de Google se fait par redirection: le motif d echec arrive en query.
const error = ref(String(route.query?.error || ''));
const form = reactive({
  email: '',
  password: '',
});

const redirectTarget = computed(() => {
  const candidate = String(route.query?.redirect || '/onboarding');
  if (!candidate.startsWith('/')) return '/onboarding';
  if (candidate.startsWith('/auth')) return '/onboarding';
  return candidate;
});

async function submit() {
  if (loading.value) return;

  loading.value = true;
  error.value = '';

  try {
    await $fetch('/api/auth/login', {
      method: 'POST',
      body: {
        email: form.email,
        password: form.password,
      },
    });

    await refreshAuth({ force: true });
    await router.push(redirectTarget.value);
  } catch (err) {
    error.value = err?.data?.statusMessage || err?.message || 'Connexion impossible';
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

/* Separateur et bouton Google, sur la palette sombre des ecrans d auth. */
.auth-divider {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin: 1.1rem 0 0.9rem;
  font-family: 'Space Grotesk', sans-serif;
  font-size: 0.78rem;
  color: rgba(245, 214, 191, 0.55);
}

.auth-divider::before,
.auth-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: rgba(244, 205, 169, 0.18);
}

.auth-google {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  width: 100%;
  box-sizing: border-box;
  padding: 0.8rem 1rem;
  border: 1px solid rgba(244, 205, 169, 0.22);
  border-radius: 13px;
  background: rgba(255, 255, 255, 0.96);
  color: #1f1a15;
  font-family: 'Space Grotesk', sans-serif;
  font-weight: 700;
  font-size: 0.9rem;
  text-decoration: none;
  transition: transform 150ms ease, filter 150ms ease;
}

.auth-google:hover {
  transform: translateY(-1px);
  filter: brightness(0.98);
}

.auth-footnote {
  margin: 1.2rem 0 0;
  font-family: 'Space Grotesk', sans-serif;
  font-size: 0.86rem;
  color: #f5d6bf;
}

.auth-link {
  color: #ffc486;
  font-weight: 700;
  text-decoration: none;
}

.auth-link:hover {
  text-decoration: underline;
}

.auth-secondary-link {
  margin-top: -0.18rem;
  justify-self: end;
  font-family: 'Space Grotesk', sans-serif;
  font-size: 0.78rem;
  text-decoration: none;
  color: #ffcd9b;
}

.auth-secondary-link:hover {
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
