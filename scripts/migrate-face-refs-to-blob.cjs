/**
 * Rapatrie vers le Blob les face refs restees sur le disque local.
 *
 * Une face ref produite par le pipeline de generation etait ecrite en local sans
 * consulter le Blob: elle devenait introuvable depuis tout autre environnement
 * partageant la meme base, et la generation echouait avec
 * "Face reference file not found". Le code ne le fait plus; ce script rattrape
 * l existant.
 *
 * Par defaut il n affiche que ce qu il ferait. L envoi exige --upload.
 * Le fichier local n est jamais supprime.
 *
 *   node scripts/migrate-face-refs-to-blob.cjs            # inventaire seul
 *   node scripts/migrate-face-refs-to-blob.cjs --upload   # envoie et met a jour la base
 */
const fs = require('node:fs');
const path = require('node:path');

function loadEnvFile(envPath) {
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

const ROOT = process.cwd();
loadEnvFile(path.join(ROOT, '.env'));
loadEnvFile(path.join(ROOT, '.env.local'));

function isHttpUrl(value) {
  return /^https?:\/\//i.test(String(value || '').trim());
}

/** Memes emplacements que server/utils/faceRefReader.js. */
function resolveLocalFaceRef(rawPath) {
  const raw = String(rawPath || '').trim();
  if (!raw) return '';

  const basename = path.basename(raw);
  const candidates = [
    path.isAbsolute(raw) ? raw : '',
    path.join(ROOT, raw.replace(/^\/+/, '')),
    path.join(ROOT, 'public', raw.replace(/^\/+/, '')),
    path.join(ROOT, 'public', 'uploads', 'face-refs', basename),
    path.join(ROOT, 'storage', 'uploads', 'face-refs', basename),
  ].filter(Boolean);

  return candidates.find((candidate) => fs.existsSync(candidate)) || '';
}

function mimeFromExtension(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  return 'image/jpeg';
}

(async () => {
  const shouldUpload = process.argv.includes('--upload');

  if (!String(process.env.BLOB_READ_WRITE_TOKEN || '').trim()) {
    console.error('BLOB_READ_WRITE_TOKEN absent: impossible d envoyer sur le Blob.');
    process.exit(1);
  }

  const { pathToFileURL } = require('node:url');
  const { PrismaClient } = require(path.join(ROOT, 'node_modules/@prisma/client'));
  const adapterEntry = require.resolve('@prisma/adapter-neon', { paths: [ROOT] });
  const { PrismaNeon } = await import(pathToFileURL(adapterEntry).href);
  const { put } = require(path.join(ROOT, 'node_modules/@vercel/blob'));

  const prisma = new PrismaClient({
    adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }),
  });

  const profiles = await prisma.profile.findMany({
    where: { NOT: { faceRefPath: null } },
    select: { id: true, name: true, faceRefPath: true },
  });

  const summary = { total: profiles.length, alreadyRemote: 0, migrated: 0, missingLocalFile: 0, failed: 0 };

  for (const profile of profiles) {
    if (isHttpUrl(profile.faceRefPath)) {
      summary.alreadyRemote += 1;
      continue;
    }

    const localPath = resolveLocalFaceRef(profile.faceRefPath);
    if (!localPath) {
      summary.missingLocalFile += 1;
      console.log(`[introuvable] ${profile.name}: ${profile.faceRefPath}`);
      continue;
    }

    if (!shouldUpload) {
      summary.migrated += 1;
      console.log(`[a migrer]    ${profile.name}: ${localPath}`);
      continue;
    }

    try {
      const buffer = fs.readFileSync(localPath);
      const extension = (path.extname(localPath).replace('.', '') || 'jpg').toLowerCase();
      const pathname = `face-refs/${profile.id}/${Date.now()}-migrated.${extension}`;

      const uploaded = await put(pathname, buffer, {
        access: 'public',
        addRandomSuffix: false,
        contentType: mimeFromExtension(localPath),
      });

      await prisma.profile.update({
        where: { id: profile.id },
        data: { faceRefPath: uploaded.url },
      });

      summary.migrated += 1;
      console.log(`[migre]       ${profile.name} -> ${uploaded.url}`);
    } catch (error) {
      summary.failed += 1;
      console.error(`[echec]       ${profile.name}: ${error.message}`);
    }
  }

  console.log('');
  console.log(summary);
  if (!shouldUpload && summary.migrated) {
    console.log('Rien n a ete envoye. Relancer avec --upload pour appliquer.');
  }

  await prisma.$disconnect();
})().catch((error) => {
  console.error('ERREUR:', error.message);
  process.exit(1);
});
