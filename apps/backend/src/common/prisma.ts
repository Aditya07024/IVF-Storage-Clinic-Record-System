import { PrismaClient } from '@prisma/client';
import { CONFIG, cleanDatabaseUrl } from './config.js';

const dbUrl = cleanDatabaseUrl(process.env.DATABASE_URL || CONFIG.DATABASE_URL);

export const prisma = dbUrl
  ? new PrismaClient({
      datasources: {
        db: {
          url: dbUrl,
        },
      },
    })
  : new PrismaClient();

export async function connectPrisma() {
  for (let attempt = 1; attempt <= 8; attempt++) {
    try {
      await prisma.$connect();
      console.log('[Prisma] Connected to database successfully.');
      return;
    } catch (err: any) {
      console.warn(`[Prisma] Connection attempt ${attempt}/8 failed (${err.message}). Retrying in 2s...`);
      if (attempt === 8) {
        console.error('[Prisma] Connection retry limit reached. Server will connect lazily on incoming requests.');
      } else {
        await new Promise((res) => setTimeout(res, 2000));
      }
    }
  }
}

export async function withDbRetry<T>(fn: () => Promise<T>, maxRetries = 5, delayMs = 1500): Promise<T> {
  let lastError: any;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      if (attempt < maxRetries && (err.code === 'P1001' || err.message?.includes("Can't reach database server") || err.message?.includes("EADDRINUSE") || err.message?.includes("Closed"))) {
        console.warn(`[Prisma Retry] Transient database connection flicker (Attempt ${attempt}/${maxRetries}), reconnecting in ${delayMs}ms...`);
        try {
          await prisma.$connect();
        } catch {
          // ignore
        }
        await new Promise((res) => setTimeout(res, delayMs));
      } else {
        throw err;
      }
    }
  }
  throw lastError;
}
