# Todo -- Taches en cours

> Mis a jour au fil des sessions. Cocher les items termines.

---

## En cours
- [x] Durcir le scraper Pinterest image contre les pins sans visage
- [x] Verifier la validation Gemini du scraper sur le flux Node
- [x] Basculer la logique body sur fallback global + override par influenceuse
- [x] Ajouter body prompt editable par influenceuse
- [x] Ajouter upload body ref par influenceuse
- [x] Injecter bodyPrompt/bodyRef dans le pipeline de generation
- [x] Ajouter validation image: person detection + upper-body validation avec retry
- [x] Ajouter analyse auto des cheveux depuis la face ref
- [x] Ajouter lock/unlock des cheveux par influenceuse
- [x] Porter le workflow Reel Pinterest + Kling Motion Control en Nuxt
- [x] Ajouter les utilitaires video ffmpeg (frame extractor + Kling client)
- [x] Valider le pipeline Reel en build local
- [x] Durcir les fetch Kling/tmpfiles contre les resets reseau
- [x] Renforcer l'injection body/hair auto pour eviter les derives de generation
- [x] Rebaser le fallback body sur les mensurations Madison sans dependre de Gemini
- [x] Retirer l'upload body ref de la config influenceuse
- [x] Nettoyer le JSON scene des indices corporels source avant injection
- [x] Supprimer le backend body ref residuel et preparer la migration schema
- [x] Ajouter un check runtime de drift schema Prisma/Neon
- [x] Ajouter un endpoint de diagnostic pipeline feed/story/reel
- [ ] Valider en execution reelle avec un run de generation
- [x] Poser le shell global avec sidebar et navigation
- [x] Refonte dashboard, contenu, calendrier et generation
- [x] Ajouter la notification de jobs actifs et les routes schedule/active
- [x] Verifier les routes, types et contrats API touches

## Fait
- [x] Initialisation MCP memoire + structure projet
- [x] Correction des routes Nuxt (deplacement de pages vers app/pages)
- [x] Migration routes personas -> influencers + wizard IA visuel + generation image UI
- [x] Ajouter le workflow story video Pinterest + publication Instagram video
