import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { resolveOrganizationForUser } from "@/lib/org";
import { getActiveMetaConnection } from "@/lib/meta-connection";
import { leerEstadosDesdeMeta } from "@/lib/meta-sync";
import { urlDeLaApp } from "@/lib/urls";

// Trae desde Meta el estado real de todo lo publicado por esta organización.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.redirect(urlDeLaApp("/login", request));

  const organization = await resolveOrganizationForUser(user);
  if (!organization) return new Response("No hay organización.", { status: 400 });

  const connection = await getActiveMetaConnection(organization.id);
  if (!connection) return new Response("No hay una conexión de Meta activa.", { status: 400 });

  // Se vuelve a la página desde donde se apretó "Sincronizar". Del `referer` se toma
  // SOLO la ruta, nunca el dominio: si se usara entero, cualquiera podría mandar un
  // referer apuntando a otro sitio y convertir esta ruta en un redirector a su
  // dominio (una forma clásica de phishing).
  const referer = request.headers.get("referer");
  let rutaVuelta = "/campanas";
  if (referer) {
    try {
      const r = new URL(referer);
      rutaVuelta = r.pathname + r.search;
    } catch {
      // Referer malformado: se ignora y se usa el destino por defecto.
    }
  }
  const volverA = urlDeLaApp(rutaVuelta, request);

  try {
    const estados = await leerEstadosDesdeMeta({
      accessToken: connection.accessToken,
      adAccountId: connection.adAccountId,
    });

    const ahora = new Date();

    // Solo se tocan los objetos de ESTA organización, aunque la cuenta publicitaria
    // tenga más cosas creadas por fuera (por ejemplo desde Ads Manager).
    const campanas = await prisma.campaign.findMany({
      where: { organizationId: organization.id, metaCampaignId: { not: null } },
      include: { adSets: { include: { ads: true } } },
    });

    for (const campana of campanas) {
      const estado = estados.campanas.get(campana.metaCampaignId!);
      if (estado) {
        await prisma.campaign.update({
          where: { id: campana.id },
          data: { effectiveStatus: estado.effectiveStatus, lastSyncedAt: ahora },
        });
      }

      for (const conjunto of campana.adSets) {
        if (!conjunto.metaAdSetId) continue;
        const estadoConjunto = estados.conjuntos.get(conjunto.metaAdSetId);
        if (estadoConjunto) {
          await prisma.adSet.update({
            where: { id: conjunto.id },
            data: { effectiveStatus: estadoConjunto.effectiveStatus, lastSyncedAt: ahora },
          });
        }

        for (const anuncio of conjunto.ads) {
          if (!anuncio.metaAdId) continue;
          const estadoAnuncio = estados.anuncios.get(anuncio.metaAdId);
          if (estadoAnuncio) {
            await prisma.ad.update({
              where: { id: anuncio.id },
              data: {
                effectiveStatus: estadoAnuncio.effectiveStatus,
                issuesInfo: (estadoAnuncio.issues as object) ?? undefined,
                lastSyncedAt: ahora,
              },
            });
          }
        }
      }
    }

    if (estados.uso) {
      await prisma.metaConnection.update({
        where: { id: connection.id },
        data: {
          apiUsagePercent: estados.uso.porcentaje,
          apiAccessTier: estados.uso.tier,
          apiUsageAt: ahora,
        },
      });
    }

    volverA.searchParams.set("sync", "ok");
    return Response.redirect(volverA);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error sincronizando con Meta";
    console.error("Error sincronizando con Meta:", err);
    volverA.searchParams.set("sync", "error");
    volverA.searchParams.set("motivo", message.slice(0, 200));
    return Response.redirect(volverA);
  }
}
