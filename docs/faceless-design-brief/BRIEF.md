# Brief design : templates des vidéos "faceless" de Plotline

> Document destiné à Claude Design. But : proposer de **nouvelles directions artistiques (DA) / templates visuels** pour nos vidéos faceless, plus soignés que ceux que nous avons. Lis tout avant de proposer.

---

## 1. Ce que sont les vidéos faceless

Des vidéos verticales (format TikTok / Reels / Shorts) **sans visage humain filmé**. Une voix lit un script pendant que l'écran affiche, scène après scène :
- un **fond**,
- du **texte animé** (titres, mots clés, listes),
- un **avatar illustré** qui change d'expression selon ce qui est dit,
- parfois une **image d'illustration** (photo réaliste, illustration, maquette d'écran),
- des **sous-titres** synchronisés mot à mot.

Contenu type : explications courtes de 20 à 60 secondes (business, tech, conseils), 30 s par défaut.

## 2. Comment ça fonctionne techniquement (contraintes à respecter)

- **Format** : 1080 × 1920 px, 30 images/s, MP4.
- **Le montage est une page HTML/CSS/JS** exposant `window.__seek(t)`. Un navigateur sans écran (Chromium) capture la page **image par image**, puis ffmpeg assemble.
  - Donc **tout doit être une fonction du temps `t`** : pas d'animation CSS en temps réel, pas de `transition`, pas de vidéo qui joue seule. Chaque état visuel se calcule à partir de `t`.
  - Les effets sont des **courbes d'animation** (position, échelle, rotation, opacité, flou, masque) évaluées à chaque image. Tout effet qu'on sait exprimer ainsi est faisable : apparition lettre par lettre, flou qui se précise, glissement, ressort, parallaxe, zoom lent, etc.
  - Tout ce qui est **rendu en HTML/CSS/SVG** est possible (dégradés, ombres, bordures, formes, SVG animé, grilles, effets de profondeur en CSS 3D). Ce qui est **difficile** : vraie 3D temps réel, particules lourdes, vidéo intégrée.
- **Polices** : uniquement des polices **libres (OFL) embarquées** dans le projet. Aujourd'hui : Fredoka, Archivo, Space Grotesk, Caveat. On peut en ajouter n'importe quelle OFL (Google Fonts), donc **n'hésite pas à proposer une police précise**.
- **Zones de sécurité** : la bande haute (y < 400 px) est **réservée aux sous-titres** (une seule ligne, 17 caractères max par segment). Les autres éléments commencent plus bas. Les interfaces des plateformes mangent aussi le bas et le côté droit (boutons like/partage) : garder les éléments importants dans la zone centrale.
- **Sous-titres** : activables, en haut ou en bas, avec un style (plusieurs variantes possibles). Ils suivent la voix mot à mot.
- **Rythme** : Claude (le modèle) écrit le script ET un plan de montage JSON. Chaque scène choisit une **mise en page**, un **fond**, et des **repères** calés sur un mot précis dit à voix haute (changement d'expression, apparition d'un élément de liste, bruitage).

## 3. Ce qui est paramétrable aujourd'hui (une DA = un jeu de réglages)

Chaque persona a **une DA** qui contient :

| Réglage | Valeurs actuelles |
|---|---|
| Palette | 8 couleurs (fonds, texte, accent, etc.) |
| Police | Fredoka / Archivo / Space Grotesk / Caveat |
| Style de cartes | `torn` (papier déchiré) / `flat` / `sticker` |
| Fond | `paper` / `grid` / `notebook` / `kraft` / `solid`, avec 3 variantes par scène (principal, secondaire, sombre) |
| Mouvement | `stop motion` (12 i/s saccadé) / `fluide` |
| Transitions | liste autorisée (coupe franche, glissement, etc.) |
| Sous-titres | actif ou non, haut/bas, style |
| Densité | quantité de texte à l'écran |
| Règles de montage | texte libre injecté dans le prompt de Claude |
| Avatar | style graphique, pack d'images d'expressions |
| Voix par défaut | choisie selon le genre |

### Mises en page (layouts) existantes

| Layout | Usage |
|---|---|
| `hook` | accroche d'ouverture, gros texte |
| `title` | titre + badge, point de repère |
| `list` | liste d'éléments qui apparaissent un à un, calés sur la voix |
| `avatar` | l'avatar parle, avec une carte de texte |
| `word` | un seul mot en très gros, mise en avant |
| `photo` | illustration encadrée (polaroid ou cadre simple) |
| `logo` | logo / marque |

### Avatar

Image détourée (PNG sur fond transparent) tirée d'un **pack de ~28 poses** (content, surpris, pleure, pointe du doigt, tape sur ordinateur, etc.), choisie scène par scène et **changée sur un mot précis**. Entrées possibles : tête seule, buste, "peek" (apparaît depuis un bord), miroir. Le style de l'avatar est libre (chibi, 3D, pixel art, etc.) : on le génère à partir de la fiche du persona.

### DA existantes (11 modèles)

