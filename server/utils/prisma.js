// server/utils/prisma.js
// Singleton PrismaClient pour éviter les connexions multiples en dev (Nuxt hot reload)
const { PrismaClient } = require('@prisma/client');

let prisma;

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient();
} else {
  if (!global._prisma) {
    global._prisma = new PrismaClient();
  }
  prisma = global._prisma;
}

module.exports = { prisma };