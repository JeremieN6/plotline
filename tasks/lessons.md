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

### 2026-09-03 Le deploiement detruisait la version en service avant de construire
**Probleme** : deux deploiements consecutifs ont echoue et la production est restee cassee, servant des 500 sur les chunks JS (`Failed to fetch dynamically imported module`), page blanche sur /dashboard.
**Cause racine** : le workflow enchainait `rm -rf .output` PUIS `npm run build`, sous `set -euo pipefail`. Des que le build echouait, la sortie precedente etait deja supprimee et le processus pm2 continuait de servir un `index.html` referencant des fichiers disparus. L echec du build ne cassait donc pas seulement le deploiement, il cassait le site en ligne.
**Solution** : deplacer `.output` vers `.output.prev` avant de construire, ne le supprimer qu apres un build reussi, et le restaurer si le build echoue. Ajout d une reprise sur `git fetch`, dont l echec (limitation ponctuelle de GitHub) avait fait rater un premier deploiement.
**Regle** : un deploiement ne supprime jamais la version en service avant que la nouvelle soit prete. Construire d abord, basculer ensuite. Un `rm -rf` suivi d une etape faillible transforme n importe quelle erreur de build en panne de production.

### 2026-09-03 Scripts d installation npm bloques en production
**Probleme** : `npm run build` echouait sur le VPS avec `File node_modules/ffmpeg-static/ffmpeg does not exist`, alors que le build local passait.
**Cause racine** : npm bloque desormais par defaut les scripts d installation non couverts par une liste d autorisation. Le `postinstall` de `ffmpeg-static`, qui telecharge le binaire, ne s executait plus. Nitro trace ce binaire au build (`plugin-node-externals`) et echoue s il est absent. Rien dans le code du projet n avait change a ce sujet: c est l environnement du serveur qui a evolue.
**Solution** : supprimer la dependance au binaire AU BUILD. `ffmpeg-static` et `ffprobe-static` ne sont plus importes statiquement: `server/utils/ffmpegBinaries.js` les resout a l execution, via un specificateur non litteral que l analyse statique ne peut pas suivre, avec trois sources dans l ordre — `FFMPEG_PATH`/`FFPROBE_PATH`, le paquet npm si son script a tourne, puis le binaire systeme via le PATH. Effet mesure: la sortie de build passe de 183 Mo a 37 Mo, le binaire n y etant plus embarque.
**Regle** : une dependance dont le binaire est telecharge par un script d installation est un point de rupture silencieux entre local et production. Ne jamais l importer statiquement dans du code trace au build: la resoudre a l execution, avec un repli sur le binaire systeme. Et quand un build echoue uniquement sur le serveur, lire les avertissements de `npm ci` avant de suspecter le code.
**Complement (meme jour)** : `prisma`, `@prisma/engines` et `sharp` n ont jamais casse -- ils embarquent leurs binaires en dependance optionnelle plutot que de les telecharger par script -- mais restaient bloques par la meme fonctionnalite npm. Approuves via `npm install-scripts approve <paquet>...`, ce qui ecrit un champ `allowScripts` dans `package.json`, PINNE PAR VERSION EXACTE (`"prisma@7.8.0": true`). Committer ce fichier immediatement: un deploiement qui fait `git reset --hard` avant `npm ci` ecrase toute approbation non committee. Et surtout: l approbation ne suit pas les montees de version. Mettre a jour prisma/sharp change la cle attendue, l ancienne approbation ne matche plus, et le script redevient bloque silencieusement -- a rejouer `npm install-scripts approve` a chaque montee de version de ces paquets.

### 2026-09-03 Repli silencieux sur localhost en production
**Probleme** : depuis plotline.sassify.fr, le bouton Google renvoyait vers `http://localhost:3000/api/auth/google/callback`, donc vers la machine de l utilisateur, avec un `ERR_CONNECTION_REFUSED`. Le message accusait a tort la configuration de la console Google.
**Cause racine** : l URI de redirection etait construite depuis `BASE_URL`, avec un repli `|| 'http://localhost:3000'`. La variable etant absente du VPS, la production a demande a Google une redirection vers localhost. Comme localhost est declare dans la console, Google a obei sans erreur.
**Solution** : faire primer l origine reelle de la requete sur `BASE_URL`. Se fier a l en-tete Host est sans danger ici, la console Google refusant toute URI non declaree: c est elle la frontiere de securite.
**Regle** : un repli sur `localhost` ne doit jamais etre silencieux dans du code qui tourne aussi en production. Soit on derive la valeur de la requete reelle, soit on echoue bruyamment. Un repli qui produit une URL valide mais fausse est pire qu une absence de valeur: il deplace l enquete au mauvais endroit.

