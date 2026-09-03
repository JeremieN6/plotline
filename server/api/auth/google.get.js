import {
  GOOGLE_STATE_COOKIE,
  buildGoogleAuthUrl,
  buildRedirectUri,
  createOAuthState,
  pickOAuthBaseUrl,
  resolveGoogleCredentials,
} from '../../utils/googleOAuth.js';

const STATE_MAX_AGE_SECONDS = 600;

/** Depart du parcours Google: pose un state anti-CSRF puis redirige. */
export default defineEventHandler(async (event) => {
  const runtimeConfig = useRuntimeConfig(event);
  const { clientId } = resolveGoogleCredentials(runtimeConfig);

  if (!clientId) {
    return sendError(event, createError({
      statusCode: 503,
      statusMessage: 'Connexion Google non configuree (GOOGLE_CLIENT_ID manquant)',
    }));
  }

  const state = createOAuthState();

  // Le state est compare au retour: sans lui, un tiers pourrait declencher une
  // connexion a son propre compte Google depuis le navigateur de la victime.
  setCookie(event, GOOGLE_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: STATE_MAX_AGE_SECONDS,
  });

  const baseUrl = pickOAuthBaseUrl({
    requestOrigin: getRequestURL(event).origin,
    configuredBaseUrl: runtimeConfig.baseUrl || process.env.BASE_URL,
  });

  return sendRedirect(event, buildGoogleAuthUrl({
    clientId,
    redirectUri: buildRedirectUri(baseUrl),
    state,
  }));
});
