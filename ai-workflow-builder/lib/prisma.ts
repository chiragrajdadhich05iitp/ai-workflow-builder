import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createClient() {
  const client = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

  // Retry middleware for Neon free-tier cold starts.
  // P1001 = "Can't reach database", P2024 = pool timeout.
  // Both are transient on Neon — retry up to 3 times with backoff.
  client.$use(async (params, next) => {
    const MAX = 3;
    for (let attempt = 1; attempt <= MAX; attempt++) {
      try {
        return await next(params);
      } catch (err: any) {
        const code = err?.code as string | undefined;
        const transient = code === "P1001" || code === "P2024" ||
          (err?.message as string | undefined)?.includes("Can't reach database");

        if (transient && attempt < MAX) {
          await new Promise((r) => setTimeout(r, attempt * 1500));
          continue;
        }
        throw err;
      }
    }
  });

  return client;
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
