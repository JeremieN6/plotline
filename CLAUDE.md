# CLAUDE.md -- Memoire Projet

> Ce fichier est lu automatiquement par l'IA au debut de chaque conversation.
> Mets-le a jour a la fin de chaque session de travail.

---

## Objectif Final
Construire Plotline, un SaaS de gestion de personas IA pour createurs d'influenceurs IA sur Instagram et TikTok.

Le produit permet de configurer un ou plusieurs personas (identite visuelle, voix, piliers de contenu, style narratif, frequence de publication) puis de generer automatiquement des batchs de contenus coherents (image + caption + hashtags), avec validation humaine avant publication.

---

## Stack Technique
- Nuxt 3 monorepo (Vue 3 front + server routes back)
- Prisma + PostgreSQL
- BullMQ + Redis
- SDK Anthropic JS (claude-sonnet-4-6)
- Deploy VPS Hostinger
- Domaine cible: plotline.sassify.fr
- Email: SMTP Hostinger via variables d'environnement

---

## Conventions IA et Code
- Toute la logique serveur vit dans server/utils et server/api.
- Les utilitaires dans server/utils sont des fonctions pures exportees.
- Le format de sortie de Claude est toujours du JSON brut, sans markdown.

---

## Etat Actuel du Projet
**Phase** : Produit fonctionnel en production, consolidation du pipeline de generation
**Derniere session** : 2026-09-03
**Progression globale** : 72%

### Ce qui est fait :
- [x] Socle technique: Nuxt 3, Prisma + Neon, auth complete (session, reset mot de passe, changement email)
- [x] Connexion et inscription via Google OAuth (echange fait a la main, sans module tiers ; recette complete dans `docs/recette-connexion-google.md`)
- [x] Multi-profils avec trois types de compte: INFLUENCER_CREATOR, CONTENT_CREATOR, BRAND
- [x] Identity lock: face ref 3 panneaux, prompts corps/cheveux verrouillables
- [x] Generation image (Gemini) et video (Veo, Kling, Seedance) avec selection de modele
- [x] Stockage partage Vercel Blob pour tous les medias, avec repli local
- [x] Flux editorial: PROCESSING -> PENDING -> VALIDATED -> PUBLISHED
- [x] Historique des versions avec retour arriere sans perte de media (5 images / 2 videos)
- [x] Carrousels: slides regroupees, navigation, modification isolee d'une slide
- [x] Format decide par le prompt, arbitrage seulement quand le prompt ne dit rien
- [x] Campagnes, dashboard bento, calendrier mensuel, Studio
- [x] Publication Instagram (Meta Graph API) et X/Twitter
- [x] Script de nettoyage des medias orphelins (dry-run par defaut)
- [x] Publication automatique des contenus a leur date planifiee (opt-in via `SCHEDULER_ENABLED`)
- [x] Lien marque <-> ambassadrice en plusieurs-a-plusieurs (table `BrandAmbassador`), rattachement editable depuis la fiche du profil
- [x] Planificateur editorial: cadence par profil, idees redigees par Claude avec repli deterministe, revue avant generation

### Prochaines etapes :
- [ ] Eprouver Kling image2video sur une vraie generation
- [ ] Ecran de reglage de la cadence et liste des plans passes
- [ ] Ajouter mode dry-run + notifications d'erreur + logs structures

### Ecarte pour l instant :
- Seedance: credits prepayes epuises et generation jamais aboutie. Hors service via `SEEDANCE_ENABLED`, code conserve. Veo et Kling suffisent.
- Publication TikTok automatique: la plateforme favorise les comptes qui postent depuis l application, une publication par API est contre-productive.
- Validation Telegram: remplacee de fait par le flux in-app PENDING -> Valider -> Publier.

---