### 2026-09-03 Deux deploiements en parallele corrompent .output
**Probleme** : le site est retombe en 500 en boucle (`ERR_MODULE_NOT_FOUND` sur `.output/server/chunks/routes/renderer.mjs` et `error-500.mjs`), sans qu aucun build local n ait echoue et sans lien avec le contenu du dernier commit (uniquement de la documentation).
**Cause racine** : deux commits pousses a quelques minutes d intervalle (un committe depuis le VPS lui-meme, un depuis le poste local) ont declenche deux runs GitHub Actions qui se sont executes EN MEME TEMPS sur la meme VPS, dans le meme dossier. Le script de deploiement fait `mv .output .output.prev` puis `npm run build` puis `rm -rf .output.prev`: sans verrou, un second run peut executer ces etapes pendant que le premier ecrit encore dans `.output`, ou supprimer la sauvegarde dont l autre aurait eu besoin en cas d echec. Le garde-fou "build avant bascule" ajoute plus tot protege contre un build qui echoue proprement, pas contre deux deploiements qui se marchent dessus.
**Solution** : ajouter `concurrency: { group: deploy-plotline, cancel-in-progress: false }` au workflow, pour que GitHub Actions mette en file les deploiements au lieu de les paralleliser. Recuperation immediate: rebuild propre (`rm -rf .output && npm ci && npx prisma generate && npm run build`) suivi d un `pm2 restart`.
**Regle** : tout workflow de deploiement qui modifie des fichiers partages sur un serveur cible doit avoir un groupe de concurrence des sa creation, meme quand les deploiements semblent rares. Deux commits pousses a la suite (l un d eux depuis le serveur cible lui-meme) suffisent a declencher la collision.

### 2026-09-03 Origine de requete derriere un proxy inverse (recidive du bug precedent)
**Probleme** : la correction du bug precedent (faire primer l origine de la requete sur `BASE_URL`) a cree une nouvelle panne en production: le bouton Google renvoyait `redirect_uri_mismatch` cote Google.
**Cause racine** : `getRequestURL(event)` appele sans options lit l adresse interne du socket derriere le reverse proxy nginx, pas le domaine public. En faisant primer l origine de la requete sur `BASE_URL`, le code a commence a envoyer a Google une URI de redirection non declaree dans la console. La premiere correction a remplace un mauvais repli par un autre, tout aussi faux en production.
**Solution** : inverser de nouveau la priorite -- `BASE_URL`, quand elle est une URL absolue, fait foi; l origine de la requete redevient un simple repli, desormais calculee avec `{ xForwardedHost: true, xForwardedProto: true }` pour lire correctement les en-tetes de proxy le jour ou elle sert vraiment. Ajout d un log de l URI de redirection envoyee, pour rendre tout futur `redirect_uri_mismatch` immediatement diagnosticable au lieu de redeviner a chaque fois. Au passage, un helper `isHttpUrl()` reference mais supprime lors d une edition precedente a ete retrouve et restaure.
**Regle** : derriere un reverse proxy, ne jamais lire l origine d une requete (`getRequestURL`, `request.headers.host`, etc.) sans transmettre `xForwardedHost`/`xForwardedProto`: par defaut, c est l adresse interne du serveur qui remonte, pas le domaine public. Et quand on corrige un repli en faisant primer une autre source, verifier que cette autre source est effectivement fiable dans l environnement de production reel -- ici, sans les en-tetes forwarded, elle ne l etait pas non plus.

