# Brief de revue : page « Mes créations » (novembre 2026)

> Document destiné à Claude Design. But : **relire d'un œil extérieur** les éléments graphiques que nous avons ajoutés à la page « Mes créations » depuis le brief `BRIEF-contenu-cartes.md`, et dire ce qui est clair, ce qui ne l'est pas, ce qu'il faut changer. Aucune recommandation ne sera appliquée sans validation.

Les captures sont dans ce dossier (`01` à `10`). Elles viennent d'un compte de test avec des visuels d'exemple (photos et une vidéo libres de droits), pas de vrais contenus.

---

## 1. Contexte

Plotline est un outil de création de contenus pour Instagram et X. Les contenus passent par des états : **En attente** (généré, à relire), **Validé** (approuvé), **Publié**, plus **Erreur** (génération ou publication ratée). Un contenu validé peut être **programmé** : l'outil le publie alors tout seul à la date choisie. La page « Mes créations » liste les contenus d'un profil, en grille ou en liste.

Le kit UI est décrit dans `docs/ui-kit/UI.md` (composants `Ui*`, jetons de couleur `ui-*`, règles) et illustré par `docs/ui-kit/ui-kit-v1.png`. Règles à respecter dans toute proposition :

- un seul bouton principal (orange) par écran, sauf grille de cartes où un bouton principal par carte est toléré (taille `sm`, 40 px) ;
- libellés de boutons courts, sur une ligne ; pas d'emoji dans les boutons ;
- cibles cliquables ≥ 44 px (boutons de carte `sm` à 40 px tolérés parce que le menu `⋯` et la carte entière offrent d'autres chemins) ;
- aucune couleur en dur : uniquement les jetons du kit ;
- une erreur dit quoi, pourquoi, et propose une action.

## 2. Ce qui est conforme à votre brief précédent

Anatomie de la carte (média sans bouton dessus, méta + légende, pied d'actions selon le statut), onglets avec compteurs, filtre de type, tri, grille / liste, sélection multiple, panneau de détail, suppression douce avec annulation (8 s). Captures `01`, `03`, `05`, `06`, `09`.

## 3. Ce que nous avons ajouté sans brief (à relire en priorité)

| Élément | Capture | Ce que c'est |
|---|---|---|
| Pastille **« Programmé 10 nov., 17:52 »** | `01`, `03`, `05` | Remplace le badge « Validé » quand la publication est programmée. Fond orange clair (`ui-accent-soft`), texte brun orangé. |
| **Bandeau d'erreur de publication** | `01`, `02`, `10` | En haut de la page quand une publication automatique a échoué : titre, un bloc par contenu (début de légende, date prévue, message d'erreur), 4 boutons : « Marquer comme publié à la main », « Reprogrammer », « Garder en « Validé » », « Supprimer ». |
| **Pastille rouge du menu** | `01` | Point rouge sur l'icône « Contenu » du menu replié (compteur quand le menu est déplié). Elle compte les publications ratées. |
| **Menu `⋯`** d'une carte | `03` | Entrées selon le statut ; « Supprimer » en rouge, séparé par un filet. |
| **Bouton « Publier ▾ » scindé** et son menu | `04` | Clic principal = publier sur la plateforme par défaut ; la flèche liste Instagram, X (grisé « Non connecté ») et un lien « Connecter dans les paramètres ». |
| **Fenêtre de confirmation de publication** | `07` | Aperçu de la légende, plateforme, « Maintenant ». |
| **Fenêtre « Planifier » bloquée** | `08` | Quand le profil n'a pas Instagram connecté, la publication automatique échouerait : un message l'explique, avec un lien, et « Planifier » est désactivé. |
| Bouton **« Remettre en « Validé » »** | `05` (ligne « Erreur ») | Sur une carte en erreur de publication qui a gardé sa vidéo. |

## 4. Questions précises

1. **Couleurs de statut.** Gris (En attente), vert (Validé, Publié avec coche), orange clair (Programmé), rouge (Erreur). Les quatre se distinguent-ils d'un coup d'œil, y compris posés sur une photo ou une vidéo claire ou chargée (`01`, `03`) ? La pastille « Programmé » est-elle assez lisible sur le média ? Orange clair est aussi la couleur du type « Feed » dans le kit : y a-t-il une confusion possible ?
2. **Bandeau d'erreur.** Quatre boutons de même poids visuel côte à côte : faut-il un bouton mis en avant (nous pensions à « Marquer comme publié à la main »), ou une autre hiérarchie ? Sur mobile (`10`) ils passent sur trois lignes : que faire ? Le bandeau est-il trop chargé quand il y a plusieurs contenus ?
3. **Pastille rouge du menu replié.** Un point de 10 px sur une icône de 18 px est-il assez visible ? Le compteur disparaît quand le menu est replié : acceptable ?
4. **Vue liste** (`05`, `09`). Presque chaque ligne a un bouton principal orange (« Publier », « Valider »). La règle « un seul bouton principal » devient-elle illisible ? Faut-il en rétrograder certains ? Les boutons « Publier » grisés (profil sans Instagram) ne disent pas pourquoi : comment l'expliquer sans alourdir ?
5. **Menu `⋯` et bouton scindé.** La flèche du bouton scindé (`04`) est-elle reconnaissable comme un menu ? Le menu s'ouvre sous la flèche et déborde de la carte : est-ce un problème ?
6. **Fenêtre « Planifier » bloquée** (`08`). Le message est-il assez clair ? Le bouton désactivé et le lien sont-ils bien hiérarchisés ? Existe-t-il une meilleure façon de dire « tu ne peux pas planifier pour l'instant » sans fermer la porte ?
7. **Mobile** (`10`). Une carte en 9:16 occupe presque tout l'écran en colonne unique (un seul contenu visible à la fois). Faut-il un format plus compact sur petit écran (deux colonnes, ou une ligne comme la vue liste) ?
8. **Panneau de détail** (`06`). Le titre répète la première phrase de la légende, juste au-dessus de la légende complète : à simplifier ?

## 5. Constats déjà faits de notre côté (pour ne pas les redécouvrir)

- Le menu `⋯` était **coupé par le bas de la carte** (« Supprimer » inaccessible en grille). **Corrigé** : le menu est désormais rendu hors de la carte, positionné à l'écran et retourné vers le haut s'il manque de place. Les captures `03` et `04` montrent la version corrigée.
- La vue liste et la grille mémorisent le choix d'affichage dans le navigateur.
- Les captures `01` (1440 px) et `02` à `09` (820 px, mise en page tablette, donc sans barre latérale) n'ont pas la même largeur : `01` est la seule à montrer le menu latéral replié et sa pastille.
- La barre d'outils de développement de Nuxt (petite pastille ronde en bas) apparaît sur certaines captures : ce n'est pas un élément de l'application.

## 6. Ce qu'on attend en retour

Pour chaque question : un avis court (garder / changer) et, si changement, la proposition la plus simple réalisable avec les composants du kit. Priorité : 1, 2, 4, 7.
