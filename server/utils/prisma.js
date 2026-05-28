// server/utils/prisma.js
// Singleton PrismaClient pour éviter les connexions multiples en dev (Nuxt hot reload)
// Adapté pour Prisma v7 : il faut fournir un `adapter` ou `accelerateUrl`.
const { PrismaClient } = require('@prisma/client');
// Use Prisma's official Postgres adapter implementation
const { PrismaPg } = require('@prisma/adapter-pg');

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