import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { resolveOrganizationForUser } from "@/lib/org";
import { copyEsValido } from "@/lib/copy-limits";
import { urlDeLaApp } from "@/lib/urls";

// Edición manual, aprobación o borrado de una variante de copy.
// Es un formulario HTML normal (no fetch), así que la acción viene en el campo
// "accion" y al final se redirige de vuelta al detalle de la campaña.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return Response.redirect(urlDeLaApp("/login", request));

  const organization = await resolveOrganizationForUser(user);
  if (!organization) return new Response("No hay organización.", { status: 400 });

  const { id } = await params;
  const variante = await prisma.copyVariant.findFirst({
    where: { id, campaign: { organizationId: organization.id } },
  });
  if (!variante) return new Response("Copy no encontrado.", { status: 404 });

  const form = await request.formData();
  const accion = String(form.get("accion") ?? "");
  const volver = urlDeLaApp(`/campanas/${variante.campaignId}`, request);

  if (accion === "borrar") {
    await prisma.copyVariant.delete({ where: { id } });
    return Response.redirect(volver);
  }

  const primaryText = String(form.get("primaryText") ?? "").trim();
  const headline = String(form.get("headline") ?? "").trim();
  const description = String(form.get("description") ?? "").trim() || null;

  if (!primaryText || !headline) {
    return new Response("El texto principal y el título son obligatorios.", { status: 400 });
  }
  if (!copyEsValido({ primaryText, headline, description })) {
    return new Response("Algún campo supera el máximo de caracteres que acepta Meta.", { status: 400 });
  }

  const editado =
    primaryText !== variante.primaryText ||
    headline !== variante.headline ||
    description !== variante.description;

  if (accion === "aprobar") {
    // Solo una variante aprobada por campaña: es la que se usará al crear el
    // anuncio en Meta (M3/M8), así que las demás se desmarcan.
    await prisma.copyVariant.updateMany({
      where: { campaignId: variante.campaignId },
      data: { approved: false },
    });
  }

  await prisma.copyVariant.update({
    where: { id },
    data: {
      primaryText,
      headline,
      description,
      // Si el usuario tocó el texto, deja de ser "generado por IA" tal cual.
      generatedBy: editado ? "MANUAL" : variante.generatedBy,
      approved: accion === "aprobar" ? true : variante.approved,
    },
  });

  return Response.redirect(volver);
}
