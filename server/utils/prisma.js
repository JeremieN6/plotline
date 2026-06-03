// server/utils/prisma.js
// Singleton PrismaClient pour éviter les connexions multiples en dev (Nuxt hot reload)
// Adapté pour Prisma v7 : il faut fournir un `adapter` ou `accelerateUrl`.
import { PrismaClient } from '@prisma/client';
// Use Prisma's official Postgres adapter implementation
import { PrismaPg } from '@prisma/adapter-pg';
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
  throw new Error('Missing DATABASE_URL environment variable. Set it in your env or .env file.');
}

const adapter = new PrismaPg({ connectionString: databaseUrl });

let prisma;

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient({ adapter });
} else {
  if (!globalThis._prisma) {
    globalThis._prisma = new PrismaClient({ adapter });
  }
  prisma = globalThis._prisma;
}

export { prisma };
export default { prisma };