## Blocages et Points d Attention
- Le dossier cible initial n'etait pas vide; un sous-dossier plotline etait deja initialise. Le projet actif est a la racine actuelle.
- La coherence visuelle repose sur un identity lock par reference fixe, sans seed/fine-tune.
- Aucune publication automatique sans validation humaine explicite. C est une regle d etape, pas un principe definitif: l automatisation pourra etre ouverte plus tard, mais uniquement sur decision explicite du proprietaire du produit, apres un volume de publications manuelles jugees majoritairement de qualite. Aucun seuil automatique, aucune proposition du produit, et aucun agent ne leve cette regle de sa propre initiative. Elle est appliquee dans le code par `scheduledPublisher`, qui ne publie que les contenus VALIDATED.
- Toujours separer clairement generation et publication.
- Les migrations ne sont JAMAIS executees depuis le projet: on ecrit le SQL dans `prisma/migrations/`, et il est passe a la main via l'editeur SQL de Neon. Le port 5432 est bloque sur le reseau, la connexion passe par WebSocket (`@prisma/adapter-neon`, port 443).
- Ne jamais ajouter un champ scalaire au schema Prisma avant que la migration soit appliquee: le client selectionne toutes les colonnes du modele et toutes les lectures cassent. Voir tasks/lessons.md.
- Le workflow Pinterest est interdit aux comptes BRAND et CONTENT_CREATOR.
- Un compte INFLUENCER_CREATOR se lit comme une agence d influenceurs virtuels: beaucoup d influenceurs, peu de marques.
- Le rattachement marque <-> ambassadrice est volontairement limite a un seul compte. On ne relie jamais deux profils de comptes differents.
- Aucune generation media ne doit etre attendue dans une requete HTTP: reponse immediate en `processing`, suivi par polling.
- Les binaires ffmpeg/ffprobe sont resolus a l EXECUTION (`server/utils/ffmpegBinaries.js`), jamais importes statiquement: npm bloque les scripts d installation, et un import statique faisait echouer tout le build sur le serveur. Ordre de resolution: `FFMPEG_PATH`/`FFPROBE_PATH`, puis le paquet npm, puis le binaire systeme. ffmpeg ne sert qu au workflow Reel Pinterest.
- Le cookie de `state` OAuth Google (`GOOGLE_STATE_COOKIE`) n'est pas isole par port: deux projets Nuxt en local sur des ports differents partagent leurs cookies et se font ecraser leur `state` mutuellement. Voir `docs/recette-connexion-google.md` avant de reactiver du dev local en parallele d'un autre projet ayant aussi du Google OAuth.
- L URI de redirection Google (`server/utils/googleOAuth.js`, `pickOAuthBaseUrl`) doit toujours faire primer `BASE_URL` sur l origine de la requete: derriere le reverse proxy du VPS, lire l origine sans `xForwardedHost`/`xForwardedProto` renvoie l adresse interne du serveur, que Google refuse (`redirect_uri_mismatch`). Ne pas re-inverser cette priorite sans relire tasks/lessons.md (2026-09-03, deja fait une fois par erreur).

---

