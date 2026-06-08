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

### 2026-06-08 Gemini image preview renvoie IMAGE_OTHER sans parts
**Probleme** : La generation d'image pouvait echouer avec `Gemini returned no parts` et `finishReason=IMAGE_OTHER`, meme sans blocage safety explicite.
**Cause racine** : Le pipeline ne gerait qu'un fallback sur `IMAGE_SAFETY`; tout retour zero-part `IMAGE_OTHER` etait traite comme une erreur fatale immediate.
**Solution** : Introduire un type d'erreur dedie pour les reponses sans image, refaire une tentative sur `IMAGE_OTHER`, puis appliquer le prompt sanitize si le no-parts persiste.
**Regle** : Pour Gemini image preview, tout retour zero-part retryable doit avoir un retry cible avant de remonter une erreur fatale.

### 2026-06-08 Scraper Pinterest image sans filtre visage
**Probleme** : Le flux image Pinterest pouvait selectionner une image source sans visage visible, ce qui degradait la generation en aval.
**Cause racine** : `scrapePinterestImage` validait seulement le telechargement et la taille du buffer, sans appeler les verifications Gemini deja presentes dans le projet.
**Solution** : Brancher `detectPersonInImage` puis `detectFaceVisible` directement dans le scraper avant de conserver une image Pinterest.
**Regle** : Toute image source Pinterest doit passer une validation explicite personne + visage visible avant d'entrer dans le pipeline.

### 2026-06-08 Blocage Gemini IMAGE_SAFETY sur generation image
**Probleme** : La generation Pinterest feed echouait avec `finishReason=IMAGE_SAFETY` et remontait un 500 generique, ce qui ralentissait le diagnostic.
**Cause racine** : Le pipeline traitait `Gemini returned no parts` comme erreur technique sans fallback de sanitisation ni statut metier explicite.
**Solution** : Ajouter une detection `IMAGE_SAFETY`, appliquer une sanitisation de prompt puis retenter automatiquement, et renvoyer `422` avec message explicite si le blocage persiste.
**Regle** : Tout refus safety modele doit avoir un fallback controle + un statut metier explicite (pas un 500 generique).

### 2026-06-08 Cohérence cheveux issue de la face ref
**Probleme** : La coupe de cheveux derivait parfois de l'image de reference et sortait plus longue que la reference visuelle.
**Cause racine** : La face ref alimentait Gemini, mais la longueur/coupe des cheveux n'etait pas isolee comme attribut d'identite persistant.
**Solution** : Extraire automatiquement un hair prompt depuis la face ref avec Gemini vision, le stocker avec un verrou editable, puis l'injecter dans le prompt de generation.
**Regle** : Quand un attribut visuel doit rester coherent entre generations, il faut le deriver depuis la reference visuelle puis le persister comme contrainte explicite avec un mode lock/unlock.

### 2026-06-08 Vue contenus en mode validated-only
**Probleme** : La page liste affichait des statuts de brouillon / erreur / traitement, alors que le comportement attendu etait de ne montrer que les contenus valides, comme avant.
**Cause racine** : La vue avait ete elargie trop loin en reactualisant les statuts visibles, au lieu de corriger uniquement le statut de sortie de la generation reussie.
**Solution** : Revenir a une liste `VALIDATED` + `PUBLISHED` et faire sortir les generations reussies en `VALIDATED`.
**Regle** : Quand une vue de liste doit rester propre, ne pas exposer les statuts techniques dans l'UI; aligner le statut de sortie sur le filtre visible au lieu d'ouvrir la liste.

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

### 2026-06-08 Fichiers intermédiaires non nettoyés et variable undefined
**Probleme** : Les fichiers `reel_character_*.jpg`, `*_h264.mp4`, `*_trimmed.mp4`, `video_kling_*.mp4` s'accumulaient dans `storage/uploads/generated/`. La vidéo Kling était générée mais n'apparaissait pas dans la liste des contenus.
**Cause racine** : (1) `proportionsOk` non déclarée dans le `return` de `runReelWorkflow` → `ReferenceError` lancée après `persistContentRecord` → `markFailed` appelé → contenu en FAILED. (2) `madisonImagePath` et `reelVideoPath` déclarés en `const` dans le try, non accessibles dans le `finally`. (3) `klingGenerator.js` ne nettoyait pas ses propres intermédiaires.
**Solution** : Hoister `madisonImagePath` et `reelVideoPath` avant le try, les ajouter au `finally`, supprimer `proportionsOk` du return. Wrapper `generateVideoMotionControl` avec try/finally pour supprimer les intermédiaires h264/trimmed/resized.
**Regle** : Tout fichier temporaire créé dans un flux async doit être déclaré AVANT le try block et supprimé dans le finally. Ne jamais référencer une variable non déclarée dans un return sans la définir explicitement.

### 2026-06-08 /dev/null hardcodé bloque la détection de cuts sur Windows
**Probleme** : La détection de cuts avec ffmpeg utilisait `.output('/dev/null')`, chemin UNIX inexistant sur Windows. ffmpeg échouait silencieusement, `detectSceneCuts` retournait `[]`, donc toutes les vidéos passaient la validation (aucun cut détecté).
**Cause racine** : Path hardcodé `/dev/null` incompatible avec Windows.
**Solution** : Remplacer par `process.platform === 'win32' ? 'nul' : '/dev/null'`.
**Regle** : Tout chemin null device doit être résolu dynamiquement selon `process.platform`. Ne jamais hardcoder `/dev/null` dans du code Node.js cross-platform.

**Probleme** : La generation Reel remontait un 500 generic avec `read ECONNRESET` pendant les appels Kling ou tmpfiles.
**Cause racine** : Les fetchs externes du pipeline video etaient executes sans reprise sur erreur transitoire ni timeout explicite.
**Solution** : Ajouter un wrapper de fetch avec timeout et retries sur les erreurs reseau transientes pour submit/poll/download Kling et l'upload tmpfiles.
**Regle** : Tout appel media externe critique doit gerer `ECONNRESET`/timeouts comme des pannes transitoires et non comme des erreurs fatales immediates.