### 2026-09-03 Une liste vide n est pas une liste chargee
**Probleme** : apres connexion, l assistant de creation de profil s ouvrait sur un compte possedant deja trois profils. Le probleme ne se reproduisait pas a la deuxieme connexion.
**Cause racine** : `const influencers = computed(() => influencersData.value || [])`. Tant que la requete n avait pas repondu, ou si elle echouait, la liste valait `[]`, et la condition d affichage de la modale (`length === 0`) concluait "compte vide". A la deuxieme connexion, la donnee etait deja en cache: pas de fenetre vide, donc pas de modale.
**Solution** : recuperer `pending` et `error` de `useFetch`, et n afficher la modale que lorsque la liste est reellement chargee, sans erreur, et sous forme de tableau.
**Regle** : toute decision d interface fondee sur l ABSENCE de donnees doit verifier que le chargement est termine et sans erreur, jamais seulement la longueur du tableau. Un bug de ce type se cache derriere un cache: il n apparait qu au premier chargement, ce qui le rend facile a prendre pour un hasard.

### 2026-08-10 Generation video attendue dans la requete HTTP
**Probleme** : Kling sondait son API jusqu'a 90 fois toutes les 10s (soit 15 minutes) a l'interieur de la requete HTTP. En local ca passe; derriere un proxy la requete est coupee bien avant, l'utilisateur voit une erreur et le contenu reste bloque en `PROCESSING` alors que la video aboutit correctement cote fournisseur.
**Cause racine** : Veo avait ete passe en tache de fond parce qu'il etait "lent" (~60s), mais Kling, encore plus lent, etait reste sur le chemin synchrone. Le critere retenu etait la lenteur constatee au lieu de la nature de l'operation.
**Solution** : Faire passer les trois fournisseurs (Veo, Kling, Seedance) par le meme chemin: reponse immediate `processing`, generation en tache de fond, suivi par le frontend via `/api/content/:id/status`. Ajout d'un echec explicite quand le fournisseur repond sans URL, sinon le contenu restait en `PROCESSING` indefiniment.
**Regle** : Un appel a une API de generation media ne s'attend JAMAIS dans une requete HTTP, quelle que soit sa duree observee en local. Le declencheur repond tout de suite, le resultat arrive par polling ou webhook.

### 2026-08-09 Champ ajoute au schema Prisma avant la migration
**Probleme** : Tous les profils ont perdu l'affichage de leurs contenus en production.
**Cause racine** : Un champ scalaire (`generationModel`) a ete ajoute a `schema.prisma` puis `prisma generate` lance, alors que la colonne n'existait pas encore en base. Le client genere selectionne toutes les colonnes du modele: chaque `findFirst`/`update` sans `select` explicite echouait donc en P2022, pas seulement les requetes touchant le nouveau champ.
**Solution** : Retirer le champ du schema, puis reconstruire la fonctionnalite via une relation (`ContentVersion`) — un champ de relation n'ajoute aucune colonne SQL et reste donc sans effet tant que la table n'existe pas.
**Regle** : Ne jamais ajouter un champ SCALAIRE au schema Prisma avant que la migration soit appliquee sur toutes les bases cibles. Verifier la presence des colonnes en base (lecture seule) AVANT de toucher au schema. Un champ de relation est sans risque, un champ scalaire casse tout le modele.

### 2026-08-08 Collision d'auto-import Nitro sur un symbole exporte
**Probleme** : Le serveur de dev tombait sur `The symbol ImageSafetyError has already been declared`, alors que le fichier ne declarait la classe qu'une seule fois.
**Cause racine** : Nitro auto-importe tout ce qui est exporte depuis `server/utils/`, y compris DANS le fichier qui declare le symbole: l'import injecte entre en collision avec la declaration locale.
**Solution** : Ne pas exporter les classes utilisees uniquement a l'interieur de leur propre module.
**Regle** : Dans `server/utils/`, n'exporter que ce qui est reellement consomme ailleurs. Un test isole en esbuild ne prouve rien ici: il court-circuite justement l'auto-import qui provoque la panne, donc la verification doit se faire sur le vrai serveur de dev.

