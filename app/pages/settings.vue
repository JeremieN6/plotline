<template>
  <div class="grid gap-5">
    <section class="rounded-[20px] border border-[#E5E3DF] bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
      <p class="text-xs font-semibold uppercase tracking-[0.22em] text-[#E8873A]">Compte</p>
      <h1 class="mt-2 text-3xl font-bold text-[#111111]">Paramètres du compte</h1>
      <p class="mt-3 text-sm text-[#666666]">Gère la sécurité et les informations d'accès de ton espace Plotline.</p>

      <div class="mt-5 grid gap-3 sm:grid-cols-3">
        <div class="rounded-xl border border-[#E8E3DC] bg-[#FFFCF8] p-3">
          <p class="text-[11px] uppercase tracking-[0.16em] text-[#A18972]">Adresse</p>
          <p class="mt-1 text-sm font-semibold text-[#111111] break-all">{{ currentEmail }}</p>
        </div>
        <div class="rounded-xl border border-[#E8E3DC] bg-[#FFFCF8] p-3">
          <p class="text-[11px] uppercase tracking-[0.16em] text-[#A18972]">Plan</p>
          <p class="mt-1 text-sm font-semibold text-[#111111]">{{ currentPlan }}</p>
        </div>
        <div class="rounded-xl border border-[#E8E3DC] bg-[#FFFCF8] p-3">
          <p class="text-[11px] uppercase tracking-[0.16em] text-[#A18972]">Membre depuis</p>
          <p class="mt-1 text-sm font-semibold text-[#111111]">{{ memberSince }}</p>
        </div>
      </div>
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

    <section class="rounded-[20px] border border-[#E5E3DF] bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
      <p class="text-xs font-semibold uppercase tracking-[0.22em] text-[#E8873A]">Mot de passe</p>
      <h2 class="mt-2 text-2xl font-bold text-[#111111]">Changer le mot de passe</h2>
      <p class="mt-2 text-sm text-[#666666]">
        Mets à jour ton mot de passe immédiatement sans passer par email.
      </p>

      <form class="mt-5 grid gap-3 max-w-xl" @submit.prevent="changePassword">
        <label class="text-sm font-medium text-[#4A4A4A]" for="current-password-change">Mot de passe actuel</label>
        <input
          id="current-password-change"
          v-model="passwordForm.currentPassword"
          type="password"
          autocomplete="current-password"
          class="w-full rounded-xl border border-[#DDD7CF] bg-[#FFFCF8] px-3 py-2 text-sm text-[#111111] outline-none transition focus:border-[#E8873A]"
          placeholder="Ton mot de passe actuel"
        />

        <label class="text-sm font-medium text-[#4A4A4A]" for="new-password-change">Nouveau mot de passe</label>
        <input
          id="new-password-change"
          v-model="passwordForm.newPassword"
          type="password"
          autocomplete="new-password"
          required
          class="w-full rounded-xl border border-[#DDD7CF] bg-[#FFFCF8] px-3 py-2 text-sm text-[#111111] outline-none transition focus:border-[#E8873A]"
          placeholder="Minimum 8 caractères"
        />

        <label class="text-sm font-medium text-[#4A4A4A]" for="confirm-password-change">Confirmer le nouveau mot de passe</label>
        <input
          id="confirm-password-change"
          v-model="passwordForm.confirmPassword"
          type="password"
          autocomplete="new-password"
          required
          class="w-full rounded-xl border border-[#DDD7CF] bg-[#FFFCF8] px-3 py-2 text-sm text-[#111111] outline-none transition focus:border-[#E8873A]"
          placeholder="Répète le nouveau mot de passe"
        />

        <p v-if="passwordError" class="text-sm text-[#D24636]">{{ passwordError }}</p>
        <p v-if="passwordSuccess" class="text-sm text-[#197A4B]">{{ passwordSuccess }}</p>

        <button
          type="submit"
          class="mt-2 w-fit rounded-xl bg-[#111111] px-4 py-2 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-60"
          :disabled="passwordChangeLoading"
        >
          <span v-if="passwordChangeLoading">Mise à jour...</span>
          <span v-else>Mettre à jour le mot de passe</span>
        </button>
      </form>
    </section>

    <section class="rounded-[20px] border border-[#E5E3DF] bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
      <p class="text-xs font-semibold uppercase tracking-[0.22em] text-[#E8873A]">Session</p>
      <h2 class="mt-2 text-2xl font-bold text-[#111111]">Déconnexion</h2>
      <p class="mt-2 text-sm text-[#666666]">Ferme la session active sur ce navigateur.</p>

      <button
        type="button"
        class="mt-5 rounded-xl border border-[#D7D1C9] bg-white px-4 py-2 text-sm font-semibold text-[#111111] transition hover:bg-[#F8F4EF] disabled:opacity-60"
        :disabled="logoutLoading"
        @click="logout"
      >
        <span v-if="logoutLoading">Déconnexion...</span>
        <span v-else>Se déconnecter</span>
      </button>
    </section>

    <section class="rounded-[20px] border border-[#F1CEC7] bg-[#FFF7F5] p-6 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
      <p class="text-xs font-semibold uppercase tracking-[0.22em] text-[#C65244]">Danger zone</p>
      <h2 class="mt-2 text-2xl font-bold text-[#111111]">Supprimer le compte et toutes les données</h2>
      <p class="mt-2 text-sm text-[#7D4A44]">
        Cette action est irréversible: influenceuses, contenus générés et sessions seront supprimés.
      </p>

      <form class="mt-5 grid gap-3 max-w-xl" @submit.prevent="requestDeleteAccount">
        <label class="text-sm font-medium text-[#4A4A4A]" for="danger-confirm">Tape EXACTEMENT: {{ dangerConfirmText }}</label>
        <input
          id="danger-confirm"
          v-model="dangerForm.confirmationText"
          type="text"
          autocomplete="off"
          required
          class="w-full rounded-xl border border-[#E8C3BC] bg-white px-3 py-2 text-sm text-[#111111] outline-none transition focus:border-[#C65244]"
          :placeholder="dangerConfirmText"
        />

        <label class="text-sm font-medium text-[#4A4A4A]" for="danger-password">Mot de passe actuel</label>
        <input
          id="danger-password"
          v-model="dangerForm.password"
          type="password"
          autocomplete="current-password"
          class="w-full rounded-xl border border-[#E8C3BC] bg-white px-3 py-2 text-sm text-[#111111] outline-none transition focus:border-[#C65244]"
          placeholder="Requis si ton compte a déjà un mot de passe"
        />

        <p v-if="dangerError" class="text-sm text-[#D24636]">{{ dangerError }}</p>

        <button
          type="submit"
          class="mt-2 w-fit rounded-xl bg-[#C65244] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b7483b] disabled:opacity-60"
          :disabled="dangerLoading || showDangerConfirm"
        >
          <span v-if="dangerLoading">Suppression...</span>
          <span v-else>Supprimer définitivement mon compte</span>
        </button>
      </form>
    </section>

    <div
      v-if="showDangerConfirm"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4"
      @click.self="closeDangerConfirm"
    >
      <div class="w-full max-w-md rounded-2xl border border-[#F1CEC7] bg-white p-6 shadow-[0_20px_50px_rgba(0,0,0,0.35)]">
        <p class="text-xs font-semibold uppercase tracking-[0.22em] text-[#C65244]">Confirmation finale</p>
        <h3 class="mt-2 text-xl font-bold text-[#111111]">Supprimer ton compte maintenant ?</h3>
        <p class="mt-2 text-sm text-[#6F4A45]">
          Cette action est irréversible. Toutes les influenceuses, contenus et sessions seront supprimés.
        </p>

        <div class="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            class="rounded-xl border border-[#D7D1C9] bg-white px-4 py-2 text-sm font-semibold text-[#111111] transition hover:bg-[#F8F4EF]"
            :disabled="dangerLoading"
            @click="closeDangerConfirm"
          >
            Annuler
          </button>
          <button
            type="button"
            class="rounded-xl bg-[#C65244] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#b7483b] disabled:opacity-60"
            :disabled="dangerLoading"
            @click="confirmDeleteAccount"
          >
            <span v-if="dangerLoading">Suppression...</span>
            <span v-else>Oui, supprimer définitivement</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, reactive, ref } from 'vue';

