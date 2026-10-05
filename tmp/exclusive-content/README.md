# Prompts ecartes de la curation Plotline (contenu adulte/Fanvue)

Ce fichier trace les recettes de `tmp/autres/PROMPTS.md` explicitement destinees
a du contenu adulte (Fanvue/X) ou a des poses suggestives, ecartees le
2026-09-23 de la bibliotheque de patterns Plotline (Instagram/TikTok, contenu
professionnel/lifestyle uniquement).

Ce dossier est une exception au `.gitignore` (`/tmp` est ignore, ce
sous-dossier ne l'est pas) : c'est le seul endroit sous `tmp/` qui reste suivi
par Git, exprès pour garder une trace meme si `tmp/autres/PROMPTS.md` change ou
disparait.

## Prompts ecartes

| # dans PROMPTS.md | Titre | Ligne (au 2026-09-23) |
|---|---|---|
| 79 | Selfie mirror (for fanvue content top) | 3364 |
| 80 | Selfie mirror (gym club) For fanvue content - variante | 3401 |
| 84 | Realistic photo - Bedroom suggestive pose (TOP) | 3495 |
| 93 | Cosplay sexy rabbit suggestive position (x or fanvue - TOP) | 3786 |

Si `PROMPTS.md` est modifie plus tard (ajouts, renumerotation), ces numeros de
ligne peuvent se decaler -- se fier au titre pour retrouver l entree exacte.

## Regle appliquee

Aucune de ces 4 recettes ne doit etre reprise, meme partiellement ou
reformulee, dans `server/data/promptPatterns.js` ni dans aucun pattern
automatise du calendrier editorial. Si un besoin de contenu adulte apparait un
jour, ce sera un produit/scope separe, pas une extension de Plotline.

## Ajouts du 2026-10-05 (source : `tmp/autres/PROMPTS-INBOX.md`)

Numerotation propre a ce fichier (il contient des doublons de numeros : deux
« 22 », deux « 23 », deux « 43 » -- se fier au titre et a la ligne).

### Ecartes, non branches (aucune reprise, meme partielle)

| # dans INBOX | Titre | Ligne (au 2026-10-05) | Motif |
|---|---|---|---|
| 5 | INFLUENCER IN CAR | 151 | contenu suggestif/adulte |
| 6 | Bedtime selfie | 387 | contenu adulte |
| 18 | Systeme pour generer une video Exclusive content (methode) | 1311 | **methode de contournement du filtre d un modele** : ne jamais la construire |
| 19 | Influenceur Homme - Streetwear | 1346 | le texte est une copie de #18 (erreur de collage probable) |
| 25 | UGC AI - Lifestyle (reserve exclusive content) | 2613 | reserve par l utilisateur a l exclusive content |
| 41 | Lifestyle (Grok Imagine) | 4849 | contenu explicite |

### Sensibles legers (a traiter comme golden hour / selfie miroir : palier A adouci, palier B non selectionnable, le jour ou on les ajoute)

#2 (ligne 22), #10 (764), #11 (774), #15 (1027), second #43 « Matin dans le miroir » (4882).

### Catalogue de poses

Decision de l utilisateur (2026-10-05) : un catalogue de 21 poses
(`server/data/poseCatalog.js`, par nom de planche) pour des photos suggestives
de personas ADULTES FICTIVES, reserve aux comptes influenceur. INACTIF
(`PORTRAIT_POSE_CATALOGUE`, `selectable: false`) jusqu a ce que l utilisateur
branche un modele plus permissif. Ce catalogue ne reprend aucune des recettes
ecartees ci-dessus ni de la premiere liste (#79, #80, #84, #93). Conditions au
branchement : personas fictives adultes issues de la face ref, jamais le
visage d une personne reelle.
