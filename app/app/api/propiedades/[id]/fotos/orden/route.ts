import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { resolveOrganizationForUser } from "@/lib/org";
import { reordenarFotos } from "@/lib/fotos";

// Guarda el orden de las fotos de una propiedad.
//
// El orden importa más allá de lo estético: el wizard de campaña arma el carrusel
// tomando las primeras fotos en este orden, y la primera es la que se muestra como
// portada en el listado de propiedades.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "No autorizado" }, { status: 401 });

  const organization = await resolveOrganizationForUser(user);
  if (!organization) return Response.json({ error: "No hay organización" }, { status: 400 });

  const { id } = await params;
  const property = await prisma.property.findFirst({
    where: { id, organizationId: organization.id },
    select: { id: true },
  });
  if (!property) return Response.json({ error: "Propiedad no encontrada" }, { status: 404 });

  let ids: unknown;
  try {
    ({ ids } = await request.json());
  } catch {
    return Response.json({ error: "Petición inválida" }, { status: 400 });
  }
  if (!Array.isArray(ids) || ids.some((i) => typeof i !== "string")) {
    return Response.json({ error: "Lista de fotos inválida" }, { status: 400 });
  }

  try {
    const ordenadas = await reordenarFotos(ids as string[], property.id, organization.id);
    return Response.json({ ordenadas });
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : "No se pudo guardar el orden.";
    return Response.json({ error: mensaje }, { status: 400 });
  }
}
