import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { resolveOrganizationForUser } from "@/lib/org";
import { getActiveMetaConnection } from "@/lib/meta-connection";
import { cambiarEstadoEnMeta } from "@/lib/meta-sync";
import { registrarAuditoria } from "@/lib/auditoria";
import { urlDeLaApp } from "@/lib/urls";

// Pausa o activa una campaña en Meta.
//
// ACTIVAR EMPIEZA A GASTAR DINERO REAL. Por eso se exige el campo `confirmo`, que
// solo envía la página de confirmación /campanas/[id]/activar. Pausar no necesita
// confirmación: siempre es la acción segura.
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
  if (!campaign.metaCampaignId) {
    return new Response("Esta campaña todavía no existe en Meta.", { status: 400 });
  }

  const connection = await getActiveMetaConnection(organization.id);
  if (!connection) return new Response("No hay una conexión de Meta activa.", { status: 400 });

  const form = await request.formData();
  const accion = String(form.get("accion") ?? "");

  if (accion !== "pausar" && accion !== "activar") {
    return new Response("Acción inválida.", { status: 400 });
  }
  if (accion === "activar" && String(form.get("confirmo")) !== "si") {
    return new Response("Activar requiere confirmación explícita.", { status: 400 });
  }

  const destino = urlDeLaApp(`/campanas/${campaign.id}`, request);

  try {
    await cambiarEstadoEnMeta({
      accessToken: connection.accessToken,
      metaObjectId: campaign.metaCampaignId,
      estado: accion === "activar" ? "ACTIVE" : "PAUSED",
    });

    // Se refleja de inmediato lo que se pidió; la próxima sincronización trae el
    // estado definitivo que decida Meta (puede quedar en revisión, por ejemplo).
    await prisma.campaign.update({
      where: { id: campaign.id },
      data: { effectiveStatus: accion === "activar" ? "ACTIVE" : "PAUSED", lastSyncedAt: new Date() },
    });

    // Activar gasta dinero real: queda registrado quién lo hizo y cuándo (M9).
    await registrarAuditoria({
      organizationId: organization.id,
      actor: { id: user.id, email: user.email },
      action: accion === "activar" ? "CAMPANA_ACTIVADA" : "CAMPANA_PAUSADA",
      entityType: "Campaign",
      entityId: campaign.id,
      metadata: { metaCampaignId: campaign.metaCampaignId, nombre: campaign.name },
    });

    destino.searchParams.set("estado", accion === "activar" ? "activada" : "pausada");
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error cambiando el estado";
    console.error("Error cambiando estado en Meta:", err);
    destino.searchParams.set("estado", "error");
    destino.searchParams.set("motivo", message.slice(0, 200));
  }

  return Response.redirect(destino);
}
