import { getCurrentUser } from "@/lib/session";
import { resolveOrganizationForUser } from "@/lib/org";
import { construirReporte } from "@/lib/reportes";
import { RANGOS, costoPorContacto, type RangoFecha } from "@/lib/meta-insights";
import { urlDeLaApp } from "@/lib/urls";

// Exporta el reporte como CSV. Se eligió CSV en vez de .xlsx porque Excel lo abre
// directamente y no obliga a sumar una librería de generación de planillas.
//
// Detalles para que Excel en español lo abra bien:
//  - separador ";" (con "," interpretaría los miles como columnas nuevas)
//  - BOM al inicio, si no los acentos se ven mal

function escapar(valor: string | number): string {
  const texto = String(valor);
  return /[";\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

function fila(campos: (string | number)[]): string {
  return campos.map(escapar).join(";");
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.redirect(urlDeLaApp("/login", request));

  const organization = await resolveOrganizationForUser(user);
  if (!organization) return new Response("No hay organización.", { status: 400 });

  const url = new URL(request.url);
  const rangoRaw = url.searchParams.get("rango");
  const rango: RangoFecha = rangoRaw && rangoRaw in RANGOS ? (rangoRaw as RangoFecha) : "last_30d";

  const reporte = await construirReporte(organization.id, rango);
  if (reporte.error) return new Response(reporte.error, { status: 500 });

  const lineas: string[] = [];

  lineas.push(fila([`Reporte de campañas — ${organization.name}`]));
  lineas.push(fila([`Periodo: ${RANGOS[rango]}`]));
  lineas.push(fila([`Generado: ${new Date().toLocaleString("es-CL")}`]));
  lineas.push("");

  lineas.push(fila(["POR PROPIEDAD"]));
  lineas.push(
    fila(["Propiedad", "Campañas", "Alcance", "Clics", "Contactos", "Invertido (CLP)", "Costo por contacto"])
  );
  for (const p of reporte.porPropiedad) {
    const cpc = costoPorContacto(p.metricas);
    lineas.push(
      fila([
        p.titulo,
        p.campanas,
        p.metricas.alcance,
        p.metricas.clicsEnlace,
        p.metricas.contactos,
        p.metricas.gastoClp,
        cpc ?? "",
      ])
    );
  }

  lineas.push("");
  lineas.push(fila(["POR CAMPAÑA"]));
  lineas.push(
    fila(["Campaña", "Estrategia", "Propiedad", "Alcance", "Clics", "Contactos", "Invertido (CLP)"])
  );
  for (const c of reporte.porCampana) {
    lineas.push(
      fila([
        c.nombre,
        c.estrategia ?? "",
        c.propiedad ?? "",
        c.metricas.alcance,
        c.metricas.clicsEnlace,
        c.metricas.contactos,
        c.metricas.gastoClp,
      ])
    );
  }

  lineas.push("");
  lineas.push(
    fila([
      "TOTAL",
      "",
      "",
      reporte.totales.alcance,
      reporte.totales.clicsEnlace,
      reporte.totales.contactos,
      reporte.totales.gastoClp,
    ])
  );

  // ﻿ = BOM: sin esto Excel muestra "campaña" como "campaÃ±a".
  const csv = "﻿" + lineas.join("\r\n");
  const nombre = `reporte-${organization.name.toLowerCase().replace(/\s+/g, "-")}-${rango}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nombre}"`,
    },
  });
}
