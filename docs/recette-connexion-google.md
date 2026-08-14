# Recette — Connexion / inscription Google

Recette reutilisable pour ajouter « Continuer avec Google » a un projet Nuxt 3
(Nitro) qui possede **deja son propre systeme de session**.

Ecrite a partir de l'implementation faite sur Plotline, pieges compris.

---

## 1. Ce que la recette suppose

- Nuxt 3 / Nitro, routes serveur dans `server/api/`.
- Une session maison : une fonction du type `createAuthSession(event, userId)`
  qui cree la session et pose le cookie.
- Une table `User` avec un `email` unique et un `passwordHash` **nullable**.

Si `passwordHash` n'est pas nullable, le rendre nullable **avant** tout le reste :
un compte cree via Google n'a pas de mot de passe.

### Le piege principal, a lire avant de commencer

**Ne pas installer de module d'authentification tiers** (`nuxt-auth-utils` et
consorts). Ils apportent **leur propre session** dans un cookie scelle, en
parallele de la tienne. Tu te retrouves avec deux mecanismes d'authentification,
dont un seul est revocable.

L'echange OAuth fait a la main represente environ 150 lignes et **aucune
dependance**. C'est le contenu de cette recette.

---

## 2. Google Cloud Console

1. **APIs & Services → OAuth consent screen** : type *External*, nom de l'app,
   email de support, domaine du site.
2. **Credentials → Create credentials → OAuth client ID**, type *Web application*.
3. **Authorized redirect URIs** — une par environnement, au caractere pres :
   - `http://localhost:3000/api/auth/google/callback`
   - `https://mon-domaine.fr/api/auth/google/callback`
4. Recuperer le **Client ID** et le **Client secret**.

Tant que l'app est en *Testing*, seuls les comptes ajoutes en *test users*
peuvent se connecter.

> **`Erreur 400 : redirect_uri_mismatch`** est presque toujours ici : segment
> `/api` oublie, barre oblique finale en trop, ou `https` au lieu de `http` en
> local. L'URI envoyee doit correspondre **exactement**.

### Verification avant le premier essai

Ne pas deviner l'URI : afficher celle que le code enverra reellement, et la
coller telle quelle dans la console.

```bash
node -e "const b=(process.env.BASE_URL||'http://localhost:3000').trim().replace(/\/+$/,'');console.log(b+'/api/auth/google/callback')"
```

Cette seule commande evite l'aller-retour le plus frequent de toute la recette.

---

## 2 bis. Reutiliser les memes identifiants sur plusieurs projets

**Techniquement, oui.** Un meme client OAuth accepte plusieurs URI de
redirection : il suffit de toutes les declarer.

```
http://localhost:3000/api/auth/google/callback
http://localhost:3001/api/auth/google/callback
https://projet-a.fr/api/auth/google/callback
https://projet-b.fr/api/auth/google/callback
```

**Mais l'ecran de consentement est unique et porte un seul nom.** Un client
nomme « Plotline » affichera « Se connecter a **Plotline** » a quelqu'un qui
s'inscrit sur Tifo. Le logo, la politique de confidentialite et les conditions
d'utilisation sont eux aussi communs.

Trois consequences a peser :

| Point | Client partage | Un client par projet |
|---|---|---|
| Nom vu par l'utilisateur | celui du client, pour tous | celui du projet |
| Mise en production | une verification Google vaut pour tous | a refaire par projet |
| Fuite du secret | tous les projets exposes | un seul projet expose |

**Recommandation** : un **client OAuth par projet**, tous ranges dans le meme
projet Google Cloud. La creation prend deux minutes et supprime le probleme de
marque. Reserver le client partage aux cas ou les sites sont explicitement des
sous-marques d'une meme entite, et ou l'utilisateur comprend le nom affiche.

### Le piege du localhost

Les cookies **ne sont pas isoles par port**. Deux projets tournant en meme temps
sur `localhost:3000` et `localhost:3001` partagent leurs cookies : le cookie de
`state` de l'un ecrase celui de l'autre, et la connexion echoue avec
« Requete Google invalide ».

Donner un **nom de cookie propre a chaque projet** :

```js
export const GOOGLE_STATE_COOKIE = 'tifo_google_state'; // et non 'app_google_state'
```

---

## 3. Variables d'environnement

```bash
GOOGLE_OAUTH_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=xxx
BASE_URL=http://localhost:3000     # doit exister, sert a construire l'URI
```

Dans `nuxt.config.ts`, dans `runtimeConfig` — **jamais dans `public`**, le secret
ne doit pas partir dans le bundle client :

```ts
runtimeConfig: {
  baseUrl: process.env.BASE_URL,
  googleClientId: process.env.GOOGLE_OAUTH_CLIENT_ID,
  googleClientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
}
```

Ne pas oublier de les poser aussi **sur le serveur de production**.

---

## 4. Base de donnees

Une seule colonne, nullable et unique :

