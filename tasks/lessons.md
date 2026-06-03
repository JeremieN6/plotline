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

### 2026-06-02 Uploads et creation influenceuse
**Probleme** : Erreur 500 a la creation et risque de voir des fichiers uploades apparaitre dans les commits.
**Cause racine** : Creation d'influenceuse dependante d'un `userId` sans utilisateur existant en base, et stockage des images uploades sous `public/uploads` dans le repo.
**Solution** : Ajouter un `upsert` utilisateur avant `prisma.influencer.create`, deplacer les uploads de reference vers le dossier temporaire systeme hors repo, et ignorer `public/uploads` dans Git.
**Regle** : Aucun fichier utilisateur ne doit etre stocke dans un chemin versionne; utiliser un stockage runtime hors repo + regle `.gitignore` defensive.

### 2026-06-02 Prisma client/schema desynchronises
**Probleme** : L'API `/api/influencers` renvoyait 500 meme apres correctif metier.
**Cause racine** : Client Prisma charge avec des modeles obsoletes (delegates `persona/batch/post`) et base distante sans table `Influencer` (P2021).
**Solution** : Regenerer le client (`npx prisma generate`), redemarrer Nuxt, puis synchroniser le schema (`npx prisma db push`) quand les migrations sont en etat casse.
**Regle** : Apres chaque changement de `prisma/schema.prisma`, executer `npx prisma generate` et verifier que la base cible contient les tables attendues avant de debugguer les endpoints.
