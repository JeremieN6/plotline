# STORY.md -- Memoire narrative de Plotline

> Memoire business et narrative du projet, complementaire de CLAUDE.md.
> CLAUDE.md repond a "qu'est-ce qu'un agent qui code doit savoir".
> Ce fichier repond a "pourquoi ce projet a pris cette forme".
>
> Detail d'implementation -> CLAUDE.md. Raison business, pivot,
> apprentissage terrain -> ici.

---

## Objectif produit

Permettre a un createur d'influenceurs virtuels de faire tourner plusieurs
identites IA credibles sur Instagram et TikTok, sans que la coherence visuelle
se degrade au fil des publications et sans jamais publier quoi que ce soit sans
validation humaine pour le moment. A terme, une fois que plusieurs publications seront validées, celle ci pourra devenir automatique.

---

## Statut actuel

**Phase** : produit fonctionnel, en production sur plotline.sassify.fr, utilise
par son auteur sur ses propres marques et influenceuses.

Le pipeline complet est operationnel de bout en bout : planification editoriale,
generation d'images et de videos, revue, puis publication programmee sur
Instagram et X.

**Pas d'utilisateur externe a ce jour.** Tout le retour d'usage vient de l'auteur
utilisant l'outil pour ses propres comptes. C'est une information structurante :
chaque decision produit prise jusqu'ici repose sur un seul utilisateur reel, tres
au fait du fonctionnement interne.

---

## Historique des pivots

### 2026-05-26 -- La validation devait passer par Telegram

**Contexte** : le cadrage initial prevoyait un bot Telegram pour valider chaque
contenu avant publication, afin de pouvoir approuver depuis son telephone sans
ouvrir l'outil.

**Decision** : inscrire la validation humaine comme regle non negociable du
produit, quel qu'en soit le canal.

**Resultat** : la regle a tenu, le canal non. Voir le pivot suivant.

### 2026-08-10 -- Telegram abandonne au profit d'une validation dans l'outil

**Contexte** : le flux PENDING vers Valider vers Publier, construit dans
l'application pour d'autres raisons, remplissait deja exactement le role prevu
pour Telegram.

**Decision** : abandonner le bot Telegram. Aucune ligne n'avait ete ecrite.

**Resultat** : une dependance externe et un canal de moins a maintenir, sans rien
perdre du controle editorial. La regle fondatrice, jamais de publication sans
validation humaine explicite, reste intacte.

### 2026-08-10 -- Une ambassadrice peut representer plusieurs marques

**Contexte** : le modele initial liait chaque ambassadrice a une seule marque. En
pratique, il devenait impossible de reutiliser une influenceuse existante pour
une seconde marque du meme compte : il fallait la recreer a l'identique.

**Decision** : passer le lien en plusieurs-a-plusieurs, tout en interdisant
explicitement de relier deux profils appartenant a des comptes differents.

**Resultat** : une ambassadrice devient un actif reutilisable, ce qui correspond a
la realite du metier ou une influenceuse travaille couramment avec plusieurs
marques. Le cloisonnement entre comptes reste, lui, une frontiere de securite.

### 2026-08-10 -- Le plan editorial est relu avant toute generation

**Contexte** : le produit devait pouvoir generer des batchs de contenus. Generer
d'abord et trier ensuite engageait des credits d'image et de video avant que
l'auteur ait vu la moindre idee.

**Decision** : inserer une etape de revue en texte seul entre la proposition et
la production. L'IA redige les idees, l'auteur ajuste ou ecarte, et seules les
idees retenues partent en generation.

**Resultat** : le cout d'une erreur editoriale passe d'une serie de videos a une
requete de texte. Cette contrainte economique a faconne l'interface : le bouton
d'approbation annonce explicitement le nombre de contenus qui vont etre produits.

### 2026-08-10 -- La publication automatique TikTok est ecartee

**Contexte** : TikTok figurait comme cible de publication depuis le cadrage
initial, au meme titre qu'Instagram.

**Decision** : ne pas implementer la publication par API.

**Resultat** : d'apres l'observation de l'auteur, TikTok favorise les comptes qui
publient depuis son application mobile ; passer par l'API serait donc
contre-productif pour la portee des contenus. TikTok reste une cible en tant que
format vertical, mais la publication y demeure manuelle et assumee comme telle.

