import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

export async function connectPrisma() {
  try {
    await prisma.$connect();
    console.log('[Prisma] Connected to database successfully.');
  } catch (err) {
    console.error('[Prisma] Connection error:', err);
  }
}
