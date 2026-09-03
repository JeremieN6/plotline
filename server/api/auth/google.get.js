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
    // Derriere un proxy, sans ces options l origine vaut l adresse interne.
    requestOrigin: getRequestURL(event, { xForwardedHost: true, xForwardedProto: true }).origin,
    configuredBaseUrl: runtimeConfig.baseUrl || process.env.BASE_URL,
  });

  const redirectUri = buildRedirectUri(baseUrl);

  // Trace l URI exacte envoyee a Google: `redirect_uri_mismatch` ne dit jamais
  // ce qui a ete demande, et c est la seule information qui permet de comparer
  // avec ce qui est declare dans la console.
  console.log(`[google-oauth] redirect_uri envoye: ${redirectUri}`);

  return sendRedirect(event, buildGoogleAuthUrl({
    clientId,
    redirectUri,
    state,
  }));
});
