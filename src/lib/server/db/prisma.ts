import { PrismaClient } from "@prisma/client";

declare global {
  var __cbtmanPrisma: PrismaClient | undefined;
}

function isSqliteFileUrl(url: string | undefined): boolean {
  return Boolean(url?.trim().startsWith("file:"));
}

async function applySqlitePragmas(client: PrismaClient): Promise<void> {
  if (!isSqliteFileUrl(process.env.DATABASE_URL)) return;
  await client.$queryRawUnsafe("PRAGMA journal_mode=WAL");
  await client.$queryRawUnsafe("PRAGMA busy_timeout=5000");
}

export const prisma = globalThis.__cbtmanPrisma ?? new PrismaClient();

void applySqlitePragmas(prisma).catch(() => undefined);

if (process.env.NODE_ENV !== "production") {
  globalThis.__cbtmanPrisma = prisma;
}
