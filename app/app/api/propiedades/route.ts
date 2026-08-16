import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { resolveOrganizationForUser } from "@/lib/org";
import { urlDeLaApp } from "@/lib/urls";

function num(form: FormData, field: string): number | null {
  const raw = form.get(field);
  if (!raw || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function str(form: FormData, field: string): string | null {
  const raw = String(form.get(field) ?? "").trim();
  return raw || null;
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.redirect(urlDeLaApp("/login", request));

  const organization = await resolveOrganizationForUser(user);
  if (!organization) return new Response("No hay organización.", { status: 400 });

  const form = await request.formData();
  const title = str(form, "title");
  const price = num(form, "price");

  if (!title || price === null) {
    return new Response("Faltan datos obligatorios (título, precio).", { status: 400 });
  }

  const property = await prisma.property.create({
    data: {
      organizationId: organization.id,
      title,
      propertyType: String(form.get("propertyType") ?? "DEPARTAMENTO") as "CASA" | "DEPARTAMENTO" | "OFICINA" | "TERRENO",
      operation: String(form.get("operation") ?? "VENTA") as "VENTA" | "ARRIENDO",
      address: str(form, "address"),
      comuna: str(form, "comuna"),
      region: str(form, "region"),
      price,
      currency: String(form.get("currency") ?? "CLP") as "CLP" | "UF",
      surfaceM2: num(form, "surfaceM2"),
      bedrooms: num(form, "bedrooms"),
      bathrooms: num(form, "bathrooms"),
      description: str(form, "description"),
      agentName: str(form, "agentName"),
      agentEmail: str(form, "agentEmail"),
      agentPhone: str(form, "agentPhone"),
    },
  });

  // El modo simple crea la propiedad desde JavaScript y necesita el id de vuelta;
  // el formulario clásico de /propiedades/nueva espera la redirección de siempre.
  if (request.headers.get("accept")?.includes("application/json")) {
    return Response.json({ id: property.id, title: property.title });
  }
  return Response.redirect(urlDeLaApp(`/propiedades/${property.id}`, request));
}
