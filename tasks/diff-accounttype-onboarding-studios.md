# Diff cible - AccountType, Onboarding, Studios, Video API

## Prisma
- Ajout enum `AccountType` et champ `User.accountType` dans `prisma/schema.prisma`.
- Migration SQL ajoutee dans `prisma/migrations/20260728103000_add_account_type_to_user/migration.sql`.
- Backfill utilisateurs existants vers `INFLUENCER_CREATOR`.

## Auth + Routing
- `server/utils/auth.js`: ajout `accountType` au select de session.
- `server/api/auth/login.post.js` et `server/api/auth/signup.post.js`: `accountType` renvoye au frontend.
- `app/middleware/auth.global.ts`: routing conditionnel post-login par `accountType` + gate onboarding.
- Nouveau helper: `app/composables/useAccountRouting.js`.

## API Account Type
- Nouveau endpoint `server/api/user/account-type.patch.js`.
- Validation stricte de `accountType` et update du user connecte.
- Nouveau helper `server/utils/accountType.js` pour centraliser la validation.

## Onboarding
- `app/pages/onboarding/index.vue`: selection du type de compte et persist via API.
- `app/pages/onboarding/influencer-creator.vue`: redirect vers `/influencers/new`.
- `app/pages/onboarding/content-creator.vue`: wizard 3 etapes + creation d ambassadrice optionnelle.
- `app/pages/onboarding/brand.vue`: wizard 4 etapes + ambassadrice obligatoire.
- `app/app.vue`: shell desactive sur routes onboarding.

## Studios
- `app/pages/studio/index.vue`: interface CONTENT_CREATOR (image/video).
- `app/pages/brand-studio/index.vue`: interface BRAND (image uniquement).

## Video API
- Nouveau endpoint `server/api/generate/video.post.js`.
- Selection auto du modele:
  - dynamique/action -> Kling
  - cinematique/paysage/ambiance/slow -> Veo
  - defaut -> Seedance
- Retour `{ model, jobId, contentId, status }`.
- Gestion des erreurs avec marquage `FAILED` du contenu.
- `nuxt.config.ts`: ajout `seedanceApiKey` et `veoApiKey` en runtimeConfig.
- `.env` et `.env.local`: ajout `SEEDANCE_API_KEY` et `VEO_API_KEY`.
- `server/utils/klingGenerator.js`: ajout d un flux texte-vers-video reutilisable.
- Nouveau helper `server/utils/videoModelSelector.js` pour la selection modele.

## Wording + Navigation conditionnelle
- Nouveau composable `app/composables/useWording.js`.
- `app/components/layout/PlotlineShell.vue`: navigation conditionnelle selon accountType + labels dynamiques.
- Ajustements wording dans `app/pages/content.vue`, `app/pages/dashboard.vue`, `app/pages/settings.vue`, `app/pages/influencers/index.vue`, `app/composables/useJobNotifications.js`.

## Tests ajoutes
- Nouveau test Node natif: `tests/account-type-and-video-model.test.mjs`.
- Nouveau script npm: `npm run test`.
