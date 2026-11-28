# Médias sur le disque du VPS

Les fichiers (images, vidéos, voix, fiches) sont écrits dans `/srv/plotline-media`, **hors du dossier du projet**, et
servis par nginx sous `https://plotline.sassify.fr/media/`. Tant que `MEDIA_STORAGE=disk` n'est pas posé, rien ne change.

Comme avec Vercel Blob, ces fichiers sont **publics** : toute personne qui connaît une adresse peut l'ouvrir. Les
transcriptions en cache sont les seules à être refusées par nginx.

## Ordre à respecter

1. Déployer le code (sans effet tant que les variables ne sont pas posées).
2. Créer le dossier.
3. Régler nginx et vérifier.
4. Poser les variables et redémarrer.
5. Vérifier avec un vrai fichier.

## 1. Dossier

```bash
install -d -m 755 /srv/plotline-media
```

## 2. nginx (`/etc/nginx/sites-available/plotline`)

Sauvegarder d'abord le fichier :

```bash
cp /etc/nginx/sites-available/plotline /root/plotline.nginx.bak-media
```

Dans le bloc `server` qui écoute en HTTPS, ajouter :

```nginx
location ^~ /media/faceless-transcripts/ {
    return 404;
}

location ^~ /media/ {
    alias /srv/plotline-media/;
    autoindex off;
    add_header Cache-Control "public, max-age=2592000, immutable";
    add_header X-Content-Type-Options "nosniff";
    add_header Content-Security-Policy "default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'";
}

# Import de contenus : le fichier traverse nginx (150 Mo max pour une video).
location = /api/content/import-file {
    client_max_body_size 160m;
    proxy_request_buffering off;
    proxy_read_timeout 600s;
    proxy_send_timeout 600s;
    # Recopier ici les lignes proxy_pass et proxy_set_header du bloc "location /" existant.
}
```

Vérifier puis recharger (ne recharger que si `nginx -t` répond « successful ») :

```bash
nginx -t
```

```bash
systemctl reload nginx
```

Contrôle : ce fichier d'essai doit répondre `200`.

```bash
printf '{}' > /srv/plotline-media/essai.json
```

```bash
curl -sI https://plotline.sassify.fr/media/essai.json
```

```bash
rm /srv/plotline-media/essai.json
```

Un `403` signifie que nginx ne peut pas lire le dossier ; un `404`, que le bloc `location` n'est pas pris en compte.

## 3. Variables (`/srv/saas/plotline/.env.local`)

Ajouter ces deux lignes, sans toucher aux autres. **Garder `BLOB_READ_WRITE_TOKEN`** : les anciens fichiers sont encore
chez Vercel. `BASE_URL` doit déjà valoir `https://plotline.sassify.fr`.

```
MEDIA_STORAGE=disk
MEDIA_STORAGE_DIR=/srv/plotline-media
```

Puis redémarrer en relisant l'environnement :

```bash
cd /srv/saas/plotline && pm2 reload plotline --update-env
```

Si les nouveaux fichiers ne sont pas pris en compte, vérifier comment `ecosystem.config.cjs` charge `.env.local`.

## 4. Vérification

Dans « Mes créations », importer une petite image : elle doit s'afficher, et le fichier doit apparaître ici :

```bash
find /srv/plotline-media -type f | head
```

Tester ensuite une vidéo de plus de 25 Mo (c'est elle qui vérifie le réglage nginx de l'import).

## Revenir en arrière

Retirer `MEDIA_STORAGE=disk` et redémarrer. Les fichiers créés entre-temps restent lisibles (nginx les sert toujours).

## Pendant la période transitoire

- Les fichiers d'avant la bascule restent chez Vercel, illisibles jusqu'au 27/12/2026.
- `node scripts/cleanup-orphan-media.cjs --delete` est **bloqué** en mode disque : il ne connaît pas encore le disque et
  prendrait les originaux Vercel pour des orphelins une fois les adresses changées.
- En développement (`npm run dev`), l'écriture de médias est refusée : la base est partagée avec le site en ligne.
  **Ne pas lancer de génération payante en local** : elle serait payée puis refusée à l'enregistrement.
  `MEDIA_ALLOW_DEV_WRITES=true` lève le blocage pour un test dont on supprime ensuite les données.
- **Aucune sauvegarde n'est encore en place.**
