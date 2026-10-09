# UI.md — Plotline UI kit v1

Référence visuelle : artboard « UI kit Plotline v1 » (canvas Design). Ce fichier fait foi pour l'implémentation.

## Mission pour Claude Code

1. Ajouter les tokens ci-dessous dans la config Tailwind et charger la police Geist (Google Fonts ou `@fontsource/geist-sans` + `geist-mono`).
2. Créer les composants listés dans `components/ui/` (préfixe `Ui`).
3. Remplacer dans **toutes** les pages les éléments natifs ou ad hoc équivalents par ces composants. Ne pas changer la structure des pages, seulement les briques.
4. Pas de couleur en dur dans les pages : uniquement les tokens.
5. Exception : la page « Générateur de personnalité » suit sa maquette dédiée (Main + Generation), à traiter dans une tâche séparée.

## Tokens (tailwind.config)

```js
theme: {
  extend: {
    fontFamily: {
      sans: ['Geist', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      mono: ['"Geist Mono"', 'ui-monospace', 'monospace'],
    },
    colors: {
      bg: '#F7F6F3',
      surface: '#FFFFFF',
      subtle: '#F3F1EC',
      line: { DEFAULT: '#E7E4DE', input: '#E2DED6', soft: '#EFECE6' },
      ink: { DEFAULT: '#1A1917', 2: '#4A4741', muted: '#6B675F' },
      accent: { DEFAULT: '#B9531A', hover: '#8F3F12', soft: '#FBEFE6', ink: '#8F3F12' },
      success: { DEFAULT: '#2F7A4D', soft: '#EAF4EE', ink: '#1F5636' },
      info: { DEFAULT: '#2B5FAA', soft: '#E8EEF8', ink: '#23497F' },
      danger: { DEFAULT: '#B42318', soft: '#FCEDEC', ink: '#8A1C12', line: '#F4C7C2' },
    },
    borderRadius: { tag: '6px', ctl: '10px', card: '14px' },
  },
}
```

Espacements : échelle Tailwind standard, utiliser 1, 2, 3, 4, 6, 8, 12 (4 à 48 px).
Focus : `focus-visible:ring-[3px] ring-accent/20 border-accent` sur tous les contrôles.

## Typographie

| Rôle | Taille / graisse | Usage |
|---|---|---|
| page | 24 / 700, tracking -0.01em | h1 de page |
| section | 20 / 700 | h2 de section |
| card | 15 / 600 | titre de carte |
| body | 14 / 400, leading 1.5 | texte courant |
| label | 13 / 600 | labels de champs, casse normale |
| hint | 12 / 400, ink-muted | aides, métadonnées |
| eyebrow | 12 / 600, uppercase, tracking 0.08em, accent | au-dessus du h1 uniquement |
| mono | 12–13 / 500 | compteurs, progressions |

## Composants

| Composant | Props principales | Notes |
|---|---|---|
| `UiButton` | `variant: primary \| dark \| secondary \| ghost \| danger`, `size: md(44) \| sm(40)`, `icon`, `loading`, `disabled` | Un seul `primary` par écran. `dark` = progression (« Valider et continuer »). |
| `UiIconButton` | `icon`, `label` (aria-label obligatoire) | 44×44 |
| `UiField` | `label`, `hint`, `error`, `for` | Wrapper label + slot + aide/erreur |
| `UiInput` | `v-model`, `invalid` | h-11, rounded-ctl |
| `UiTextarea` | `v-model`, `maxlength` | Compteur affiché seulement au-delà de 80 % |
| `UiSelect` | `v-model`, `options` | Chevron custom |
| `UiSlider` | `v-model`, `min`, `max`, `step` | Valeur en mono à droite du label |
| `UiTagInput` | `v-model: string[]`, `tone: default \| danger` | Entrée pour ajouter, × pour retirer. Remplace toutes les textareas « un élément par ligne ». |
| `UiSegmented` | `v-model`, `options` (2 à 4) | Choix exclusifs courts |
| `UiToggleChips` | `v-model: string[]`, `options` | Multi-choix (plateformes…), `aria-pressed` |
| `UiBadge` | `status: ready \| edited \| profile \| review \| running \| error \| empty` | Pill 12/600 |
| `UiProgress` | `value`, `max`, `label` | Barre 6 px |
| `UiSkeleton` | `lines` | Remplace tout « Chargement… » |
| `UiCard` | slots `title`, `actions`, default | Padding 20, en-tête séparé par un filet |
| `UiAlert` | `tone: error \| info`, `title`, slot action | Erreur = quoi, pourquoi, action |
| `UiEmptyState` | `title`, `text`, slot action | Bordure pointillée |
| `UiSectionNav` | `items: {key,label,status}[]`, `v-model:active` | États : ready, active, running, error, empty |

## Règles

- Un seul bouton primary par écran.
- Liste de valeurs → `UiTagInput`, jamais une textarea « un élément par ligne ».
- 2 à 4 choix exclusifs → `UiSegmented` ; au-delà → `UiSelect`.
- Compteur de caractères visible seulement au-delà de 80 % de la limite.
- Labels en casse normale ; l'eyebrow en majuscules est réservé au titre de page.
- Les erreurs disent quoi, pourquoi, et proposent une action.
- Cibles cliquables ≥ 44 px ; focus visible partout ; `<label>` relié à chaque champ.
- Long formulaire → sections + `UiSectionNav`, un bloc affiché à la fois.

## Ordre de migration

1. Tokens + police (impact global immédiat).
2. `UiButton`, `UiField`, `UiInput`, `UiTextarea`, `UiSelect` → remplacement dans toutes les pages.
3. `UiTagInput` → remplacement des textareas multi-lignes (le modèle de données reste `string[]` ; adapter la sérialisation si elle est aujourd'hui en texte séparé par `\n`).
4. `UiCard`, `UiAlert`, `UiBadge`, `UiEmptyState`, `UiSkeleton`.
5. Ne pas toucher à la mise en page des pages dans cette passe.