const { user, refreshAuth } = useAuthSession();
const router = useRouter();

const loading = ref(false);
const error = ref('');
const success = ref('');
const passwordChangeLoading = ref(false);
const passwordError = ref('');
const passwordSuccess = ref('');
const logoutLoading = ref(false);
const dangerLoading = ref(false);
const dangerError = ref('');
const dangerConfirmText = 'SUPPRIMER MON COMPTE';
const showDangerConfirm = ref(false);

const form = reactive({
  newEmail: '',
  password: '',
});

const passwordForm = reactive({
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
});

const dangerForm = reactive({
  confirmationText: '',
  password: '',
});

const currentEmail = computed(() => String(user.value?.email || 'non renseigne'));
const currentPlan = computed(() => String(user.value?.plan || 'SOLO'));
const memberSince = computed(() => {
  const raw = user.value?.createdAt;
  if (!raw) return '-';

  try {
    return new Date(raw).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return '-';
  }
});

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

async function changePassword() {
  if (passwordChangeLoading.value) return;

  passwordError.value = '';
  passwordSuccess.value = '';

  if (passwordForm.newPassword !== passwordForm.confirmPassword) {
    passwordError.value = 'Les nouveaux mots de passe ne correspondent pas';
    return;
  }

  passwordChangeLoading.value = true;

  try {
    await $fetch('/api/auth/password/change', {
      method: 'POST',
      body: {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      },
    });

    passwordSuccess.value = 'Mot de passe mis à jour.';
    passwordForm.currentPassword = '';
    passwordForm.newPassword = '';
    passwordForm.confirmPassword = '';
  } catch (err) {
    passwordError.value = err?.data?.statusMessage || err?.message || 'Impossible de mettre à jour le mot de passe';
  } finally {
    passwordChangeLoading.value = false;
  }
}

function requestDeleteAccount() {
  dangerError.value = '';

  if (dangerForm.confirmationText.trim() !== dangerConfirmText) {
    dangerError.value = 'La phrase de confirmation est incorrecte';
    return;
  }

  showDangerConfirm.value = true;
}

function closeDangerConfirm() {
  if (dangerLoading.value) return;
  showDangerConfirm.value = false;
}

async function confirmDeleteAccount() {
  if (dangerLoading.value) return;

  dangerLoading.value = true;
  dangerError.value = '';

  try {
    await $fetch('/api/auth/account/delete', {
      method: 'POST',
      body: {
        confirmationText: dangerForm.confirmationText,
        password: dangerForm.password,
      },
    });

    await refreshAuth({ force: true });
    await router.push('/auth/signup');
  } catch (err) {
    dangerError.value = err?.data?.statusMessage || err?.message || 'Suppression impossible';
  } finally {
    showDangerConfirm.value = false;
    dangerLoading.value = false;
  }
}

async function logout() {
  if (logoutLoading.value) return;

  logoutLoading.value = true;

  try {
    await $fetch('/api/auth/logout', { method: 'POST' });
    await refreshAuth({ force: true });
    await router.push('/auth/login');
  } finally {
    logoutLoading.value = false;
  }
}
</script>