### 2026-08-10 Face ref ecrite sur le disque local malgre le Blob (recidive)
**Probleme** : Une regeneration echouait avec `Face reference file not found: storage/uploads/face-refs/....jpg`, alors que le fichier existait bien sur le poste de dev.
**Cause racine** : `server/api/upload/face-ref.post.js` a DEUX branches. Celle de l upload manuel consultait `isBlobStorageEnabled()`; celle du pipeline de generation (photo normale -> fiche 3 panneaux), ajoutee plus tard, ecrivait toujours en local. La face ref restait donc sur la machine qui l avait generee, avec une base pourtant partagee. C est exactement la lecon du 2026-08-07 sur les videos, reproduite ailleurs deux jours plus tard.
**Solution** : Faire passer la branche du pipeline par le Blob quand il est actif, et rapatrier l existant avec `scripts/migrate-face-refs-to-blob.cjs` (dry-run par defaut).
**Regle** : Quand un fichier peut etre ecrit par plusieurs chemins, corriger UN chemin ne corrige pas la regle. Apres avoir repare un cas, faire un grep de tous les points d ecriture du meme type de media et verifier chacun. Une regle de stockage se verifie exhaustivement, pas au cas par cas.

### 2026-08-07 Video ecrite sur le disque local malgre le Blob configure
**Probleme** : Les videos generees etaient invisibles en production alors que le token Blob etait bien present.
**Cause racine** : Les chemins de sortie Veo et Kling ecrivaient directement dans `storage/uploads/generated/` sans consulter `isBlobStorageEnabled()`. La lecon de 2026-06-06 avait ete appliquee aux images mais pas aux videos ajoutees ensuite.
**Solution** : Faire passer toutes les sorties video par le Blob quand il est actif, avec repli local sinon. Attention a ne pas confondre avec `copyIntoGeneratedDir`, qui doit rester local car il sert a exposer un fichier source A Kling via `BASE_URL`.
**Regle** : Chaque nouveau type de media doit passer par le meme point de persistance partage. Quand une regle de stockage existe, verifier qu'elle couvre les formats ajoutes apres coup.

### 2026-08-09 Validation "exactement une personne" trop stricte
**Probleme** : Des generations echouaient sur des scenes parfaitement legitimes (une estheticienne et sa cliente, par exemple).
**Cause racine** : La validation exigeait `personCount === 1`. La regle avait deja ete corrigee sur le flux image, puis reintroduite telle quelle en recopiant le code dans le flux video.
**Solution** : Verifier `personCount >= 1 && upperBodyVisible`: on controle qu'un sujet est bien rendu, pas qu'il soit seul.
**Regle** : Une validation de contenu genere doit verifier ce qui est necessaire, pas ce qui est typique. Quand du code de validation est recopie d'un flux vers un autre, verifier qu'on ne reimporte pas une contrainte deja corrigee ailleurs.

### 2026-07-30 Campagnes et contenus relies
**Probleme** : La suppression d'une campagne pouvait casser la lecture des contenus lies, et la vue contenu/dashboard ne montrait pas clairement la provenance campagne.
**Cause racine** : La campagne n'etait pas persistee comme relation explicite sur les contenus generes, et les routes de lecture n'exposaient pas les donnees campagne.
**Solution** : Ajouter `campaignId` sur `GeneratedContent`, exposer la campagne dans les listes et details, filtrer les vues par campagne, et bloquer la suppression si des contenus sont encore en cours.
**Regle** : Quand une entite parent est supprimable, il faut d'abord definir le comportement des enfants lies: blocage pour l'actif, detachement ou fallback pour le reste.

### 2026-07-20 Face ref Gemini renvoie parfois zero part
**Probleme** : La creation d'une influenceuse pouvait echouer avec `Erreur generation face ref: Gemini returned no parts. finishReason=unknown`.
**Cause racine** : Le endpoint `server/api/generate/face-ref.post.js` transformait un candidate vide en erreur fatale sans retry ni fallback de prompt, alors que Gemini peut parfois renvoyer une reponse sans `parts` sur ce flux preview.
**Solution** : Retry une fois avec un prompt nettoye, remonter un statut metier explicite quand Gemini ne renvoie toujours pas d'image exploitable, et garder un message d'erreur plus precis pour l'UI.
**Regle** : Sur les endpoints image Gemini, tout retour `parts=[]` doit avoir un fallback cible avant de devenir un 500 generic.

