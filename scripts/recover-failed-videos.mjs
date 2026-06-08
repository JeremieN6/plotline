/**
 * Script one-shot : remet en PENDING les contenus FAILED qui ont une imageUrl
 * valide (la génération a réussi mais le worker a crashé après l'upload).
 *
 * Usage : node scripts/recover-failed-videos.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

const cwd = process.cwd();
loadEnvFile(path.resolve(cwd, '.env'));
loadEnvFile(path.resolve(cwd, '.env.local'));

if (!process.env.DATABASE_URL) {
  console.error('❌  DATABASE_URL manquant dans .env ou .env.local');
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  // Trouver tous les contenus FAILED avec une imageUrl non vide
  const failed = await prisma.generatedContent.findMany({
    where: {
      status: 'FAILED',
      imageUrl: { not: null },
    },
    select: {
      id: true,
      imageUrl: true,
      format: true,
      errorMessage: true,
      influencer: { select: { name: true } },
    },
  });

  if (!failed.length) {
    console.log('✅  Aucun contenu FAILED avec imageUrl trouvé.');
    return;
  }

  console.log(`\n🔍  ${failed.length} contenu(s) FAILED avec imageUrl :\n`);
  for (const c of failed) {
    console.log(`  [${c.id}] ${c.influencer?.name || '?'} – ${c.format} – ${c.imageUrl}`);
    console.log(`    Erreur : ${c.errorMessage || '(aucune)'}\n`);
  }

  // Mise à jour vers PENDING
  const ids = failed.map((c) => c.id);
  const result = await prisma.generatedContent.updateMany({
    where: { id: { in: ids } },
    data: { status: 'PENDING', errorMessage: null },
  });

  console.log(`✅  ${result.count} contenu(s) remis en PENDING. Rafraîchis la page.`);
}

main()
  .catch((err) => {
    console.error('❌  Erreur :', err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
