# Todo -- Taches en cours

> Mis a jour au fil des sessions. Cocher les items termines.

---

## En cours
- [x] Corriger le middleware auth pour laisser passer forgot/reset/confirmation email
- [ ] Verifier sur VPS que la migration tokens auth est appliquee a la base active
- [x] Ajouter un systeme auth complet (signup/login/session cookie)
- [x] Proteger les routes back-office via middleware Nuxt (redirect vers /auth/login)
- [x] Ajouter pages Auth avec nouvelle DA (connexion + inscription)
- [x] Brancher les API serveur sur l utilisateur de session (retirer user-test hardcode)
- [x] Afficher onboarding modal si aucun influenceur pour l utilisateur connecte
- [x] Harmoniser la DA de l onboarding modal avec la refonte back-office
- [ ] Verifier le flux complet (non connecte -> login -> dashboard vide -> modal creation)
- [x] Ajouter reset mot de passe par email (API + ecrans forgot/reset + template mail)
- [x] Ajouter changement d'email avec confirmation par lien (API + ecran settings)
- [ ] Appliquer la migration Prisma tokens auth sur la base Neon active
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
- [x] Ajouter la campagne sur les contenus generes, le filtrage dashboard/contenu et la suppression safe de campagne
- [x] Replier le bloc ambassadrice du Studio dans un panneau repliable ouvert par defaut
- [x] Faire sortir les generations en PENDING (en attente -> valider -> publier)
- [x] Ajouter "Modifier" pour regenerer un contenu depuis un prompt edite (BRAND + CONTENT_CREATOR)
- [x] Renommer les routes /influencers -> /profiles et le modele Prisma Influencer -> Profile
- [x] Ajouter l'historique des versions avec retour arriere sans perte de media (5 images / 2 videos)
- [x] Corriger la regeneration destructive qui ecrasait le rendu precedent
- [x] Nettoyer les medias d'un contenu supprime
- [x] Regrouper les slides d'un carrousel (carouselId + position) avec navigation dans la visionneuse
- [x] Faire decider le format par le prompt au lieu d'un 9:16 en dur
- [x] Rebrancher Seedance sur la vraie API seevio (tache asynchrone + image de depart par URL)
- [x] Basculer les trois fournisseurs video en tache de fond (Kling bloquait la requete HTTP)
- [x] Ajouter un script de nettoyage des medias orphelins (dry-run par defaut)
- [ ] Passer la migration 20260810140000 (drop de la colonne morte GeneratedContent.generationModel)
- [ ] Eprouver Seedance sur une vraie generation (format de requete valide par les tests uniquement)
- [ ] Eprouver Kling image2video sur une vraie generation (jamais execute)

## Fait
- [x] Initialisation MCP memoire + structure projet
- [x] Correction des routes Nuxt (deplacement de pages vers app/pages)
- [x] Migration routes personas -> influencers + wizard IA visuel + generation image UI
- [x] Ajouter le workflow story video Pinterest + publication Instagram video