### 2026-08-10 -- Le troisieme fournisseur video est mis hors service

**Contexte** : trois fournisseurs de generation video etaient integres pour
diversifier les rendus.

**Decision** : mettre le troisieme hors service derriere un interrupteur, en
conservant le code.

**Resultat** : ce fournisseur fonctionne sur des credits prepayes, tombes a zero,
et aucune generation n'avait jamais abouti de bout en bout. Deux fournisseurs
couvrent les besoins. Le modele prepaye est identifie comme un risque : il
s'epuise sans preavis et transforme une fonctionnalite en panne silencieuse.

### 2026-08-14 -- Inscription et connexion par Google

**Contexte** : l'inscription passait uniquement par email et mot de passe, avec
verification d'adresse. Objectif affiche : fluidifier l'entree dans le produit
avant toute ouverture a des utilisateurs externes.

**Decision** : ajouter Google, en ecrivant l'echange a la main plutot qu'avec un
module tout fait, et ne rattacher automatiquement un compte existant que si
Google atteste que l'adresse est verifiee.

**Resultat** : l'inscription tient en un clic et l'email de verification
disparait, puisque Google l'a deja faite. La demarche a ete documentee comme
recette reutilisable, le meme besoin existant sur les autres projets de l'auteur.

---

## Ce que la cible attend / a appris

**Cible** : createurs et petites agences qui font vivre une ou plusieurs
identites IA sur les reseaux, et marques qui veulent une ambassadrice virtuelle
sans production photo.

**Ce que l'usage reel a montre jusqu'ici** (source : usage par l'auteur, aucune
etude externe) :

- La coherence du visage entre publications est le critere qui fait ou defait la
  credibilite d'une identite IA. C'est ce qui justifie tout l'appareillage de
  verrouillage d'identite, largement plus lourd qu'une simple generation d'image.
- Le cout de generation est une contrainte de conception, pas un detail
  d'exploitation. Il a dicte la revue avant production, et la conservation du
  rendu precedent en cas d'echec.
- Un compte de type agence se comporte differemment d'un compte de marque :
  beaucoup d'influenceuses et peu de marques d'un cote, l'inverse de l'autre.
  L'interface doit servir les deux sans imposer le vocabulaire de l'un a l'autre.

**Ce qui reste inconnu et devra etre valide aupres de vrais utilisateurs** :
tarification, volume de publication reellement souhaite, appetit pour la
publication automatique par rapport a un export manuel, et interet du
planificateur editorial pour quelqu'un qui n'a pas construit l'outil.

---

## Garde-fous de contenu

Ce fichier vit dans le depot et peut etre lu par n'importe quelle session ou
agent futur, pas seulement lors de la redaction d'un article. Les regles
suivantes s'appliquent a tout contenu produit a partir de ce fichier :

- **Aucun detail exploitable d'incident de securite.** Les decisions de securite
  peuvent etre citees dans leur principe, jamais la maniere de les contourner.
- **Aucune mecanique interne donnant une feuille de route a un concurrent** :
  pas de detail sur la construction des prompts, sur la chaine de verrouillage
  d'identite, ni sur le choix precis des fournisseurs et de leurs reglages.
- **Aucun chiffre financier ou metrique non source.** Ce projet n'a a ce jour ni
  revenu, ni utilisateur externe, ni mesure d'usage. Tout chiffre apparaissant
  dans un contenu doit pouvoir etre rattache a une source dans le depot, sinon
  il ne doit pas etre ecrit.
- **Aucun ton condescendant envers la cible.** Les createurs d'influenceurs IA
  sont un public souvent moque ; le produit ne se raconte pas a leurs depens.
- **Aucune donnee personnelle reelle** : pas d'adresse email, pas de nom de
  compte client, pas de capture montrant des identifiants.

---

## Derniere mise a jour

2026-08-27 -- Creation du fichier.

Constat de depart : CLAUDE.md etait a jour au 2026-08-14, mais annoncait comme
prochaine etape le lien marque/ambassadrice en plusieurs-a-plusieurs, alors que
celui-ci etait livre depuis le 2026-08-10 et deja consigne dans le tableau des
decisions du meme fichier. Corrige a cette occasion.