## Decisions Prises
| Date | Decision | Raison |
|------|----------|--------|
| 2026-05-26 | Utiliser un systeme d'identity lock (reference visuelle fixe + prompts contraints) | Garantir une coherence persona stricte sur tous les contenus |
| 2026-05-26 | Pinterest est une source d'inspiration, jamais une sortie publiee | Maitriser la cohérence et reduire le risque legal/editorial |
| 2026-05-26 | Multi-persona natif avec persona actif switchable | Permettre la gestion de plusieurs identites dans un meme SaaS |
| 2026-05-26 | Human-in-the-loop obligatoire via validation Telegram | Garder un controle editorial avant publication |
| 2026-05-26 | Separation generation/publication | Resilience operationnelle et ouverture future a des roles (editeur/client/approbateur) |
| 2026-05-26 | Conventions serveur: logique metier dans server/utils, endpoints dans server/api | Maintenir un codebase clair et testable |
| 2026-08-08 | L etat courant reste sur GeneratedContent, l historique vit dans ContentVersion | Ne pas toucher au code de publication et de listing pour ajouter le retour arriere |
| 2026-08-08 | Un media n est supprime que s il n est reference ni par le rendu courant ni par une autre version | Le retour arriere copie l URL a deux endroits: purger sans verifier casserait le contenu actif |
| 2026-08-09 | Le format d image/video est decide par le prompt; le repli 9:16 ne s applique que si le prompt est muet | Ne jamais imposer un cadrage a la place de l auteur |
| 2026-08-09 | Une slide de carrousel reste un contenu autonome, regroupe par carouselId | Permettre de modifier une seule slide sans regenerer les autres |
| 2026-08-10 | Aucun appel de generation media n est attendu dans une requete HTTP | Les fournisseurs prennent plusieurs minutes: la requete serait coupee par le proxy avant la fin |
| 2026-08-10 | Le workflow Pinterest est reserve aux comptes influenceur | Il n a pas de sens editorial pour une marque ou un createur de contenu |
| 2026-08-10 | Une ambassadrice peut representer plusieurs marques (table BrandAmbassador) | C est la realite du metier, et une ambassadrice est un actif coûteux qu on ne veut pas recreer par marque |
| 2026-08-10 | Le type de profil est ecrit en base au lieu d etre devine depuis la face ref | L inference cassait silencieusement des qu une marque aurait eu une face ref |
| 2026-08-10 | Un plan editorial est relu avant que le moindre media soit produit | Valider un texte coute une requete Claude, valider apres generation coute autant de videos que d idees |
| 2026-08-10 | La cadence est deterministe, Claude n ecrit que le texte des idees | Le rythme doit rester previsible meme quand l IA est indisponible |
| 2026-08-14 | OAuth Google implemente a la main (~150 lignes, aucune dependance) plutot qu avec un module tiers (nuxt-auth-utils et consorts) | Un module tiers installe sa propre session en parallele de celle du projet: deux mecanismes d authentification, dont un seul est revocable |
| 2026-08-14 | Rattachement automatique d un compte Google a un compte mot de passe existant, uniquement si Google declare `email_verified: true` | Rattacher sur la seule correspondance d email est une prise de controle de compte: n importe qui creant un compte Google avec l adresse d un tiers recupererait son compte |
| 2026-08-14 | Identification de l utilisateur Google par `sub` (googleId), jamais par l email | Un utilisateur peut changer l adresse de son compte Google; l identifier par email le rendrait inconnu du jour au lendemain et creerait un doublon silencieux |
| 2026-09-03 | La validation humaine avant publication est une regle d etape, pas un principe definitif | L automatisation sera ouverte quand le proprietaire du produit le decidera, apres assez de publications manuelles jugees majoritairement de qualite; ni seuil automatique, ni proposition du produit |

---

## Notes de Session
> Ajouter ici un resume a la fin de chaque session de travail.

