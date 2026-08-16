import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";

// Patrón singleton recomendado por Next.js: en desarrollo, el hot-reload
// re-ejecuta este módulo en cada cambio de archivo. Sin esto, cada recarga
// crearía una nueva conexión a la base de datos hasta agotar el límite.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
