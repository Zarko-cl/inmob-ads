import Link from "next/link";
import { redirect } from "next/navigation";
import { Download } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { resolveOrganizationForUser } from "@/lib/org";
import { construirReporte } from "@/lib/reportes";
import { RANGOS, costoPorContacto, costoPorClic, NOTA_ALCANCE, type RangoFecha } from "@/lib/meta-insights";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AppShell, Aviso } from "@/app/components/app-shell";

function clp(n: number) {
  return `$${n.toLocaleString("es-CL")}`;
}

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Promise<{ rango?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const organization = await resolveOrganizationForUser(user);
  if (!organization) redirect("/conectar");

  const { rango: rangoRaw } = await searchParams;
  const rango: RangoFecha = rangoRaw && rangoRaw in RANGOS ? (rangoRaw as RangoFecha) : "last_30d";

  const reporte = await construirReporte(organization.id, rango);

  const tarjetas = [
    { etiqueta: "Personas alcanzadas", valor: reporte.totales.alcance.toLocaleString("es-CL") },
    { etiqueta: "Veces mostrado", valor: reporte.totales.impresiones.toLocaleString("es-CL") },
    { etiqueta: "Clics al enlace", valor: reporte.totales.clicsEnlace.toLocaleString("es-CL") },
    { etiqueta: "Contactos", valor: reporte.totales.contactos.toLocaleString("es-CL") },
    { etiqueta: "Invertido", valor: clp(reporte.totales.gastoClp) },
    {
      etiqueta: "Costo por contacto",
      valor:
        costoPorContacto(reporte.totales) !== null ? clp(costoPorContacto(reporte.totales)!) : "—",
    },
  ];

  return (
    <AppShell
      titulo="Reportes"
      descripcion={organization.name}
      usuario={user}
      activo="/reportes"
      acciones={
        <>
          <form method="GET" className="flex items-center gap-2">
            <select
              name="rango"
              defaultValue={rango}
              className="h-8 rounded-lg border border-border bg-input/30 px-2 text-sm"
            >
              {(Object.keys(RANGOS) as RangoFecha[]).map((k) => (
                <option key={k} value={k}>
                  {RANGOS[k]}
                </option>
              ))}
            </select>
            <Button type="submit" variant="outline" size="sm">
              Ver
            </Button>
          </form>
          <a
            href={`/api/reportes/csv?rango=${rango}`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <Download className="size-4" />
            Excel
          </a>
        </>
      }
    >
      <div className="space-y-8">
        {reporte.error && <Aviso tono="error">{reporte.error}</Aviso>}

        {!reporte.error && !reporte.hayDatos && (
          <Aviso tono="aviso">
            Todavía no hay resultados en este periodo. Las campañas creadas están{" "}
            <strong>pausadas</strong>, así que no han tenido entrega ni gasto. Los números aparecerán
            cuando actives una campaña.
          </Aviso>
        )}

        <section>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {tarjetas.map((t) => (
              <div key={t.etiqueta} className="rounded-xl border border-border bg-card p-4">
                <div className="text-xs text-muted-foreground">{t.etiqueta}</div>
                <div className="mt-1 text-2xl font-semibold">{t.valor}</div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            <strong>Contactos</strong> = formularios completados + conversaciones iniciadas por
            WhatsApp o Messenger. Para campañas a landing page no se pueden contar los contactos
            reales sin el Meta Pixel instalado: ahí solo se ven los clics.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-medium">Por propiedad</h2>
          <p className="mb-4 mt-1 text-sm text-muted-foreground">
            Agrupa todas las campañas de cada propiedad. Meta no puede mostrarte esto porque no
            conoce tu catálogo.
          </p>

          {reporte.porPropiedad.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay campañas publicadas todavía.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Propiedad</TableHead>
                    <TableHead className="text-right">Campañas</TableHead>
                    <TableHead className="text-right">Alcance</TableHead>
                    <TableHead className="text-right">Clics</TableHead>
                    <TableHead className="text-right">Contactos</TableHead>
                    <TableHead className="text-right">Invertido</TableHead>
                    <TableHead className="text-right">Costo/contacto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reporte.porPropiedad.map((p) => (
                    <TableRow key={p.id ?? "sin"}>
                      <TableCell className="font-medium">
                        {p.id ? (
                          <Link href={`/propiedades/${p.id}`} className="hover:underline">
                            {p.titulo}
                          </Link>
                        ) : (
                          p.titulo
                        )}
                      </TableCell>
                      <TableCell className="text-right">{p.campanas}</TableCell>
                      <TableCell className="text-right">
                        {p.metricas.alcance.toLocaleString("es-CL")}
                      </TableCell>
                      <TableCell className="text-right">
                        {p.metricas.clicsEnlace.toLocaleString("es-CL")}
                      </TableCell>
                      <TableCell className="text-right">
                        {p.metricas.contactos.toLocaleString("es-CL")}
                      </TableCell>
                      <TableCell className="text-right">{clp(p.metricas.gastoClp)}</TableCell>
                      <TableCell className="text-right">
                        {costoPorContacto(p.metricas) !== null
                          ? clp(costoPorContacto(p.metricas)!)
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-4 text-lg font-medium">Por campaña</h2>
          {reporte.porCampana.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay campañas publicadas todavía.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campaña</TableHead>
                    <TableHead className="text-right">Alcance</TableHead>
                    <TableHead className="text-right">Clics</TableHead>
                    <TableHead className="text-right">Contactos</TableHead>
                    <TableHead className="text-right">Invertido</TableHead>
                    <TableHead className="text-right">Costo/clic</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reporte.porCampana.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <Link href={`/campanas/${c.id}`} className="font-medium hover:underline">
                          {c.nombre}
                        </Link>
                        {c.estrategia && (
                          <div className="text-xs text-muted-foreground">
                            estrategia: {c.estrategia}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {c.metricas.alcance.toLocaleString("es-CL")}
                      </TableCell>
                      <TableCell className="text-right">
                        {c.metricas.clicsEnlace.toLocaleString("es-CL")}
                      </TableCell>
                      <TableCell className="text-right">
                        {c.metricas.contactos.toLocaleString("es-CL")}
                      </TableCell>
                      <TableCell className="text-right">{clp(c.metricas.gastoClp)}</TableCell>
                      <TableCell className="text-right">
                        {costoPorClic(c.metricas) !== null ? clp(costoPorClic(c.metricas)!) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </section>

        <p className="text-xs text-muted-foreground">{NOTA_ALCANCE}</p>
      </div>
    </AppShell>
  );
}
