const { PrismaClient } = require('@prisma/client');
const config = require('../config');
const logger = require('../utils/logger');

if (!process.env.DATABASE_URL && config.database) {
  const { user, password, host, port, database } = config.database;
  process.env.DATABASE_URL = `postgresql://${user}:${password}@${host}:${port}/${database}`;
}

// Prevent multiple instances of Prisma Client in development
const globalForPrisma = global;

const prisma = globalForPrisma.prisma || new PrismaClient({
  log: [
    { emit: 'event', level: 'query' },
    { emit: 'stdout', level: 'error' },
    { emit: 'stdout', level: 'warn' },
  ],
});

// Log slow queries (>1000ms)
prisma.$on('query', (e) => {
  if (e.duration > 1000) {
    logger.warn(`Slow Prisma query (${e.duration}ms): ${e.query.substring(0, 100)}...`);
  }
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

module.exports = prisma;
