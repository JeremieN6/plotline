// server/utils/prisma.js
// Singleton PrismaClient pour éviter les connexions multiples en dev (Nuxt hot reload)
// Adapté pour Prisma v7 : il faut fournir un `adapter` ou `accelerateUrl`.
const { PrismaClient } = require('@prisma/client');
// Use Prisma's official Postgres adapter implementation
const { PrismaPg } = require('@prisma/adapter-pg');
const fs = require('fs');
const path = require('path');

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
  if (!global._prisma) {
    global._prisma = new PrismaClient({ adapter });
  }
  prisma = global._prisma;
}

module.exports = { prisma };