import { randomBytes } from 'node:crypto';

/**
 * Echange OAuth avec Google, ecrit a la main.
 *
 * Volontairement sans module d authentification tiers: ceux-ci apportent leur
 * propre session, alors que Plotline en a deja une (table AuthSession, jeton
 * hache, revocable). Ici on ne fait que l echange, et c est `createAuthSession`
 * qui conclut, exactement comme une connexion par mot de passe.
 */

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const USERINFO_ENDPOINT = 'https://openidconnect.googleapis.com/v1/userinfo';

export const GOOGLE_STATE_COOKIE = 'plotline_google_state';
export const GOOGLE_SCOPES = 'openid email profile';

export function createOAuthState() {
  return randomBytes(24).toString('hex');
}

export function resolveGoogleCredentials(runtimeConfig = {}) {
  return {
    clientId: String(runtimeConfig.googleClientId || process.env.GOOGLE_OAUTH_CLIENT_ID || '').trim(),
    clientSecret: String(runtimeConfig.googleClientSecret || process.env.GOOGLE_OAUTH_CLIENT_SECRET || '').trim(),
  };
}

/**
 * L URI de redirection doit correspondre au caractere pres a celle declaree
 * dans la console Google, sinon Google refuse l echange avec `redirect_uri_mismatch`.
 */
export function buildRedirectUri(baseUrl) {
  const cleaned = String(baseUrl || '').trim().replace(/\/+$/, '');
  return `${cleaned}/api/auth/google/callback`;
}

export function buildGoogleAuthUrl({ clientId, redirectUri, state }) {
  const url = new URL(AUTH_ENDPOINT);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', GOOGLE_SCOPES);
  url.searchParams.set('state', state);
  // Force le choix du compte plutot que de reconnecter silencieusement le
  // dernier utilise: sur un poste partage, c est le comportement attendu.
  url.searchParams.set('prompt', 'select_account');
  return url.toString();
}

export async function exchangeCodeForToken({ code, clientId, clientSecret, redirectUri }) {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const detail = payload?.error_description || payload?.error || `HTTP ${response.status}`;
    throw new Error(`Echange du code Google refuse: ${detail}`);
  }

  const accessToken = String(payload?.access_token || '').trim();
  if (!accessToken) {
    throw new Error('Google n a pas renvoye de jeton d acces');
  }

  return accessToken;
}

/**
 * Le profil est lu cote serveur avec le jeton qu on vient d obtenir en TLS,
 * apres nous etre authentifies avec le client secret. Pas besoin de verifier
 * la signature d un id_token, donc pas de dependance JWT supplementaire.
 */
export async function fetchGoogleProfile(accessToken) {
  const response = await fetch(USERINFO_ENDPOINT, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Lecture du profil Google impossible (HTTP ${response.status})`);
  }

  return normalizeGoogleProfile(await response.json().catch(() => ({})));
}

export function normalizeGoogleProfile(payload) {
  return {
    googleId: String(payload?.sub || '').trim(),
    email: String(payload?.email || '').trim().toLowerCase(),
    // Google renvoie parfois la chaine "true" au lieu du booleen.
    emailVerified: payload?.email_verified === true || payload?.email_verified === 'true',
    name: String(payload?.name || '').trim(),
  };
}

/**
 * Un profil sans `sub`, sans email, ou dont l email n est pas verifie par Google
 * ne permet aucun rattachement sur: rattacher un compte existant sur la foi d un
 * email non verifie ouvrirait une prise de controle de compte.
 */
export function assertUsableProfile(profile) {
  if (!profile?.googleId) {
    throw new Error('Profil Google incomplet: identifiant manquant');
  }

  if (!profile?.email) {
    throw new Error('Profil Google incomplet: adresse email manquante');
  }

  if (!profile.emailVerified) {
    throw new Error('Adresse Google non verifiee: connexion refusee');
  }

  return profile;
}
