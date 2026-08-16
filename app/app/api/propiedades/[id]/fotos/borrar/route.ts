import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { resolveOrganizationForUser } from "@/lib/org";
import { borrarFotos } from "@/lib/fotos";

// Borra varias fotos de una propiedad de una sola vez (selección con casillas).
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

  // borrarFotos vuelve a filtrar por organización: el navegador es manipulable y
  // alguien podría mandar ids de fotos de otra inmobiliaria.
  const borradas = await borrarFotos(ids as string[], organization.id);
  return Response.json({ borradas });
}