### 2026-07-08 Routes auth publiques bloquees par middleware
**Probleme** : Le lien mot de passe oublie semblait ne rien faire en prod; l URL devenait `/auth/login?redirect=/auth/forgot-password`.
**Cause racine** : Le middleware auth ne listait comme publiques que `/`, `/auth/login` et `/auth/signup`, donc les pages `forgot-password`, `reset-password` et `confirm-email-change` etaient traitees comme privees.
**Solution** : Ajouter ces routes d action auth aux chemins publics et ne rediriger les utilisateurs connectes que depuis login/signup.
**Regle** : Toute page auth necessaire avant connexion ou depuis un lien email doit etre explicitement publique dans le middleware.

### 2026-07-01 Persistance personnage incoherente sur route influenceuse
**Probleme** : Sur `/influencers/:id/edit`, changer de personnage via le switcher puis rafraichir pouvait revenir a l'ancien personnage.
**Cause racine** : Le switcher modifiait l'etat actif sans toujours aligner l'URL parametree (`:id`), et la page edit utilisait un `id` capture au premier rendu (non reactif aux changements de route).
**Solution** : Quand on change de personnage sur une route scopee influenceuse (`/influencers/:id/edit|generate`), remplacer l'URL avec le nouvel `id`; rendre l'`id` de la page edit reactif (`computed`) et brancher `useFetch`/PATCH dessus.
**Regle** : Pour toute page parametree par `:id`, l'etat actif et l'URL doivent rester synchronises; si l'utilisateur change d'entite, on doit aussi mettre a jour la route et utiliser des params reactifs cote page.

### 2026-07-01 Débordement horizontal mobile causé par un grid sans colonne de base
**Probleme** : Le dashboard débordait horizontalement en mobile (bord gauche coupé, contenu décalé), malgré plusieurs corrections sur les cartes et images.
**Cause racine** : Le grid bento `grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.9fr)]` ne définissait AUCUNE colonne en mobile. Sans `grid-cols`, le grid crée une colonne implicite `auto` dimensionnée à `max-content` (1732px mesurés) au lieu d'être contrainte au conteneur (343px), poussant tout le contenu hors écran. Diagnostiqué via Playwright: `getComputedStyle(grid).gridTemplateColumns` = `1732px` alors que le grid faisait 343px.
**Solution** : Ajouter `grid-cols-1` comme classe de base (= `minmax(0,1fr)`, contraint au conteneur) tout en gardant `xl:grid-cols-[...]` pour le desktop. Appliqué au grid réel et au skeleton de chargement. Vérifié en navigateur: `scrollWidth === clientWidth`, 0 élément en débordement.
**Regle** : Tout `grid` responsive avec des colonnes définies seulement à un breakpoint (`xl:grid-cols-...`) DOIT avoir une base `grid-cols-1` (ou `minmax(0,1fr)`), sinon la colonne implicite `auto` prend la largeur max-content et déborde. Pour diagnostiquer un overflow horizontal, comparer `scrollWidth`/`clientWidth` et inspecter `gridTemplateColumns` calculé, pas seulement le CSS global.

### 2026-06-10 Healthcheck schema Prisma + nettoyage jobs bloqués
**Probleme** : `/api/health/schema` renvoyait un 500 et certains `GeneratedContent` restaient en `PROCESSING` sans fin.
**Cause racine** : Le raw query Prisma lisait `information_schema.columns.column_name` sans cast compatible, et les jobs orphelins n'etaient pas remis a plat apres un crash worker.
**Solution** : Caster `column_name` en `text` dans le healthcheck, puis marquer les `PROCESSING` anciens comme `FAILED` avec un message explicite de nettoyage manuel.
**Regle** : Pour les healthchecks Prisma sur `information_schema`, caster les colonnes non triviales en types Prisma-friendly; pour les jobs orphelins, appliquer un seuil de date avant de nettoyer l'etat.

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

