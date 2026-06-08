import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var __cbtmanPrisma: PrismaClient | undefined;
}

export const prisma = globalThis.__cbtmanPrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__cbtmanPrisma = prisma;
}
