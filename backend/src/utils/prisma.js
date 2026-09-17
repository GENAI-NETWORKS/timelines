const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL + (process.env.DATABASE_URL?.includes('?') ? '&' : '?') +
           'connect_timeout=30&pool_timeout=30&connection_limit=5',
    },
  },
});

// Keep-alive ping every 4 minutes to prevent MySQL idle timeout (Hostinger kills at 5 min)
setInterval(async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    // Silently ignore — Prisma will auto-reconnect on next query
  }
}, 4 * 60 * 1000);

module.exports = prisma;
