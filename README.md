# Plotline

Plotline est un SaaS de gestion de personas IA pour createurs d'influenceurs IA sur Instagram et TikTok.

## Vision Produit

L'utilisateur configure un ou plusieurs personas (identite visuelle, voix, piliers de contenu, style narratif, frequence).
Le systeme genere ensuite des batchs de contenus (image + caption + hashtags) en conservant une coherence stricte de persona entre les generations.

## Differenciateur Technique: Identity Lock

La coherence visuelle est assuree par un systeme de reference visuelle fixe reinjectee a chaque generation:

- Reference personnage constante (face/reference sheet)
- Prompts structures avec contraintes fortes (same person / 1:1 match)
- Extraction de scene (Pinterest) puis reinjection du bloc personnage
- Validation des proportions avec retry automatique
- Fallback de prompt si un modele bloque en securite

## Scheduler et Orchestration

- Scheduler automatique multi-frequence par type de contenu (story/reel/feed)
- Lecture de l'historique de publication et calcul du deficit par type
- Production uniquement des contenus dus
- Content planner via Claude avec fallback deterministe en cas d'indisponibilite API

## Pipeline Pinterest

Pinterest est une source d'inspiration visuelle, pas une sortie publiee.

Workflow image:

1. Requete Pinterest
2. Collecte d'URLs
3. Filtrage humain visible
4. Extraction scene en JSON
5. Regeneration avec l'identite fixe du persona

Workflow video:

1. Scraping Pinterest
2. Extraction frame cle
3. Routage reel/story selon presence personnage
4. Generation ou edition
5. Validation humaine

## Tags

Trois familles de tags:

- Tags Pinterest image (mapping theme/location vers requetes visuelles)
- Tags Pinterest video (pools reel/story et sous-themes lifestyle/beach/outfit)
- Hashtags de publication (blocs par categorie pour captions)

Mode relevant:

- Permet de forcer un theme pour aligner la generation sur une campagne editoriale

## Architecture Produit

- Multi-persona natif (profils separes + persona actif switchable)
- Human-in-the-loop via validation Telegram (publier/supprimer)
- Orchestration multi-workflows (feed/story/reel + fallbacks)
- Publication multi-plateforme (Instagram Meta Graph API + TikTok)
- Resilience (retry scraping/generation, lock anti-concurrence, alertes Telegram, dry-run)
- Separation generation/publication
- Tracabilite (historique contenu, logs structures, analytics)

## Stack Technique

- Nuxt 3 monorepo (Vue 3 front + server routes back)
- Prisma + PostgreSQL
- BullMQ + Redis
- SDK Anthropic JS (claude-sonnet-4-6)
- Deploiement VPS Hostinger
- Domaine: plotline.sassify.fr
- Email: SMTP Hostinger via variables d'environnement

## Conventions de Travail

- Logique metier serveur dans server/utils (fonctions pures exportees)
- Endpoints API dans server/api
- Composants Vue dans components
- Ne rien anticiper: ne creer/modifier que sur instruction explicite

## Etat Technique Actuel

- Projet Nuxt initialise
- Dependances installees: @anthropic-ai/sdk, @prisma/client, prisma, bullmq, ioredis
- Prisma initialise
- Branche principale locale renommee en main

## Commandes utiles

```bash
npm install
npm run dev
npm run build
npm run preview
npx prisma validate
```
