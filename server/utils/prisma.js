// server/utils/prisma.js
// Utilise @prisma/adapter-neon qui passe par WebSockets (port 443).
// Compatible avec les réseaux d'entreprise qui bloquent le port 5432.
import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import fs from 'node:fs';
import path from 'node:path';

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

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('Missing DATABASE_URL environment variable. Set it in .env.local');
}

function createPrisma() {
  const adapter = new PrismaNeon({ connectionString: databaseUrl });
  return new PrismaClient({ adapter });
}

let prisma;

if (process.env.NODE_ENV === 'production') {
  prisma = createPrisma();
} else {
  if (!globalThis._prisma) {
    globalThis._prisma = createPrisma();
  }
  prisma = globalThis._prisma;
}

export { prisma };
export default { prisma };