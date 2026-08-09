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

function mimeFromExtension(ext) {
  const normalized = String(ext || '').toLowerCase();
  if (normalized === '.png') return 'image/png';
  if (normalized === '.webp') return 'image/webp';
  if (normalized === '.gif') return 'image/gif';
  // Sans ces types video, un mp4 etait servi en image/jpeg par le Blob et le
  // lecteur du navigateur refusait de le lire.
  if (normalized === '.mp4') return 'video/mp4';
  if (normalized === '.webm') return 'video/webm';
  if (normalized === '.mov') return 'video/quicktime';
  return 'image/jpeg';
}

function resolveRelativeCandidates(imageUrl) {
  const raw = String(imageUrl || '').trim();
  if (!raw || isAbsoluteHttpUrl(raw)) return [];

  if (raw.startsWith('/api/media/')) {
    return [raw.slice('/api/media/'.length)];
  }

  if (raw.startsWith('/uploads/')) {
    return [raw.slice('/uploads/'.length)];
  }

  if (raw.startsWith('/')) {
    return [raw.slice(1)];
  }

  return [raw];
}

async function fileExists(filePath) {
  try {
    await fsp.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function resolveLocalFilePathFromImageUrl(imageUrl) {
  const cwd = process.cwd();
  const relativeCandidates = resolveRelativeCandidates(imageUrl);

  const absoluteCandidates = [];
  for (const rel of relativeCandidates) {
    const normalized = rel.split('/').filter(Boolean).join('/');
    if (!normalized) continue;

    absoluteCandidates.push(path.join(cwd, 'storage', 'uploads', ...normalized.split('/')));
    absoluteCandidates.push(path.join(cwd, 'public', 'uploads', ...normalized.split('/')));

    if (normalized.startsWith('generated/')) {
      const filename = path.basename(normalized);
      absoluteCandidates.push(path.join(cwd, 'storage', 'uploads', 'generated', filename));
      absoluteCandidates.push(path.join(cwd, 'public', 'uploads', 'generated', filename));
    }
  }

  for (const candidate of absoluteCandidates) {
    if (await fileExists(candidate)) {
      return candidate;
    }
  }

  return null;
}

async function main() {
  loadEnvFile(path.resolve(process.cwd(), '.env'));
  loadEnvFile(path.resolve(process.cwd(), '.env.local'));

  const dryRun = process.argv.includes('--dry-run');

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL not set. Check .env.local');
    process.exit(2);
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error('BLOB_READ_WRITE_TOKEN not set. Check .env.local');
    process.exit(2);
  }

  const { put } = await import('@vercel/blob');
  const { PrismaClient } = require('@prisma/client');
  // Meme adaptateur que l application (WebSockets sur 443): l adaptateur pg
  // passe par le port 5432, bloque sur certains reseaux.
  const { PrismaNeon } = await import('@prisma/adapter-neon');

  const adapter = new PrismaNeon({ connectionString: databaseUrl });
  const prisma = new PrismaClient({ adapter });

  const stats = {
    total: 0,
    alreadyRemote: 0,
    missingLocalFile: 0,
    migrated: 0,
    failed: 0,
  };

  try {
    await prisma.$connect();

    const contents = await prisma.generatedContent.findMany({
      where: {
        imageUrl: {
          not: null,
        },
      },
      select: {
        id: true,
        imageUrl: true,
      },
    });

    stats.total = contents.length;
    console.log(`Found ${contents.length} generated contents with imageUrl.`);

    for (const item of contents) {
      const rawImageUrl = String(item.imageUrl || '').trim();
      if (!rawImageUrl) continue;

      if (isAbsoluteHttpUrl(rawImageUrl)) {
        stats.alreadyRemote += 1;
        continue;
      }

      const localFilePath = await resolveLocalFilePathFromImageUrl(rawImageUrl);
      if (!localFilePath) {
        stats.missingLocalFile += 1;
        console.log(`[missing] ${item.id} -> ${rawImageUrl}`);
        continue;
      }

      try {
        const buffer = await fsp.readFile(localFilePath);
        const ext = path.extname(localFilePath).toLowerCase() || '.jpg';
        const mime = mimeFromExtension(ext);
        const blobPath = `generated/migrated/${item.id}-${Date.now()}${ext}`;

        if (dryRun) {
          console.log(`[dry-run] ${item.id} ${localFilePath} -> ${blobPath}`);
          continue;
        }

        const uploaded = await put(blobPath, buffer, {
          access: 'public',
          addRandomSuffix: false,
          contentType: mime,
        });

        await prisma.generatedContent.update({
          where: { id: item.id },
          data: { imageUrl: uploaded.url },
        });

        // L historique des versions pointe sur les memes fichiers locaux: sans
        // cette mise a jour, le retour arriere restaurerait une URL morte.
        try {
          await prisma.contentVersion.updateMany({
            where: { contentId: item.id, imageUrl: rawImageUrl },
            data: { imageUrl: uploaded.url },
          });
        } catch (versionError) {
          console.warn(`[versions] ${item.id}: ${versionError?.message || versionError}`);
        }

        stats.migrated += 1;
        console.log(`[migrated] ${item.id} -> ${uploaded.url}`);
      } catch (error) {
        stats.failed += 1;
        console.error(`[failed] ${item.id}: ${error?.message || error}`);
      }
    }

    console.log('--- Migration summary ---');
    console.log(`total=${stats.total}`);
    console.log(`alreadyRemote=${stats.alreadyRemote}`);
    console.log(`missingLocalFile=${stats.missingLocalFile}`);
    console.log(`migrated=${stats.migrated}`);
    console.log(`failed=${stats.failed}`);

    if (dryRun) {
      console.log('Dry-run mode: no database changes were written.');
    }
  } finally {
    try {
      await prisma.$disconnect();
    } catch {
      // no-op
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});