/**
 * Recense les medias qui ne sont plus references par aucun contenu, aucune
 * version et aucune face ref, puis les supprime sur demande.
 *
 * Avant que la suppression d un contenu efface ses fichiers, chaque suppression
 * laissait son media derriere elle. Ce script rattrape cet historique.
 *
 * Par defaut il n affiche que ce qu il ferait. La suppression exige --delete.
 *
 *   node scripts/cleanup-orphan-media.cjs            # inventaire seul
 *   node scripts/cleanup-orphan-media.cjs --delete   # supprime reellement
 */
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');

function loadEnvFile(envPath) {
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

function isAbsoluteHttpUrl(value) {
  return /^https?:\/\//i.test(String(value || '').trim());
}

/** Nom de fichier d une URL locale type /api/media/generated/xxx.mp4 */
function localFilenameFromUrl(value) {
  const raw = String(value || '').trim();
  if (!raw || isAbsoluteHttpUrl(raw)) return null;

  const withoutQuery = raw.split('?')[0];
  const filename = withoutQuery.split('/').filter(Boolean).pop();
  if (!filename) return null;

  try {
    return decodeURIComponent(filename);
  } catch {
    return filename;
  }
}

function formatSize(bytes) {
  const value = Number(bytes || 0);
  if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} Mo`;
  if (value >= 1024) return `${(value / 1024).toFixed(0)} Ko`;
  return `${value} o`;
}

async function collectReferencedMedia(prisma) {
  // Tout ce qui est encore utilise, quelle que soit sa provenance.
  const referencedUrls = new Set();
  const referencedFilenames = new Set();

  function remember(value) {
    const raw = String(value || '').trim();
    if (!raw) return;
    referencedUrls.add(raw);
    const filename = localFilenameFromUrl(raw);
    if (filename) referencedFilenames.add(filename);
    // Une URL Blob garde le nom de fichier dans son chemin: on le retient aussi
    // pour ne jamais supprimer un local encore reference sous une autre forme.
    if (isAbsoluteHttpUrl(raw)) {
      const blobName = raw.split('?')[0].split('/').filter(Boolean).pop();
      if (blobName) referencedFilenames.add(decodeURIComponent(blobName));
    }
  }

  const contents = await prisma.generatedContent.findMany({ select: { imageUrl: true } });
  contents.forEach((row) => remember(row.imageUrl));

  try {
    const versions = await prisma.contentVersion.findMany({ select: { imageUrl: true } });
    versions.forEach((row) => remember(row.imageUrl));
  } catch (error) {
    console.warn('[avertissement] versions illisibles, elles seront ignorees:', error?.message);
  }

  // Les face refs ne doivent jamais etre considerees comme orphelines.
  const profiles = await prisma.profile.findMany({ select: { faceRefPath: true } });
  profiles.forEach((row) => remember(row.faceRefPath));

  return { referencedUrls, referencedFilenames };
}

async function scanLocalFiles(referencedFilenames) {
  const generatedDir = path.join(process.cwd(), 'storage', 'uploads', 'generated');
  if (!fs.existsSync(generatedDir)) {
    return { orphans: [], total: 0 };
  }

  const entries = await fsp.readdir(generatedDir, { withFileTypes: true });
  const orphans = [];
  let total = 0;

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    total += 1;
    if (referencedFilenames.has(entry.name)) continue;

    const fullPath = path.join(generatedDir, entry.name);
    const stat = await fsp.stat(fullPath).catch(() => null);
    orphans.push({ name: entry.name, path: fullPath, size: stat?.size || 0 });
  }

  return { orphans, total };
}

async function scanBlobFiles(referencedUrls, referencedFilenames) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return { orphans: [], total: 0, skipped: true };
  }

  const { list } = await import('@vercel/blob');
  const orphans = [];
  let total = 0;
  let cursor;

  do {
    const page = await list({ cursor, limit: 1000 });
    for (const blob of page.blobs) {
      total += 1;
      const name = blob.pathname.split('/').filter(Boolean).pop();
      // On ne touche pas aux face refs, rangees dans leur propre prefixe.
      if (blob.pathname.startsWith('face-refs/')) continue;
      if (referencedUrls.has(blob.url) || (name && referencedFilenames.has(name))) continue;

      orphans.push({ name: blob.pathname, url: blob.url, size: blob.size || 0 });
    }
    cursor = page.cursor;
  } while (cursor);

  return { orphans, total, skipped: false };
}

async function main() {
  loadEnvFile(path.resolve(process.cwd(), '.env'));
  loadEnvFile(path.resolve(process.cwd(), '.env.local'));

  const shouldDelete = process.argv.includes('--delete');

  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL absente. Verifiez .env.local');
    process.exit(2);
  }

  const { PrismaClient } = require('@prisma/client');
  // Meme adaptateur que l application (WebSockets sur 443).
  const { PrismaNeon } = await import('@prisma/adapter-neon');
  const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }) });

  try {
    await prisma.$connect();

    const { referencedUrls, referencedFilenames } = await collectReferencedMedia(prisma);
    console.log(`Medias encore references: ${referencedUrls.size}`);

    const local = await scanLocalFiles(referencedFilenames);
    const blob = await scanBlobFiles(referencedUrls, referencedFilenames);

    const localSize = local.orphans.reduce((sum, item) => sum + item.size, 0);
    const blobSize = blob.orphans.reduce((sum, item) => sum + item.size, 0);

    console.log('');
    console.log(`Disque local : ${local.orphans.length} orphelin(s) sur ${local.total} fichier(s) — ${formatSize(localSize)}`);
    local.orphans.forEach((item) => console.log(`  [local] ${item.name} (${formatSize(item.size)})`));

    if (blob.skipped) {
      console.log('Blob : ignore (BLOB_READ_WRITE_TOKEN absente)');
    } else {
      console.log(`Blob : ${blob.orphans.length} orphelin(s) sur ${blob.total} fichier(s) — ${formatSize(blobSize)}`);
      blob.orphans.forEach((item) => console.log(`  [blob] ${item.name} (${formatSize(item.size)})`));
    }

    if (!shouldDelete) {
      console.log('');
      console.log(`Inventaire seul: rien n a ete supprime. Espace recuperable: ${formatSize(localSize + blobSize)}`);
      console.log('Relancez avec --delete pour supprimer reellement.');
      return;
    }

    let deleted = 0;
    let failed = 0;

    for (const item of local.orphans) {
      try {
        await fsp.unlink(item.path);
        deleted += 1;
      } catch (error) {
        failed += 1;
        console.error(`[echec] ${item.name}: ${error?.message}`);
      }
    }

    if (!blob.skipped && blob.orphans.length) {
      const { del } = await import('@vercel/blob');
      for (const item of blob.orphans) {
        try {
          await del(item.url);
          deleted += 1;
        } catch (error) {
          failed += 1;
          console.error(`[echec] ${item.name}: ${error?.message}`);
        }
      }
    }

    console.log('');
    console.log(`Supprimes: ${deleted} — Echecs: ${failed} — Espace libere: ${formatSize(localSize + blobSize)}`);
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