```sql
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "googleId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "User_googleId_key" ON "User"("googleId");
```

Cote Prisma :

```prisma
model User {
  id           String  @id @default(cuid())
  email        String  @unique
  passwordHash String?
  /// Identifiant Google (`sub`), stable meme si l'utilisateur change l'adresse
  /// de son compte Google. C'est lui qui identifie, pas l'email.
  googleId     String? @unique
}
```

> **Pourquoi `sub` et pas l'email ?** Un utilisateur peut changer l'adresse de
> son compte Google. Si tu l'identifies par email, il devient un inconnu du jour
> au lendemain, et un second compte est cree silencieusement.

---

## 5. Le code

### `server/utils/googleOAuth.js`

```js
import { randomBytes } from 'node:crypto';

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const USERINFO_ENDPOINT = 'https://openidconnect.googleapis.com/v1/userinfo';

export const GOOGLE_STATE_COOKIE = 'app_google_state';
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

/** Doit correspondre au caractere pres a l'URI declaree dans la console Google. */
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
 * Lecture du profil cote serveur avec le jeton obtenu en TLS, apres
 * authentification par le client secret. Pas besoin de verifier la signature
 * d'un id_token, donc aucune dependance JWT.
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

export function assertUsableProfile(profile) {
  if (!profile?.googleId) throw new Error('Profil Google incomplet: identifiant manquant');
  if (!profile?.email) throw new Error('Profil Google incomplet: adresse email manquante');
  if (!profile.emailVerified) throw new Error('Adresse Google non verifiee: connexion refusee');
  return profile;
}
```

### `server/api/auth/google.get.js`

```js
import {
  GOOGLE_STATE_COOKIE,
  buildGoogleAuthUrl,
  buildRedirectUri,
  createOAuthState,
  resolveGoogleCredentials,
} from '../../utils/googleOAuth.js';

export default defineEventHandler(async (event) => {
  const runtimeConfig = useRuntimeConfig(event);
  const { clientId } = resolveGoogleCredentials(runtimeConfig);

  if (!clientId) {
    return sendError(event, createError({
      statusCode: 503,
      statusMessage: 'Connexion Google non configuree',
    }));
  }

  const state = createOAuthState();

  setCookie(event, GOOGLE_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 600,
  });

  const baseUrl = runtimeConfig.baseUrl || process.env.BASE_URL || 'http://localhost:3000';

  return sendRedirect(event, buildGoogleAuthUrl({
    clientId,
    redirectUri: buildRedirectUri(baseUrl),
    state,
  }));
});
```

### `server/api/auth/google/callback.get.js`

Adapter les deux imports (`createAuthSession`, client base de donnees) au projet.

```js
import { createAuthSession } from '../../../utils/auth.js';
import { prisma } from '../../../utils/prisma.js';
import {
  GOOGLE_STATE_COOKIE,
  assertUsableProfile,
  buildRedirectUri,
  exchangeCodeForToken,
  fetchGoogleProfile,
  resolveGoogleCredentials,
} from '../../../utils/googleOAuth.js';

function redirectWithError(event, reason) {
  return sendRedirect(event, `/auth/login?error=${encodeURIComponent(reason)}`);
}

async function findOrCreateUser(profile) {
  const byGoogleId = await prisma.user.findUnique({
    where: { googleId: profile.googleId },
    select: { id: true },
  });
  if (byGoogleId) return byGoogleId;

  const byEmail = await prisma.user.findUnique({
    where: { email: profile.email },
    select: { id: true, googleId: true },
  });

  if (byEmail) {
    if (!byEmail.googleId) {
      // Rattachement d'un compte cree au mot de passe. Sur, car l'email est
      // verifie par Google (voir assertUsableProfile).
      return await prisma.user.update({
        where: { id: byEmail.id },
        data: { googleId: profile.googleId },
        select: { id: true },
      });
    }
    throw new Error('Ce compte est deja associe a un autre compte Google');
  }

  return await prisma.user.create({
    data: { email: profile.email, googleId: profile.googleId },
    select: { id: true },
  });
}

export default defineEventHandler(async (event) => {
  const runtimeConfig = useRuntimeConfig(event);
  const query = getQuery(event);

  if (query?.error) return redirectWithError(event, 'Connexion Google annulee');

  const expectedState = getCookie(event, GOOGLE_STATE_COOKIE);
  deleteCookie(event, GOOGLE_STATE_COOKIE, { path: '/' });

  const receivedState = String(query?.state || '');
  if (!expectedState || !receivedState || expectedState !== receivedState) {
    return redirectWithError(event, 'Requete Google invalide, reessayez');
  }

  const code = String(query?.code || '').trim();
  if (!code) return redirectWithError(event, 'Code Google manquant');

  const { clientId, clientSecret } = resolveGoogleCredentials(runtimeConfig);
  if (!clientId || !clientSecret) {
    return redirectWithError(event, 'Connexion Google non configuree');
  }

  try {
    const baseUrl = runtimeConfig.baseUrl || process.env.BASE_URL || 'http://localhost:3000';

    const accessToken = await exchangeCodeForToken({
      code, clientId, clientSecret, redirectUri: buildRedirectUri(baseUrl),
    });

    const profile = assertUsableProfile(await fetchGoogleProfile(accessToken));
    const user = await findOrCreateUser(profile);

    // Le parcours se termine sur la session maison: le reste de l'application
    // ne fait aucune difference entre Google et un mot de passe.
    await createAuthSession(event, user.id);

    return sendRedirect(event, '/dashboard');
  } catch (error) {
    console.error('[google-oauth]', error?.message || error);
    return redirectWithError(event, error?.message || 'Connexion Google impossible');
  }
});
```

