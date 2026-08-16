import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { resolveOrganizationForUser } from "@/lib/org";
import { getActiveMetaConnection } from "@/lib/meta-connection";
import { borrarCampanas, confirmacionValida, PALABRA_CONFIRMACION } from "@/lib/borrado";
import { registrarAuditoria } from "@/lib/auditoria";
import { urlDeLaApp } from "@/lib/urls";

// Borra una estrategia completa: todas sus campañas (y con ellas sus conjuntos y
// anuncios), en Meta y localmente.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return Response.redirect(urlDeLaApp("/login", request));

  const organization = await resolveOrganizationForUser(user);
  if (!organization) return new Response("No hay organización.", { status: 400 });

  const { id } = await params;
  const estrategia = await prisma.strategy.findFirst({
    where: { id, organizationId: organization.id },
    include: { campaigns: true },
  });
  if (!estrategia) return new Response("Estrategia no encontrada.", { status: 404 });

  const form = await request.formData();
  if (!confirmacionValida(form.get("confirmacion"))) {
    return new Response(
      `Para borrar hay que escribir “${PALABRA_CONFIRMACION}” en el campo de confirmación.`,
      { status: 400 }
    );
  }

  const connection = await getActiveMetaConnection(organization.id);
  const resultado = await borrarCampanas(estrategia.campaigns, connection?.accessToken ?? null);

  if (resultado.errores.length > 0) {
    // Se borró lo que se pudo; la estrategia sigue existiendo con lo que quedó.
    const destino = urlDeLaApp(`/estrategias/${estrategia.id}`, request);
    destino.searchParams.set("error", `No se pudo borrar todo en Meta: ${resultado.errores.join("; ")}`);
    return Response.redirect(destino);
  }

  await prisma.strategy.delete({ where: { id: estrategia.id } });

  await registrarAuditoria({
    organizationId: organization.id,
    actor: { id: user.id, email: user.email },
    action: "ESTRATEGIA_BORRADA",
    entityType: "Strategy",
    entityId: estrategia.id,
    metadata: {
      nombre: estrategia.name,
      campanas: estrategia.campaigns.length,
      borradasEnMeta: resultado.borradasEnMeta,
    },
  });

  const destino = urlDeLaApp("/campanas", request);
  destino.searchParams.set("borrado", estrategia.name);
  return Response.redirect(destino);
}
