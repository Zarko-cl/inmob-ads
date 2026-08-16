import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

// Los administradores de agencia (organizationId null) administran varias
// inmobiliarias. Todavía no hay un selector de organización en la UI, así que por
// ahora actúan sobre la primera organización que exista.
// TODO (M2, próxima iteración): reemplazar por un selector real cuando haya más
// de una organización en uso.
export async function resolveOrganizationForUser(user: CurrentUser) {
  if (user.organization) return user.organization;
  return prisma.organization.findFirst();
}
