import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

export async function connectPrisma() {
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      await prisma.$connect();
      console.log('[Prisma] Connected to database successfully.');
      return;
    } catch (err: any) {
      console.warn(`[Prisma] Connection attempt ${attempt}/5 failed (${err.message}). Retrying in 1.5s...`);
      if (attempt === 5) {
        console.error('[Prisma] Final connection error after 5 attempts:', err);
      } else {
        await new Promise((res) => setTimeout(res, 1500));
      }
    }
  }
}

export async function withDbRetry<T>(fn: () => Promise<T>, maxRetries = 3, delayMs = 500): Promise<T> {
  let lastError: any;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      if (attempt < maxRetries && (err.code === 'P1001' || err.message?.includes("Can't reach database server") || err.message?.includes("EADDRINUSE"))) {
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