- 2026-05-26: Cadrage produit saisi (identity lock, scheduler, pipeline Pinterest, tags, architecture), projet Nuxt initialise, Prisma initialise, branche principale renommee en main.
- 2026-06-07: Ajout du workflow story video Pinterest, stockage local des MP4, lecture media .mp4 et publication Instagram video avec polling du container.
- 2026-06-10: Healthcheck schema corrige (cast `information_schema.column_name`), 3 jobs `PROCESSING` orphelins marques `FAILED`, fallback Gemini durci avec retries transitoires et sanitisation plus large.
- 2026-07-01: Refond du back office avec shell global sidebar, dashboard bento, calendrier mensuel, vue contenu 3 colonnes, hook de notifications jobs actifs et routes schedule/active.
- 2026-07-30: Ajout du lien explicite `campaignId` sur les contenus, filtres campagne sur dashboard/contenu, suppression de campagne avec detachement des contenus, et panneau ambassadrice repliable dans le Studio.
- 2026-08-10: Sprints historique + carrousel + fiabilisation video. Historique des versions avec retour arriere sans perte de media, correction de la regeneration destructive, nettoyage des medias a la suppression. Regroupement des slides de carrousel avec navigation et modification isolee. Format decide par le prompt au lieu d'un 9:16 en dur. Seedance rebranche sur la vraie API seevio (tache asynchrone, image de depart par URL Blob). Les trois fournisseurs video passent en tache de fond: Kling bloquait la requete HTTP jusqu'a 15 minutes. Rapatriement ponctuel de 6 medias vers le Blob et script de nettoyage des orphelins. Colonne morte `GeneratedContent.generationModel` supprimee par migration.
- 2026-08-11 / 08-12: Fiabilisation du planificateur et du stockage. Les modifications d une idee sont desormais enregistrees avant de lancer la generation: une scene reecrite puis envoyee directement partait avec l ancien texte et brulait des credits pour un contenu abandonne. Correction d une recidive du bug de stockage local: la route d upload de face ref avait deux branches, celle du pipeline de generation ecrivait toujours sur le disque sans consulter le Blob, rendant la face ref introuvable depuis tout autre environnement. Script `scripts/migrate-face-refs-to-blob.cjs` ajoute pour rapatrier l existant.
- 2026-08-14: Connexion et inscription Google ajoutees (echange OAuth a la main, `googleId` nullable/unique sur `User`, rattachement automatique si `email_verified`). Documentation complete ecrite en recette reutilisable (`docs/recette-connexion-google.md`) pour reappliquer le meme flux sur un autre projet: pieges de la console Google, du cookie `state` partage entre ports en local, et effet de bord du parcours d'inscription enfin exerce. Correction d'une page d'onboarding qui referencait un middleware nomme `auth` inexistant (le seul middleware du projet est global, `auth.global.ts`, non appelable par son nom) — la protection etait deja assuree par le middleware global, la ligne fautive a simplement ete retiree.
- 2026-09-03: Connexion Google eprouvee en production. Correction de la construction de l URI de redirection, qui partait de `BASE_URL` avec un repli silencieux sur localhost: la variable etant absente du VPS, la production renvoyait les utilisateurs vers leur propre machine (`ERR_CONNECTION_REFUSED`), en laissant croire a une mauvaise configuration Google. Premiere correction: l origine de la requete prime sur `BASE_URL`. Modale d onboarding conditionnee au chargement effectif de la liste des profils: elle s ouvrait sur un compte pourtant pourvu de trois profils. Toast de bienvenue supprime avec son composable. Arret du worker BullMQ sur erreur definitive, apres une inondation de logs due au quota Redis epuise.
- 2026-09-03 (suite): Deux deploiements echoues ont laisse la production hors service. Le workflow supprimait `.output` AVANT de construire: un build rate detruisait donc la version en ligne au lieu de la laisser intacte. Le build est desormais realise a cote, l ancienne sortie n est supprimee qu apres succes et restauree en cas d echec, et `git fetch` est retente trois fois (une limitation ponctuelle de GitHub avait fait rater un deploiement). Cause du build rate lui-meme: npm bloque les scripts d installation non autorises, donc le binaire de `ffmpeg-static` n etait plus telecharge, et Nitro echoue en le tracant.
- 2026-09-03 (re-suite): la premiere correction Google du jour a provoque une recidive, `redirect_uri_mismatch` cette fois: derriere le reverse proxy du VPS, l origine de requete sans en-tetes forwarded vaut l adresse interne du serveur, pas `plotline.sassify.fr`. `BASE_URL` (deja posee sur le VPS) refait foi en priorite, l origine de requete n est plus qu un repli lisant desormais `X-Forwarded-Host`/`X-Forwarded-Proto`. Un log trace l URI de redirection envoyee pour rendre tout futur mismatch immediat a diagnostiquer. Un helper `isHttpUrl()` reference mais efface lors d une edition precedente a ete restaure au passage.

---

## Lecons Apprises
> Voir tasks/lessons.md pour le detail des corrections et patterns a eviter.

- Respect strict de la consigne utilisateur: ne rien creer hors instruction explicite.

---

## Regle de memoire narrative
Apres toute session impliquant une decision business, un pivot, un changement de statut, ou un apprentissage terrain significatif (pas les changements purement techniques), mettre a jour /STORY.md en consequence, en plus des notes de session habituelles.
