// Armado del reporte (M11): cruza las métricas de Meta con nuestros datos.
//
// El valor de esta pantalla frente a Ads Manager es el agrupamiento POR PROPIEDAD:
// Meta no sabe que tres campañas promocionan la misma casa; nosotros sí, porque
// guardamos el vínculo campaña↔propiedad desde M4.

import { prisma } from "@/lib/prisma";
import { getActiveMetaConnection } from "@/lib/meta-connection";
import {
  leerResultados,
  sumarMetricas,
  METRICAS_VACIAS,
  type MetricasCampana,
  type RangoFecha,
} from "@/lib/meta-insights";

export type FilaCampana = {
  id: string;
  nombre: string;
  estrategia: string | null;
  propiedad: string | null;
  metricas: MetricasCampana;
};

export type FilaPropiedad = {
  id: string | null;
  titulo: string;
  campanas: number;
  metricas: Omit<MetricasCampana, "metaCampaignId">;
};

export type Reporte = {
  rango: RangoFecha;
  hayDatos: boolean;
  totales: Omit<MetricasCampana, "metaCampaignId">;
  porCampana: FilaCampana[];
  porPropiedad: FilaPropiedad[];
  error: string | null;
};

export async function construirReporte(
  organizationId: string,
  rango: RangoFecha
): Promise<Reporte> {
  const campanas = await prisma.campaign.findMany({
    where: { organizationId, metaCampaignId: { not: null } },
    include: { property: { select: { id: true, title: true } }, strategy: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  const vacio: Reporte = {
    rango,
    hayDatos: false,
    totales: { impresiones: 0, alcance: 0, clicsEnlace: 0, gastoClp: 0, contactos: 0 },
    porCampana: [],
    porPropiedad: [],
    error: null,
  };

  if (campanas.length === 0) return vacio;

  const connection = await getActiveMetaConnection(organizationId);
  if (!connection) return { ...vacio, error: "No hay una conexión de Meta activa." };

  let porCampanaMeta: Map<string, MetricasCampana>;
  try {
    const resultado = await leerResultados({
      accessToken: connection.accessToken,
      adAccountId: connection.adAccountId,
      rango,
    });
    porCampanaMeta = resultado.porCampana;
  } catch (err) {
    return { ...vacio, error: err instanceof Error ? err.message : "Error leyendo resultados de Meta" };
  }

  const filas: FilaCampana[] = campanas.map((c) => ({
    id: c.id,
    nombre: c.name,
    estrategia: c.strategy?.name ?? null,
    propiedad: c.property?.title ?? null,
    // Si Meta no devuelve una campaña es porque no tuvo actividad en el rango:
    // se muestra en cero, no se oculta (que aparezca en cero también es información).
    metricas: porCampanaMeta.get(c.metaCampaignId!) ?? METRICAS_VACIAS(c.metaCampaignId!),
  }));

  // Agrupación por propiedad. Las campañas sin propiedad vinculada van juntas al
  // final, para no perderlas del total.
  const grupos = new Map<string, { titulo: string; id: string | null; filas: FilaCampana[] }>();
  for (const [i, c] of campanas.entries()) {
    const clave = c.property?.id ?? "__sin_propiedad__";
    if (!grupos.has(clave)) {
      grupos.set(clave, {
        titulo: c.property?.title ?? "Sin propiedad vinculada",
        id: c.property?.id ?? null,
        filas: [],
      });
    }
    grupos.get(clave)!.filas.push(filas[i]);
  }

  const porPropiedad: FilaPropiedad[] = [...grupos.values()]
    .map((g) => ({
      id: g.id,
      titulo: g.titulo,
      campanas: g.filas.length,
      metricas: sumarMetricas(g.filas.map((f) => f.metricas)),
    }))
    .sort((a, b) => b.metricas.gastoClp - a.metricas.gastoClp);

  const totales = sumarMetricas(filas.map((f) => f.metricas));

  return {
    rango,
    hayDatos: totales.impresiones > 0 || totales.gastoClp > 0,
    totales,
    porCampana: filas,
    porPropiedad,
    error: null,
  };
}
