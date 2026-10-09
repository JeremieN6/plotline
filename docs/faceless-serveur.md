# Vidéo faceless : préparer le serveur

Le montage faceless est rendu sur le VPS (Chromium sans tête + ffmpeg). Tout ce
qui vient du dépôt est déjà en place après un déploiement ; il reste trois
réglages à faire une fois sur le serveur.

## Ce qui est dans le dépôt (rien à faire)

- `resources/faceless/fonts/Fredoka.ttf` : police des textes (licence SIL OFL 1.1,
  `OFL.txt` à côté ; aucune attribution à afficher dans les vidéos).
- `resources/faceless/sfx/**.wav` : les 22 bruitages du catalogue, **synthétisés par
  du code** (`server/utils/facelessSfxSynth.js`), donc sans licence tierce.
  Régénération : `node scripts/faceless-sfx/generate.mjs`.

Les deux dossiers sont lus depuis le dossier courant du processus. pm2 doit donc
démarrer Plotline depuis `/srv/saas/plotline`. Sinon, il faut poser les chemins
absolus dans `FACELESS_ASSETS_DIR` (dossier `resources/faceless`) et
`FACELESS_SFX_DIR` (dossier `resources/faceless/sfx`).

## À faire une fois sur le VPS

1. **Police des emojis** (sinon les emojis sortent en carrés vides) :

   ```bash
   sudo apt-get update && sudo apt-get install -y fonts-noto-color-emoji
   ```

2. **Chromium de Playwright** (déjà présent si le scraping Pinterest fonctionne) :

   ```bash
   cd /srv/saas/plotline && npx playwright install --with-deps chromium
   ```

3. **Variables d'environnement** dans `.env.local`, puis `pm2 reload plotline --update-env` :

   - `ELEVEN_LABS_API_KEY` : obligatoire (voix).
   - `FACELESS_SFX_DIR` : facultatif, pour utiliser un autre pack de sons avec
     les mêmes noms de fichiers (`paper/paper-slide.wav`...). La licence de ce
     pack relève de la personne qui le fournit.
   - `FACELESS_ASSETS_DIR` : facultatif (voir plus haut).

## Vérifier sans dépenser

Sur le serveur, après un premier essai depuis le Studio, la commande suivante
remonte la dernière vidéo d'essai sans aucun appel payant (Claude ou ElevenLabs).
Elle fonctionne seulement après un essai lancé par `scripts/faceless-prototype/e2e.mjs`.

```bash
node scripts/faceless-prototype/e2e.mjs --render
```

Dans les logs pm2, un fichier du thème absent apparaît sous la forme
`[faceless] fichier du theme introuvable`.
