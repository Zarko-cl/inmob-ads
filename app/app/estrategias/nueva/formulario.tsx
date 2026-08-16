"use client";

// Formulario de estrategia. Muestra en vivo la estructura que se va a generar
// según el presupuesto, para que el usuario entienda qué está pidiendo antes de
// crear 8, 16 o 32 anuncios.

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, Layers, Boxes, Image as ImageIcon, Wallet } from "lucide-react";
import { CAMPAIGN_TYPES, type CampaignTypeKey } from "@/lib/meta-campaign-types";
import { SegmentacionPanel } from "@/app/components/segmentacion-panel";
import { SEGMENTACION_POR_DEFECTO, type ConfigSegmentacion } from "@/lib/meta-targeting";
import { planificarEstrategia, validarPlan, MIN_DIARIO_POR_CONJUNTO_CLP } from "@/lib/estrategia";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

const claseSelect =
  "h-9 w-full rounded-lg border border-border bg-input/30 px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

type Propiedad = { id: string; title: string; media: { id: string }[] };

export function FormularioEstrategia({
  propiedades,
  faltantesPorTipo,
}: {
  propiedades: Propiedad[];
  faltantesPorTipo: Record<string, string[]>;
}) {
  const [tipo, setTipo] = useState<CampaignTypeKey>("LANDING_SITIO_WEB");
  const [presupuesto, setPresupuesto] = useState(150_000);
  // Varias propiedades: el presupuesto se reparte entre ellas y cada una genera
  // sus propias campañas, con sus fotos y su texto.
  const [elegidas, setElegidas] = useState<Set<string>>(new Set());
  // La segmentación afecta cuántos conjuntos se abren (rango de edad y modo), así
  // que el panel la reporta hacia acá para recalcular la vista previa en vivo.
  const [segmentacion, setSegmentacion] = useState<ConfigSegmentacion>(SEGMENTACION_POR_DEFECTO);

  const config = CAMPAIGN_TYPES[tipo];
  const faltantes = faltantesPorTipo[tipo] ?? [];

  const seleccionadas = propiedades.filter((p) => elegidas.has(p.id));
  const sinFotos = seleccionadas.filter((p) => p.media.length === 0);

  // El presupuesto se REPARTE entre las propiedades elegidas: si no, N propiedades
  // gastarían N veces lo que el usuario dijo estar dispuesto a invertir. El plan que
  // se muestra es el de UNA propiedad, que es lo que va a recibir cada una.
  const presupuestoPorPropiedad = seleccionadas.length
    ? Math.floor((presupuesto || 0) / seleccionadas.length)
    : presupuesto || 0;

  const plan = planificarEstrategia(presupuestoPorPropiedad, segmentacion);
  const problemaPresupuesto = validarPlan(plan);

  // Todo anuncio necesita una imagen. Sin propiedad con fotos, la estrategia
  // generaría decenas de anuncios que nunca se podrían publicar.
  const problemaFotos =
    seleccionadas.length === 0
      ? "Elige al menos una propiedad: cada anuncio necesita una foto y de ahí salen."
      : sinFotos.length > 0
        ? `Sin fotos: ${sinFotos.map((p) => p.title).join(", ")}. Sube al menos una a cada una.`
        : null;

  const problema = problemaPresupuesto ?? problemaFotos;

  return (
    <form method="POST" action="/api/estrategias" className="max-w-2xl space-y-6">
      <div className="space-y-4 rounded-xl border border-border bg-card p-6">
        <div className="space-y-2">
          <Label htmlFor="name">Nombre de la estrategia</Label>
          <Input id="name" name="name" required placeholder="Ej: Casa Til Til — agosto" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="monthlyBudgetClp">Presupuesto mensual (CLP)</Label>
          <Input
            id="monthlyBudgetClp"
            type="number"
            name="monthlyBudgetClp"
            required
            min={1000}
            step={1000}
            value={presupuesto}
            onChange={(e) => setPresupuesto(Number(e.target.value))}
          />
        </div>
      </div>

      {/* Vista previa de la estructura, calculada en vivo */}
      <div
        className={`rounded-xl border bg-card p-6 transition-colors ${
          problemaPresupuesto ? "border-destructive/50" : "border-primary/30"
        }`}
      >
        <div className="flex items-center gap-2">
          <Layers className="size-4 text-primary" />
          <h2 className="font-medium">Estructura que se va a generar</h2>
          <Badge variant="secondary">Nivel {plan.nivel}</Badge>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icono: Layers, etiqueta: "Campañas", valor: plan.campanas },
            { icono: Boxes, etiqueta: "Conjuntos", valor: plan.totalConjuntos },
            { icono: ImageIcon, etiqueta: "Anuncios", valor: plan.totalAnuncios },
            {
              icono: Wallet,
              etiqueta: "Por conjunto/día",
              valor: `$${plan.presupuestoDiarioPorConjuntoClp.toLocaleString("es-CL")}`,
            },
          ].map((k) => (
            <div key={k.etiqueta} className="rounded-lg border border-border bg-background/50 p-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <k.icono className="size-3.5" />
                {k.etiqueta}
              </div>
              <div className="mt-1 bg-gradient-to-br from-foreground to-primary bg-clip-text text-xl font-semibold text-transparent">
                {k.valor}
              </div>
            </div>
          ))}
        </div>

        <p className="mt-3 text-xs text-muted-foreground">{plan.motivoConjuntos}</p>

        {plan.bandas && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {plan.bandas.map((b) => (
              <Badge key={`${b.edadMin}-${b.edadMax}`} variant="outline">
                {b.edadMin}-{b.edadMax} años
              </Badge>
            ))}
          </div>
        )}

        {problemaPresupuesto ? (
          <div className="mt-4 flex gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            {problemaPresupuesto}
          </div>
        ) : (
          <p className="mt-3 text-xs text-muted-foreground">
            Mínimo de Meta: ${MIN_DIARIO_POR_CONJUNTO_CLP.toLocaleString("es-CL")} diarios por conjunto.
          </p>
        )}
      </div>

      <div className="space-y-4 rounded-xl border border-border bg-card p-6">
        <div className="space-y-2">
          <Label htmlFor="campaignType">Tipo de campaña / destino del clic</Label>
          <select
            id="campaignType"
            name="campaignType"
            value={tipo}
            onChange={(e) => setTipo(e.target.value as CampaignTypeKey)}
            className={claseSelect}
          >
            {(Object.keys(CAMPAIGN_TYPES) as CampaignTypeKey[]).map((key) => (
              <option key={key} value={key}>
                {CAMPAIGN_TYPES[key].label}
              </option>
            ))}
          </select>
        </div>

        {config.requiereUrl && (
          <div className="space-y-2">
            <Label htmlFor="destinationUrl">URL de destino</Label>
            <Input
              id="destinationUrl"
              type="url"
              name="destinationUrl"
              required
              placeholder="https://viviendaonline.cl/..."
            />
          </div>
        )}

        {faltantes.length > 0 && (
          <div className="flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-400">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            Para publicar este tipo falta configurar: {faltantes.join(", ")}.
          </div>
        )}

        {/* Lista con casillas en vez de un desplegable: se pueden elegir varias, y
            así se ve de una cuáles tienen fotos sin abrir nada. */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label>Propiedades que promociona *</Label>
            {propiedades.length > 1 && (
              <button
                type="button"
                onClick={() =>
                  setElegidas(
                    elegidas.size === propiedades.length
                      ? new Set()
                      : new Set(propiedades.map((p) => p.id))
                  )
                }
                className="text-xs text-primary underline-offset-4 hover:underline"
              >
                {elegidas.size === propiedades.length ? "Quitar todas" : "Elegir todas"}
              </button>
            )}
          </div>

          {propiedades.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay propiedades disponibles.{" "}
              <Link href="/propiedades/nueva" className="underline underline-offset-4">
                Crear una →
              </Link>
            </p>
          ) : (
            <div className="space-y-1.5">
              {propiedades.map((p) => {
                const marcada = elegidas.has(p.id);
                const nFotos = p.media.length;
                return (
                  <label
                    key={p.id}
                    className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${
                      marcada ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/40"
                    }`}
                  >
                    <input
                      type="checkbox"
                      name="propertyIds"
                      value={p.id}
                      checked={marcada}
                      onChange={() =>
                        setElegidas((actual) => {
                          const copia = new Set(actual);
                          if (copia.has(p.id)) copia.delete(p.id);
                          else copia.add(p.id);
                          return copia;
                        })
                      }
                      className="size-4 shrink-0 accent-primary"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{p.title}</span>
                      <span
                        className={`block text-xs ${nFotos === 0 ? "text-destructive" : "text-muted-foreground"}`}
                      >
                        {nFotos === 0 ? (
                          <>
                            Sin fotos —{" "}
                            <a
                              href={`/propiedades/${p.id}`}
                              className="underline underline-offset-4"
                              onClick={(e) => e.stopPropagation()}
                            >
                              subir →
                            </a>
                          </>
                        ) : (
                          `${nFotos} foto${nFotos === 1 ? "" : "s"}`
                        )}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          )}

          {problemaFotos && <p className="text-xs text-destructive">{problemaFotos}</p>}

          {seleccionadas.length > 1 && (
            <p className="text-xs text-muted-foreground">
              Se va a crear una campaña por propiedad. El presupuesto se reparte:{" "}
              <strong className="text-foreground">
                ${presupuestoPorPropiedad.toLocaleString("es-CL")}/mes
              </strong>{" "}
              para cada una.
            </p>
          )}

          {!problemaFotos &&
            seleccionadas.some((p) => p.media.length < plan.anunciosPorConjunto) && (
              <p className="text-xs text-amber-400">
                Alguna propiedad tiene menos de {plan.anunciosPorConjunto} fotos y cada conjunto
                lleva {plan.anunciosPorConjunto} anuncios: las fotos se van a repetir.
              </p>
            )}
        </div>
      </div>

      <SegmentacionPanel
        onCambio={setSegmentacion}
        propertyId={seleccionadas.length === 1 ? seleccionadas[0].id : null}
      />

      <p className="text-sm text-muted-foreground">
        Los copys se generan con IA al crear la estrategia. Todo queda como borrador: cada campaña se
        publica después, una por una.
      </p>

      <Button type="submit" disabled={Boolean(problema)} className="h-10">
        <Layers className="size-4" />
        Generar estrategia ({plan.totalAnuncios} anuncios)
      </Button>
    </form>
  );
}