### Le bouton (connexion et inscription)

Navigation **pleine page**, pas un `$fetch` : le parcours OAuth quitte le site.

```html
<a href="/api/auth/google" class="auth-google">Continuer avec Google</a>
```

Et afficher le motif d'echec renvoye par la redirection :

```js
const error = ref(String(route.query?.error || ''));
```

---

## 6. La decision de securite

**Que faire quand l'email Google correspond a un compte existant cree avec mot
de passe ?**

Le choix retenu ici : **rattacher automatiquement, mais uniquement si Google
declare `email_verified: true`**.

C'est la seule condition qui rend l'operation sure. Rattacher sur la seule
correspondance d'email est une **prise de controle de compte** : n'importe qui
creant un compte Google avec l'adresse d'un tiers recupererait son compte.

C'est le role de `assertUsableProfile`. Ne pas l'enlever.

---

## 7. Flux existants a verifier

- **Changement de mot de passe** : gerer `passwordHash` null sans planter.
- **Mot de passe oublie** : decider si un compte Google-only peut se definir un
  mot de passe. Utile comme depannage si Google devient inaccessible.
- **Ecran de reglages** : ne pas exiger un « mot de passe actuel » quand il n'y
  en a pas.

### Le parcours d'inscription va etre reellement exerce

C'est l'effet de bord le moins evident. Ajouter Google rend l'inscription si
rapide qu'on cree enfin des **comptes neufs**, alors que le developpement se
fait d'ordinaire sur des comptes existants.

Tout le chemin « compte vierge → onboarding → premier profil » se retrouve donc
parcouru, parfois pour la premiere fois depuis des mois. Sur Plotline, cela a
revele une page d'onboarding qui declarait `middleware: ['auth']` alors que le
projet n'a qu'un `auth.global.ts` — **un middleware global ne peut pas etre
appele par son nom**, et Nuxt levait `Unknown route middleware: 'auth'`.

Avant de livrer, parcourir soi-meme l'inscription de bout en bout avec une
adresse jamais utilisee, et emprunter **chaque** branche de l'onboarding.

---

## 8. Les quatre tests qui comptent

1. Inscription Google avec une adresse inconnue → compte cree.
2. Reconnexion du meme compte → **meme compte**, pas de doublon.
3. **Collision** : compte mot de passe existant, connexion Google avec le meme
   email → rattachement, un seul compte, contenus conserves.
4. Connexion classique email / mot de passe → toujours fonctionnelle.

Puis les rejouer en production, avec la seconde URI de redirection.

Le test 3 est celui qui decide si l'implementation est correcte.

---

## 9. Rappel des pieges

| Symptome | Cause |
|---|---|
| `Erreur 400 : redirect_uri_mismatch` | URI non identique a celle de la console (segment `/api`, barre finale, http/https) |
| Deux sessions en parallele | Un module d'auth tiers a installe la sienne |
| Doublon de compte apres changement d'email Google | Identification sur l'email au lieu de `sub` |
| Connexion Google qui echoue en production seulement | Variables d'environnement ou seconde URI absentes du serveur |
| Prise de controle de compte | Rattachement sans verifier `email_verified` |
| « Requete Google invalide » avec deux projets en local | Cookie de `state` partage entre ports : lui donner un nom par projet |
| Nom d'une autre app sur l'ecran de consentement | Client OAuth partage entre projets |
| Erreur d'onboarding jamais vue avant | Le parcours compte neuf est enfin emprunte (voir section 7) |

---

## 10. Memo de reprise

Sur un nouveau projet, dans cet ordre :

1. Rendre `passwordHash` nullable si ce n'est pas deja le cas.
2. Creer le client OAuth (un par projet, cf. section 2 bis) et declarer les URI.
3. Poser les deux variables d'environnement, en local **et** sur le serveur.
4. Passer la migration `googleId`, puis seulement apres toucher au schema.
5. Copier les trois fichiers de la section 5, en adaptant l'import de session et
   **le nom du cookie de `state`**.
6. Ajouter le bouton sur connexion et inscription.
7. Verifier l'URI avec la commande de la section 2.
8. Jouer les quatre tests de la section 8, le troisieme decide de tout.
