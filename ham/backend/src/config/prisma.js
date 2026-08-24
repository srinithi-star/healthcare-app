const { PrismaClient } = require('@prisma/client');

// Single shared Prisma instance across the app (avoids exhausting DB
// connections in dev with hot-reload, and is the recommended pattern).
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

module.exports = prisma;