papercraft pastel, brutalisme, cahier d'écolier, néon nuit, kraft carnet, luxe minimal, pop jaune, trois variantes "Atelier" (crème + une couleur : vert, bleu, bordeaux), et "Terminal" (fond nuit quadrillé, vert menthe, cartes plates, coupes franches).

## 4. Notre problème

Les DA actuelles sont **correctes mais pas marquantes**. Elles ressemblent trop à des "slides animées". On veut des vidéos qu'on reconnaît à la première seconde et qui donnent une impression de **produit soigné**, pas de template générique.

## 5. Deux références que nous aimons (captures jointes)

### Référence 1 : `ref-1-ecran-ordinateur.webp` (fond orange, fenêtre d'ordinateur)

Ce qui marche :
- **Le contenu est présenté dans une fenêtre d'ordinateur** (barre de titre avec les trois points rouge/orange/vert, bordure noire épaisse, coins arrondis). Ça donne tout de suite une impression "on regarde un écran", très tech et très lisible.
- **Contraste fort** : fond orange saturé, fenêtre claire, intérieur sombre. Une seule couleur dominante.
- **Le mot-clé** ("visual explainers") est dans une **étiquette** pleine couleur (blanche sur orange) posée au milieu de l'écran, avec coins arrondis.
- **L'avatar dépasse du cadre** (pixel art, casque, ordinateur portable), devant la fenêtre : profondeur, personnalité. Son expression colle à ce qui est dit.
- Petits éléments graphiques simples autour (traits d'exclamation jaunes).
- Bonus : l'intérieur de la fenêtre montre un **visuel riche** (schéma isométrique d'un système, journal d'événements), pas juste du texte.

### Référence 2 : `ref-2-typo-escalier.png` (fond clair quadrillé, escalier 3D)

Ce qui marche :
- **Typographie élégante**, grande, avec **hiérarchie dans la phrase** : "And the step that" en gris, "matters" en noir gras, "most" qui apparaît **flou puis net**. Le mot important est le plus marqué.
- **Apparition du texte très propre** (flou qui se précise, mot par mot, calé sur la voix).
- **Un seul visuel central** : un escalier en volume (0→10, 10→100, 100→1K, 1K→100K) avec un drapeau au sommet, et des pastilles (initiales) qui montent. Le visuel **illustre littéralement** l'idée dite.
- Fond très sobre (papier quadrillé fin), ombres douces, police monospace pour les chiffres. Beaucoup d'air.
- Texte en haut, illustration au milieu : composition simple et lisible.

### Ce qu'ils ont en commun

Très **peu d'éléments** à l'écran, mais **chacun est soigné** : une identité claire (une couleur dominante ou une neutralité totale), une bonne police, des animations propres, un **visuel central qui illustre le propos**, et un contraste net entre ce qui est important et le reste.

## 6. Ce qu'on te demande

Propose **3 à 5 nouvelles directions artistiques** distinctes. Pour chacune :

1. **Nom et idée en une phrase** (l'ambiance, pour qui, pour quel type de sujet).
2. **Palette** (couleurs exactes en hex), **police(s)** libres (Google Fonts), hiérarchie typographique (titre, mot-clé, texte courant, sous-titres).
3. **Cadre / décor** : fenêtre d'ordinateur, carte, fond quadrillé, etc. Comment le contenu est présenté.
4. **Maquettes de 4 écrans** par DA (1080 × 1920) : accroche, scène avec avatar, liste, mot en gros ; plus une scène avec illustration si pertinent.
5. **Animations** décrites précisément : comment chaque élément entre (durée en secondes, courbe, ordre) et sort, avec uniquement des effets calculables à partir du temps `t`.
6. **Avatar** : comment il s'intègre (devant/derrière le cadre, taille, entrée, expressions utiles), et quel style graphique irait avec cette DA.
7. **Sous-titres** : emplacement et style cohérents avec la DA, dans la bande haute réservée.
8. Ce qui, dans la DA, est **réglable** (couleurs, police) et ce qui est **structurel** (nouvelles mises en page à coder).

Pistes qu'on aimerait voir explorées (pas obligatoires) :
- une DA "**fenêtre d'ordinateur**" inspirée de la référence 1, avec variantes de couleur dominante ;
- une DA **éditoriale / typographique** inspirée de la référence 2 (mots qui se précisent, hiérarchie gris/noir, un seul visuel central) ;
- une DA **sombre et technique** (terminal, interface de code) ;
- une DA **chaleureuse et organique** (papier, grain, écriture manuscrite) pour un autre ton ;
- de nouvelles **mises en page** : visuel central + texte au-dessus (comme l'escalier), comparaison avant/après, schéma qui se construit, chiffre clé géant, citation.

## 7. Ce qu'on fera du résultat

On implémentera les propositions retenues dans le moteur de rendu (HTML/CSS/JS piloté par `t`) comme nouvelles DA et nouvelles mises en page. Donc : **sois précis sur les valeurs** (hex, px, secondes, courbes) plutôt que descriptif, et dis clairement quand une idée demande une nouvelle mise en page plutôt qu'un simple réglage de couleurs.
