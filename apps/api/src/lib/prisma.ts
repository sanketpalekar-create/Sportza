import { PrismaClient } from "@prisma/client";
import { isServerless } from "./runtime";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

function createPrismaClient() {
  return new PrismaClient({
    log:
      process.env.NODE_ENV === "development" && !isServerless
        ? ["query", "error", "warn"]
        : ["error"],
  });
}

/**
 * Reuse a single PrismaClient across hot reloads (dev) and serverless
 * invocations (Vercel) to avoid exhausting MySQL connection limits.
 * Prefer DATABASE_URL with `?connection_limit=1` (or similar) on Vercel.
 */
export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production" || isServerless) {
  globalForPrisma.prisma = prisma;
}

export default prisma;
