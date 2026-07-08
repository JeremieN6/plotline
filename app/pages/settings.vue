<template>
  <div class="grid gap-5">
    <section class="rounded-[20px] border border-[#E5E3DF] bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
      <p class="text-xs font-semibold uppercase tracking-[0.22em] text-[#E8873A]">Compte</p>
      <h1 class="mt-2 text-3xl font-bold text-[#111111]">Paramètres du compte</h1>
      <p class="mt-3 text-sm text-[#666666]">Email actuel : <span class="font-semibold text-[#111111]">{{ currentEmail }}</span></p>
    </section>

    <section class="rounded-[20px] border border-[#E5E3DF] bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
      <p class="text-xs font-semibold uppercase tracking-[0.22em] text-[#E8873A]">Sécurité</p>
      <h2 class="mt-2 text-2xl font-bold text-[#111111]">Modifier l'adresse email</h2>
      <p class="mt-2 text-sm text-[#666666]">
        Un email de confirmation sera envoyé sur la nouvelle adresse.
      </p>

      <form class="mt-5 grid gap-3 max-w-xl" @submit.prevent="submitEmailChange">
        <label class="text-sm font-medium text-[#4A4A4A]" for="new-email">Nouvelle adresse email</label>
        <input
          id="new-email"
          v-model="form.newEmail"
          type="email"
          autocomplete="email"
          required
          class="w-full rounded-xl border border-[#DDD7CF] bg-[#FFFCF8] px-3 py-2 text-sm text-[#111111] outline-none transition focus:border-[#E8873A]"
          placeholder="nouvelle-adresse@exemple.com"
        />

        <label class="text-sm font-medium text-[#4A4A4A]" for="current-password">Mot de passe actuel</label>
        <input
          id="current-password"
          v-model="form.password"
          type="password"
          autocomplete="current-password"
          class="w-full rounded-xl border border-[#DDD7CF] bg-[#FFFCF8] px-3 py-2 text-sm text-[#111111] outline-none transition focus:border-[#E8873A]"
          placeholder="Requis si ton compte a deja un mot de passe"
        />

        <p v-if="error" class="text-sm text-[#D24636]">{{ error }}</p>
        <p v-if="success" class="text-sm text-[#197A4B]">{{ success }}</p>

        <button
          type="submit"
          class="mt-2 w-fit rounded-xl bg-[#111111] px-4 py-2 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-60"
          :disabled="loading"
        >
          <span v-if="loading">Envoi...</span>
          <span v-else>Envoyer le lien de confirmation</span>
        </button>
      </form>
    </section>
  </div>
</template>

<script setup>
import { computed, reactive, ref } from 'vue';

const { user, refreshAuth } = useAuthSession();

const loading = ref(false);
const error = ref('');
const success = ref('');

const form = reactive({
  newEmail: '',
  password: '',
});

const currentEmail = computed(() => String(user.value?.email || 'non renseigne'));

async function submitEmailChange() {
  if (loading.value) return;

  loading.value = true;
  error.value = '';
  success.value = '';

  try {
    await $fetch('/api/auth/email/change', {
      method: 'POST',
      body: {
        newEmail: form.newEmail,
        password: form.password,
      },
    });

    await refreshAuth({ force: true });
    success.value = 'Email de confirmation envoye. Ouvre ta nouvelle boite pour valider le changement.';
  } catch (err) {
    error.value = err?.data?.statusMessage || err?.message || 'Impossible de demarrer la procedure';
  } finally {
    loading.value = false;
  }
}
</script>
