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

## Etat Actuel du Projet
**Phase** : Cadrage produit + initialisation technique
**Derniere session** : 2026-05-26
**Progression globale** : 8%

### Ce qui est fait :
- [x] Configuration MCP memoire
- [x] Initialisation projet Nuxt
- [x] Installation dependances: @anthropic-ai/sdk, @prisma/client, prisma, bullmq, ioredis
- [x] Initialisation Prisma
- [x] Renommage branche principale locale vers main
- [x] Verification remote: origin/master absent

### Prochaines etapes :
- [ ] Definir le schema Prisma multi-persona (persona, references, tags, historique, jobs)
- [ ] Mettre en place BullMQ/Redis avec lock anti-concurrence et retry policies
- [ ] Implementer le scheduler multi-frequence (story/reel/feed)
- [ ] Construire le content planner avec fallback deterministe
- [ ] Poser le pipeline Pinterest image/video avec extraction scene et routage
- [ ] Integrer la queue de validation Telegram (publish/delete)
- [ ] Integrer publication Instagram (Meta Graph API) et TikTok
- [ ] Ajouter mode dry-run + notifications d'erreur Telegram + logs structures

---

## Blocages et Points d Attention
- Le dossier cible initial n'etait pas vide; un sous-dossier plotline etait deja initialise. Le projet actif est a la racine actuelle.
- La coherence visuelle repose sur un identity lock par reference fixe, sans seed/fine-tune.
- Ne jamais publier automatiquement sans validation humaine explicite.
- Toujours separer clairement generation et publication.

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

---

## Notes de Session
> Ajouter ici un resume a la fin de chaque session de travail.

- 2026-05-26: Cadrage produit saisi (identity lock, scheduler, pipeline Pinterest, tags, architecture), projet Nuxt initialise, Prisma initialise, branche principale renommee en main.

---

## Lecons Apprises
> Voir tasks/lessons.md pour le detail des corrections et patterns a eviter.

- Respect strict de la consigne utilisateur: ne rien creer hors instruction explicite.
