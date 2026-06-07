# Lessons Learned

> Ce fichier est mis a jour apres CHAQUE correction faite par l utilisateur.
> But : ne plus refaire les memes erreurs. Relu au debut de chaque session.

---

## Format

### [DATE] Titre du probleme
**Probleme** : Description de ce qui a mal tourne.
**Cause racine** : Pourquoi c est arrive.
**Solution** : Ce qui a ete fait pour corriger.
**Regle** : La regle a suivre desormais pour eviter ce cas.

---

## Lecons

<!-- Les entrees seront ajoutees ici au fil du temps -->

### 2026-06-01 Prisma migrate dev bloque par acces reseau
**Probleme** : `npx prisma migrate dev` a echoue avec P1001 sur la base Neon configuree.
**Cause racine** : Le terminal de VS Code ne pouvait pas joindre l'hote Postgres direct expose dans l'environnement.
**Solution** : Valider le schema localement avec `npx prisma validate` et preparer le SQL de migration hors connexion en attendant un environnement avec acces DB.
**Regle** : Avant de depender de Prisma Migrate, verifier que le terminal peut atteindre le host configure par `DIRECT_URL` ou `DATABASE_URL`.

### 2026-06-01 Routes Influencer et upload
**Probleme** : Les routes CRUD et upload doivent exposer les donnees utiles sans reveiller les secrets en base.
**Cause racine** : Les selects Prisma peuvent laisser fuiter des champs sensibles si on reutilise le modele complet par habitude.
**Solution** : Exclure explicitement `instagramAccessToken` des lectures et traiter l'upload multipart avec validation du fichier et de l'`influencerId`.
**Regle** : Pour les endpoints de lecture, toujours construire un `select` minimal centré sur le contrat API.

### 2026-06-02 Recentrage produit visuel
**Probleme** : Des ecrans utilisaient encore le vocabulaire et les flux `personas` au lieu de l'experience `influencers` orientee image.
**Cause racine** : Le contexte fonctionnel initial etait trop proche d'un outil editorial texte.
**Solution** : Migrer les routes UI vers `influencers`, redefinir le wizard creation autour de l'identite visuelle et aligner la generation sur des controles scene-based.
**Regle** : Toute decision produit/UI doit prioriser la coherence visuelle des influenceuses IA (reference image + generation image) avant les usages editoriaux texte.

### 2026-06-06 Media multi-postes et stockage local
**Probleme** : Les face refs et images generees n'etaient pas visibles depuis un autre PC, avec des 404 sur l'API media et des echecs de generation.
**Cause racine** : Les fichiers media etaient stockes localement (public/storage) alors que la base etait partagee entre postes.
**Solution** : Ajouter un stockage partage Vercel Blob pour les nouveaux uploads/generations, conserver un fallback local, et gerer explicitement les medias absents dans l'UI.
**Regle** : Dans un workflow multi-machines, ne jamais compter sur un stockage disque local comme source principale; utiliser un object storage partage et stocker des URLs absolues en base.

### 2026-06-06 Compatibilite API pendant migration schema
**Probleme** : La liste des influenceuses ne s'affichait plus sans erreur visible en UI.
**Cause racine** : Les endpoints Prisma selectionnaient des colonnes nouvellement ajoutees (`bodyPrompt`/`identityProfile`) alors que la migration n'etait pas encore appliquee dans certains environnements.
**Solution** : Ajouter un fallback de requete compatible schema legacy sur erreur de colonne manquante (P2022), avec normalisation des champs optionnels.
**Regle** : Quand on introduit de nouvelles colonnes, rendre les lectures API backward-compatible jusqu'a ce que toutes les DB cibles soient migrees.

### 2026-06-07 Workflow story fragile sur dependances externes
**Probleme** : La generation story pouvait remonter un 500 generic quand l'extraction video Pinterest ou la caption Claude echouait.
**Cause racine** : Le nouveau flux dependait de plusieurs conditions externes en chaine, et un echec optionnel faisait tomber toute la generation.
**Solution** : Prioriser les vraies pistes video dans le scraper, extraire le MP4 depuis le DOM avant le JSON, et garder une caption de secours si Anthropic n'est pas disponible.
**Regle** : Pour un workflow media, ne pas rendre un sous-service optionnel bloquant si une version de secours permet de terminer la generation.

### 2026-06-07 Liste visuels image-only
**Probleme** : Les cartes contenus n'affichaient que les images, donc les stories/reels video etaient illisibles dans la grille.
**Cause racine** : Le composant UI utilisait uniquement un rendu `<img>` sur `imageUrl` sans branche media video.
**Solution** : Ajouter un rendu video lisible dans la grille et dans le modal, avec detection du format/extension.
**Regle** : Toute liste de medias doit renderer explicitement les formats video et image, et pas seulement supposer une image JPEG/PNG.

### 2026-06-07 Reel Pinterest sans visage exploitable
**Probleme** : Le workflow Reel pouvait produire une video finale sans visage utile dans la source, avec un resultat degradé.
**Cause racine** : La branche Reel ne re-scrapait pas apres une video invalide et la validation ne forçait pas explicitement un visage clairement visible.
**Solution** : Ajouter une validation visage stricte (personne + visage visible + upper body) et un retry de scraping jusqu'a 3 tentatives avant fallback Story.
**Regle** : Pour un Reel Motion Control, ne jamais accepter une source sans visage clairement visible; re-scraper avant tout fallback.

### 2026-06-07 Worker Nitro demarre trop tot
**Probleme** : La page `/influencers` pouvait casser avec `worker exited with code 0` alors que l'API de listing etait valide.
**Cause racine** : Le plugin Nitro demarrait le worker BullMQ meme quand `USE_QUEUE=false`, exposant le process local a un comportement non necessaire au rendu UI.
**Solution** : Gate explicite du lancement du worker sur `USE_QUEUE` actif uniquement.
**Regle** : Ne jamais demarrer un worker de queue par defaut dans le runtime UI; le rendre opt-in pour eviter de casser les routes SSR.

### 2026-06-07 Reel casse sur ECONNRESET reseau
**Probleme** : La generation Reel remontait un 500 generic avec `read ECONNRESET` pendant les appels Kling ou tmpfiles.
**Cause racine** : Les fetchs externes du pipeline video etaient executes sans reprise sur erreur transitoire ni timeout explicite.
**Solution** : Ajouter un wrapper de fetch avec timeout et retries sur les erreurs reseau transientes pour submit/poll/download Kling et l'upload tmpfiles.
**Regle** : Tout appel media externe critique doit gerer `ECONNRESET`/timeouts comme des pannes transitoires et non comme des erreurs fatales immediates.
