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
**Derniere session** : 2026-08-10
**Progression globale** : 65%

### Ce qui est fait :
- [x] Socle technique: Nuxt 3, Prisma + Neon, auth complete (session, reset mot de passe, changement email)
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

### Prochaines etapes :
- [ ] Eprouver Seedance et Kling image2video sur de vraies generations
- [ ] Revoir le lien marque <-> ambassadrice (aujourd hui une ambassadrice n appartient qu a une seule marque)
- [ ] Construire le content planner avec fallback deterministe
- [ ] Ajouter mode dry-run + notifications d'erreur + logs structures

### Ecarte pour l instant :
- Publication TikTok automatique: la plateforme favorise les comptes qui postent depuis l application, une publication par API est contre-productive.
- Validation Telegram: remplacee de fait par le flux in-app PENDING -> Valider -> Publier.

---

## Blocages et Points d Attention
- Le dossier cible initial n'etait pas vide; un sous-dossier plotline etait deja initialise. Le projet actif est a la racine actuelle.
- La coherence visuelle repose sur un identity lock par reference fixe, sans seed/fine-tune.
- Ne jamais publier automatiquement sans validation humaine explicite.
- Toujours separer clairement generation et publication.
- Les migrations ne sont JAMAIS executees depuis le projet: on ecrit le SQL dans `prisma/migrations/`, et il est passe a la main via l'editeur SQL de Neon. Le port 5432 est bloque sur le reseau, la connexion passe par WebSocket (`@prisma/adapter-neon`, port 443).
- Ne jamais ajouter un champ scalaire au schema Prisma avant que la migration soit appliquee: le client selectionne toutes les colonnes du modele et toutes les lectures cassent. Voir tasks/lessons.md.
- Le workflow Pinterest est interdit aux comptes BRAND et CONTENT_CREATOR.
- Aucune generation media ne doit etre attendue dans une requete HTTP: reponse immediate en `processing`, suivi par polling.

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

---

## Notes de Session
> Ajouter ici un resume a la fin de chaque session de travail.

- 2026-05-26: Cadrage produit saisi (identity lock, scheduler, pipeline Pinterest, tags, architecture), projet Nuxt initialise, Prisma initialise, branche principale renommee en main.
- 2026-06-07: Ajout du workflow story video Pinterest, stockage local des MP4, lecture media .mp4 et publication Instagram video avec polling du container.
- 2026-06-10: Healthcheck schema corrige (cast `information_schema.column_name`), 3 jobs `PROCESSING` orphelins marques `FAILED`, fallback Gemini durci avec retries transitoires et sanitisation plus large.
- 2026-07-01: Refond du back office avec shell global sidebar, dashboard bento, calendrier mensuel, vue contenu 3 colonnes, hook de notifications jobs actifs et routes schedule/active.
- 2026-07-30: Ajout du lien explicite `campaignId` sur les contenus, filtres campagne sur dashboard/contenu, suppression de campagne avec detachement des contenus, et panneau ambassadrice repliable dans le Studio.
- 2026-08-10: Sprints historique + carrousel + fiabilisation video. Historique des versions avec retour arriere sans perte de media, correction de la regeneration destructive, nettoyage des medias a la suppression. Regroupement des slides de carrousel avec navigation et modification isolee. Format decide par le prompt au lieu d'un 9:16 en dur. Seedance rebranche sur la vraie API seevio (tache asynchrone, image de depart par URL Blob). Les trois fournisseurs video passent en tache de fond: Kling bloquait la requete HTTP jusqu'a 15 minutes. Rapatriement ponctuel de 6 medias vers le Blob et script de nettoyage des orphelins. Colonne morte `GeneratedContent.generationModel` supprimee par migration.

---

## Lecons Apprises
> Voir tasks/lessons.md pour le detail des corrections et patterns a eviter.

- Respect strict de la consigne utilisateur: ne rien creer hors instruction explicite.
