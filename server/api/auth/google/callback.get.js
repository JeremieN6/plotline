import { findOrCreateGoogleUser } from '../../../utils/accountAccess.js';
import { createAuthSession } from '../../../utils/auth.js';
import {
  GOOGLE_STATE_COOKIE,
  assertUsableProfile,
  buildRedirectUri,
  exchangeCodeForToken,
  fetchGoogleProfile,
  pickOAuthBaseUrl,
  resolveGoogleCredentials,
} from '../../../utils/googleOAuth.js';

let prismaClient;

async function getPrisma() {
  if (prismaClient) return prismaClient;

  const module = await import('../../../utils/prisma.js');
  prismaClient = module?.prisma || module?.default?.prisma;

  if (!prismaClient) {
    throw new Error('Unable to resolve prisma client from server/utils/prisma.js');
  }

  return prismaClient;
}

/**
 * L utilisateur revient ici depuis Google, dans une navigation de page: on le
 * renvoie sur l ecran de connexion avec un motif lisible plutot que de lui
 * afficher une erreur JSON brute.
 */
function redirectWithError(event, reason) {
  return sendRedirect(event, `/auth/login?error=${encodeURIComponent(reason)}`);
}

export default defineEventHandler(async (event) => {
  const runtimeConfig = useRuntimeConfig(event);
  const query = getQuery(event);

  // Google renvoie `error=access_denied` quand l utilisateur annule.
  if (query?.error) {
    return redirectWithError(event, 'Connexion Google annulee');
  }

  const expectedState = getCookie(event, GOOGLE_STATE_COOKIE);
  deleteCookie(event, GOOGLE_STATE_COOKIE, { path: '/' });

  const receivedState = String(query?.state || '');
  if (!expectedState || !receivedState || expectedState !== receivedState) {
    return redirectWithError(event, 'Requete Google invalide, reessayez');
  }

  const code = String(query?.code || '').trim();
  if (!code) {
    return redirectWithError(event, 'Code Google manquant');
  }

  const { clientId, clientSecret } = resolveGoogleCredentials(runtimeConfig);
  if (!clientId || !clientSecret) {
    return redirectWithError(event, 'Connexion Google non configuree');
  }

  try {
    const baseUrl = pickOAuthBaseUrl({
      // Derriere un proxy, sans ces options l origine vaut l adresse interne.
    requestOrigin: getRequestURL(event, { xForwardedHost: true, xForwardedProto: true }).origin,
      configuredBaseUrl: runtimeConfig.baseUrl || process.env.BASE_URL,
    });

    const accessToken = await exchangeCodeForToken({
      code,
      clientId,
      clientSecret,
      redirectUri: buildRedirectUri(baseUrl),
    });

    const profile = assertUsableProfile(await fetchGoogleProfile(accessToken));

    const prisma = await getPrisma();
    const { user } = await findOrCreateGoogleUser(prisma, profile);

    // Le parcours se termine sur la session maison: le reste de l application
    // ne fait aucune difference entre une connexion Google et un mot de passe.
    await createAuthSession(event, user.id);

    // `accountType` est nul sur un compte neuf: l onboarding se declenche seul.
    return sendRedirect(event, '/dashboard');
  } catch (error) {
    console.error('[google-oauth] Echec du parcours:', error?.message || error);
    return redirectWithError(event, error?.message || 'Connexion Google impossible');
  }
});
