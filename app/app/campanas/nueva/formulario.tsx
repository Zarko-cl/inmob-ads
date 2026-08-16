"use client";

// Formulario completo de campaña nueva (M3 + M5 + M7).
// Corre en el navegador porque tres cosas tienen que reaccionar al instante:
// el campo de URL (según el tipo de campaña), el aviso de requisitos faltantes,
// y la generación de copys con IA (que usa el tipo y la propiedad ya elegidos).

import { useState } from "react";
import Image from "next/image";
import { Sparkles, AlertTriangle, ImageOff } from "lucide-react";
import { CAMPAIGN_TYPES, type CampaignTypeKey } from "@/lib/meta-campaign-types";
import { CampoCopy } from "@/app/components/campo-copy";
import { SegmentacionPanel } from "@/app/components/segmentacion-panel";
import { MIN_TARJETAS, MAX_TARJETAS } from "@/lib/carrusel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const claseSelect =
  "h-9 w-full rounded-lg border border-border bg-input/30 px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

type Foto = { id: string; url: string };
type Propiedad = { id: string; title: string; media: Foto[] };
type Variante = { primaryText: string; headline: string; description: string };

export function FormularioNuevaCampana({
  propiedades,
  faltantesPorTipo,
}: {
  propiedades: Propiedad[];
  faltantesPorTipo: Record<string, string[]>;
}) {
  const [tipo, setTipo] = useState<CampaignTypeKey>("LANDING_SITIO_WEB");
  const [elegidas, setElegidas] = useState<Set<string>>(new Set());
  // El selector de foto/carrusel solo tiene sentido con UNA propiedad: con varias,
  // cada campaña usa las fotos de la suya.
  const propertyId = elegidas.size === 1 ? [...elegidas][0] : "";
  const [creativeMediaId, setCreativeMediaId] = useState("");
  const [formato, setFormato] = useState<"IMAGEN_UNICA" | "CARRUSEL">("IMAGEN_UNICA");
  const [variantes, setVariantes] = useState<Variante[]>([]);
  const [elegida, setElegida] = useState<number | null>(null);
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const config = CAMPAIGN_TYPES[tipo];
  const faltantes = faltantesPorTipo[tipo] ?? [];
  const fotosDisponibles = propiedades.find((p) => p.id === propertyId)?.media ?? [];

  async function generarCopys() {
    setGenerando(true);
    setError(null);
    try {
      const res = await fetch("/api/copys/generar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignType: tipo, propertyId: propertyId || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudieron generar los copys.");
      setVariantes(data.variantes);
      setElegida(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setGenerando(false);
    }
  }

  return (
    <form method="POST" action="/api/campanas" className="max-w-2xl space-y-6">
      <div className="space-y-4 rounded-xl border border-border bg-card p-6">
        <div className="space-y-2">
          <Label htmlFor="name">Nombre de la campaña</Label>
          <Input id="name" name="name" required />
        </div>

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
          <p className="text-xs text-muted-foreground">
            {config.descripcion} Objetivo en Meta: <strong>{config.objective}</strong>.
          </p>
        </div>

        {config.requiereUrl && (
          <div className="space-y-2">
            <Label htmlFor="destinationUrl">URL de destino</Label>
            <Input
              id="destinationUrl"
              type="url"
              name="destinationUrl"
              required
              placeholder="https://viviendaonline.cl/propiedad/..."
            />
          </div>
        )}

        {faltantes.length > 0 && (
          <div className="flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-400">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <div>
              Para publicar este tipo de campaña falta configurar: {faltantes.join(", ")}. Puedes
              guardar el borrador igual.
            </div>
          </div>
        )}

        {/* Se pueden elegir varias: con más de una se crea una campaña por propiedad,
            cada una con sus propias fotos y su propio texto. */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label>Propiedades que promociona (opcional)</Label>
            {propiedades.length > 1 && (
              <button
                type="button"
                onClick={() => {
                  setElegidas(
                    elegidas.size === propiedades.length
                      ? new Set()
                      : new Set(propiedades.map((p) => p.id))
                  );
                  setCreativeMediaId("");
                }}
                className="text-xs text-primary underline-offset-4 hover:underline"
              >
                {elegidas.size === propiedades.length ? "Quitar todas" : "Elegir todas"}
              </button>
            )}
          </div>

          {propiedades.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía no hay propiedades cargadas.</p>
          ) : (
            <div className="space-y-1.5">
              {propiedades.map((p) => {
                const marcada = elegidas.has(p.id);
                return (
                  <label
                    key={p.id}
                    className={`flex cursor-pointer items-center gap-3 rounded-lg border p-2.5 transition-colors ${
                      marcada ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/40"
                    }`}
                  >
                    <input
                      type="checkbox"
                      name="propertyIds"
                      value={p.id}
                      checked={marcada}
                      onChange={() => {
                        setElegidas((actual) => {
                          const copia = new Set(actual);
                          if (copia.has(p.id)) copia.delete(p.id);
                          else copia.add(p.id);
                          return copia;
                        });
                        // Al cambiar la selección, la foto elegida ya no aplica.
                        setCreativeMediaId("");
                      }}
                      className="size-4 shrink-0 accent-primary"
                    />
                    <span className="min-w-0 flex-1 truncate text-sm">{p.title}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {p.media.length} foto{p.media.length === 1 ? "" : "s"}
                    </span>
                  </label>
                );
              })}
            </div>
          )}

          {elegidas.size > 1 && (
            <p className="text-xs text-muted-foreground">
              Se van a crear <strong className="text-foreground">{elegidas.size} campañas</strong>,
              una por propiedad, cada una con sus fotos y su texto. El presupuesto que indiques
              abajo es el de <em>cada</em> campaña.
            </p>
          )}
        </div>

        {propertyId && (
          <div className="space-y-2">
            <Label>Foto del anuncio (opcional)</Label>
            {fotosDisponibles.length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <ImageOff className="size-4" />
                Esta propiedad todavía no tiene fotos.
              </p>
            ) : (
              <>
                <input type="hidden" name="adFormat" value={formato} />
                <input type="hidden" name="creativeMediaId" value={creativeMediaId} />

                {/* Elegir carrusel acá toma las primeras fotos de la propiedad en orden;
                    el orden y los títulos de cada tarjeta se afinan en el detalle. */}
                <div className="flex flex-wrap gap-2 pb-1">
                  <button
                    type="button"
                    onClick={() => setFormato("IMAGEN_UNICA")}
                    className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                      formato === "IMAGEN_UNICA"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Imagen única
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormato("CARRUSEL")}
                    disabled={fotosDisponibles.length < MIN_TARJETAS}
                    title={
                      fotosDisponibles.length < MIN_TARJETAS
                        ? `El carrusel necesita al menos ${MIN_TARJETAS} fotos.`
                        : undefined
                    }
                    className={`rounded-full border px-3 py-1 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                      formato === "CARRUSEL"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Carrusel ({Math.min(fotosDisponibles.length, MAX_TARJETAS)} fotos)
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {fotosDisponibles.map((foto, i) => (
                    <button
                      key={foto.id}
                      type="button"
                      disabled={formato === "CARRUSEL"}
                      onClick={() => setCreativeMediaId(creativeMediaId === foto.id ? "" : foto.id)}
                      className={`relative overflow-hidden rounded-lg border-2 transition-all ${
                        (formato === "CARRUSEL" && i < MAX_TARJETAS) || creativeMediaId === foto.id
                          ? "border-primary shadow-[0_0_20px_-5px] shadow-primary/50"
                          : "border-transparent hover:border-border"
                      }`}
                    >
                      <span className="relative block aspect-[4/3] w-full bg-muted">
                        <Image
                          src={foto.url}
                          alt=""
                          fill
                          sizes="(max-width: 640px) 33vw, 200px"
                          className="object-cover"
                        />
                      </span>
                      {formato === "CARRUSEL" && i < MAX_TARJETAS && (
                        <span className="absolute left-1 top-1 flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
                          {i + 1}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <SegmentacionPanel mostrarRecomendados propertyId={propertyId || null} />

      <div className="space-y-4 rounded-xl border border-border bg-card p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="budgetAmountClp">Presupuesto diario (CLP)</Label>
            <Input
              id="budgetAmountClp"
              type="number"
              name="budgetAmountClp"
              required
              min={1000}
              step={1}
              placeholder="Ej: 5000"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="startDate">Fecha de inicio (opcional)</Label>
            <Input id="startDate" type="date" name="startDate" />
          </div>
        </div>
        <input type="hidden" name="budgetType" value="DIARIO" />
      </div>

      {/* Copys con IA (M7) */}
      <div className="space-y-4 rounded-xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-medium">Copy del anuncio (opcional)</h2>
          <Button type="button" onClick={generarCopys} disabled={generando} size="sm">
            <Sparkles className={`size-4 ${generando ? "animate-pulse" : ""}`} />
            {generando ? "Generando…" : variantes.length > 0 ? "Generar otras" : "Generar con IA"}
          </Button>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {variantes.length === 0 && !generando && (
          <p className="text-sm text-muted-foreground">
            Se genera a partir de la propiedad elegida y del tipo de campaña. También puedes crear la
            campaña sin copy y generarlo después.
          </p>
        )}

        {variantes.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Elige una variante (puedes editarla antes de guardar):
            </p>
            {variantes.map((v, i) => (
              <div
                key={i}
                className={`rounded-lg border p-4 transition-all ${
                  elegida === i
                    ? "border-primary shadow-[0_0_25px_-12px] shadow-primary/50"
                    : "border-border"
                }`}
              >
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="copyElegido"
                    checked={elegida === i}
                    onChange={() => setElegida(i)}
                    className="accent-primary"
                  />
                  <span className="font-medium">Variante {i + 1}</span>
                </label>

                {elegida === i ? (
                  <div className="mt-3 space-y-3">
                    <CampoCopy campo="primaryText" name="primaryText" defaultValue={v.primaryText} filas={4} />
                    <CampoCopy campo="headline" name="headline" defaultValue={v.headline} filas={2} />
                    <CampoCopy campo="description" name="description" defaultValue={v.description} filas={2} />
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground">{v.primaryText}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <Button type="submit" className="h-10">
        Guardar borrador
      </Button>
    </form>
  );
}