### 2026-06-09 Prompt auto corps/cheveux trop faible
**Probleme** : Les generations pouvaient ignorer les cheveux courts verrouilles ou lisser le corps fallback, alors que les prompts auto existaient deja.
**Cause racine** : Les champs auto/fallback etaient stockes dans le JSON, mais seuls les prompts manuels alimentaient le chemin prioritaire `custom_instruction`; en plus le body ref auto dependait de Gemini et pouvait retomber sur vide.
**Solution** : Faire monter la consigne finale auto/fallback au meme niveau prioritaire que le manuel, ajouter des contraintes negatives sur les cheveux courts, et replier le body sur les mensurations Madison quand aucune inference fiable n'est disponible.
**Regle** : Un prompt auto ou fallback critique doit alimenter le meme champ prioritaire que le prompt manuel; ne jamais laisser une contrainte identitaire sur un chemin secondaire ou optionnel.

### 2026-06-09 Suppression UI incomplète d'une fonctionnalité legacy
**Probleme** : Le body ref avait disparu de l'ecran d'edition, mais le backend continuait de le transporter dans les API, le worker et le schema.
**Cause racine** : La suppression a d'abord ete faite au niveau UI seulement, sans purge systematique des dependances serveur et des champs de persistence associes.
**Solution** : Supprimer les routes et utilitaires `bodyRef`, retirer le champ des lectures metier, nettoyer le schema Prisma, et preparer la migration SQL de drop.
**Regle** : Quand une fonctionnalite legacy est retiree de l'UI, faire immediatement un grep bout-en-bout pour purger aussi les routes, workers, caches et schema relies.

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

### 2026-08-14 Middleware nomme reference alors qu il n existe pas
**Probleme** : La page `onboarding/influencer-creator.vue` declarait `definePageMeta({ middleware: ['auth'] })`. Nuxt levait `Unknown route middleware: 'auth'`.
**Cause racine** : Le seul middleware du projet est `auth.global.ts`, un middleware GLOBAL. Un middleware global s'applique automatiquement a toutes les routes et ne peut pas etre reference par son nom dans `definePageMeta`. Le nom `'auth'` ne correspondait donc a rien.
**Solution** : Retirer la declaration `middleware: ['auth']` de la page. La protection etait deja assuree par le middleware global, qui redirige tout visiteur non authentifie vers la connexion sur toutes les routes sans exception.
**Regle** : Sur ce projet, ne jamais referencer un middleware par son nom dans `definePageMeta`: le seul middleware existant est global et s'applique deja partout. Si un jour un middleware nomme (non global) est ajoute, verifier son nom exact dans `server/middleware` ou `app/middleware` avant de le referencer -- ce genre d'erreur ne se revele que quand la route concernee est reellement visitee (voir aussi : le parcours d'inscription neuve est rarement emprunte pendant le developpement courant, cf. `docs/recette-connexion-google.md` section 7).

### 2026-09-05 robots.txt ouvert a tout: Google indexe des pages qui exigent une connexion
**Probleme** : `robots.txt` valait `Disallow:` (vide, tout autorise). Google a indexe des URLs internes (dashboard, studio, etc.) qui, visitees sans session, ne montrent que l ecran de connexion -- repere via un lien vers `/_nuxt` (dossier d assets techniques, jamais une page) indexe puis redirigeant vers `/auth/login` dans les resultats de recherche.
**Cause racine** : aucune regle n excluait les routes protegees par le middleware d authentification global (`auth.global.ts`) de l exploration. Une route qui n existe pour l utilisateur qu apres connexion reste, du point de vue d un crawler, une simple URL HTTP visitable.
**Solution** : `robots.txt` interdit desormais l exploration de toutes les routes derriere l authentification (dashboard, studio, contenu, profils, plans, onboarding, reglages...) et des chemins techniques (`/_nuxt/`, `/api/`), ne laissant que l accueil, la connexion et l inscription. `robots.txt` bloque l exploration future, pas la desindexation de ce qui est deja indexe: le retrait des URLs deja presentes se fait via l outil de suppression de Google Search Console, ou attend le prochain passage naturel du crawler.
**Regle** : Toute route ajoutee derriere le middleware d authentification global doit etre reflechie du point de vue de `robots.txt` des sa creation, pas seulement de la protection applicative -- l authentification empeche un visiteur d en voir le contenu, jamais un moteur de recherche de l indexer.
