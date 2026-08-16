import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { resolveOrganizationForUser } from "@/lib/org";
import { getActiveMetaConnection } from "@/lib/meta-connection";
import { borrarCampanas, confirmacionValida, PALABRA_CONFIRMACION } from "@/lib/borrado";
import { registrarAuditoria } from "@/lib/auditoria";
import { urlDeLaApp } from "@/lib/urls";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return Response.redirect(urlDeLaApp("/login", request));

  const organization = await resolveOrganizationForUser(user);
  if (!organization) return new Response("No hay organización.", { status: 400 });

  const { id } = await params;
  const campaign = await prisma.campaign.findFirst({
    where: { id, organizationId: organization.id },
  });
  if (!campaign) return new Response("Campaña no encontrada.", { status: 404 });

  const form = await request.formData();
  // La confirmación se valida en el servidor: el navegador es manipulable.
  if (!confirmacionValida(form.get("confirmacion"))) {
    return new Response(
      `Para borrar hay que escribir “${PALABRA_CONFIRMACION}” en el campo de confirmación.`,
      { status: 400 }
    );
  }

  const connection = await getActiveMetaConnection(organization.id);
  const resultado = await borrarCampanas([campaign], connection?.accessToken ?? null);

  if (resultado.errores.length > 0) {
    const destino = urlDeLaApp(`/campanas/${campaign.id}`, request);
    destino.searchParams.set("estado", "error");
    destino.searchParams.set("motivo", `No se pudo borrar en Meta: ${resultado.errores.join("; ")}`);
    return Response.redirect(destino);
  }

  await registrarAuditoria({
    organizationId: organization.id,
    actor: { id: user.id, email: user.email },
    action: "CAMPANA_BORRADA",
    entityType: "Campaign",
    entityId: campaign.id,
    metadata: { nombre: campaign.name, metaCampaignId: campaign.metaCampaignId },
  });

  const destino = urlDeLaApp("/campanas", request);
  destino.searchParams.set("borrado", campaign.name);
  return Response.redirect(destino);
}
