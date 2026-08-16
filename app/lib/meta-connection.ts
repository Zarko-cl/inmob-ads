import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";

// Cada organización tiene (por ahora) una única conexión de Meta activa — ver M1/M2.
export async function getActiveMetaConnection(organizationId: string) {
  const connection = await prisma.metaConnection.findFirst({
    where: { organizationId, status: "ACTIVA" },
  });
  if (!connection) return null;
  return { ...connection, accessToken: decrypt(connection.accessTokenEncrypted) };
}
