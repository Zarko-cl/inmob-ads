"use client";

// Formato del anuncio: imagen única o carrusel (secuencia de fotos).
//
// Es un componente cliente porque el usuario arma el carrusel al vuelo: elige fotos,
// las reordena y ve cuántas tarjetas lleva. Eso necesita estado en el navegador.
// Nada de esto vale hasta apretar "Guardar formato", así que mientras haya
// diferencias con lo guardado se muestra un aviso: la revisión de cumplimiento y la
// publicación leen lo que está en la base, no lo que se ve en pantalla.

import { useState } from "react";
import {
  Images,
  Image as ImageIcon,
  ArrowLeft,
  ArrowRight,
  X,
  Upload,
  AlertTriangle,
  Sparkles,
  Save,
  Undo2,
  GripVertical,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MIN_TARJETAS, MAX_TARJETAS, fotosFaltantes } from "@/lib/carrusel";
import { COPY_LIMITS } from "@/lib/copy-limits";

type Foto = { id: string; url: string };

type Tarjeta = { propertyMediaId: string; headline: string; description: string };

// Campo de texto de una tarjeta con contador. El límite que se muestra es el
// "recomendado" de Meta: pasarse no hace fallar la publicación, pero Meta corta el
// texto en el anuncio, así que conviene verlo mientras se escribe.
function CampoTarjeta({
  valor,
  onChange,
  placeholder,
  limite,
}: {
  valor: string;
  onChange: (v: string) => void;
  placeholder: string;
  limite: number;
}) {
  const excede = valor.trim().length > limite;
  return (
    <div className="relative">
      <Input
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`h-8 pr-12 text-xs ${excede ? "border-amber-500/60" : ""}`}
      />
      {valor.length > 0 && (
        <span
          className={`pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] ${
            excede ? "text-amber-400" : "text-muted-foreground"
          }`}
        >
          {valor.trim().length}/{limite}
        </span>
      )}
    </div>
  );
}

export function FormatoPanel({
  campaignId,
  propertyId,
  fotos,
  formatoInicial,
  creativeMediaIdInicial,
  tarjetasIniciales,
}: {
  campaignId: string;
  propertyId: string;
  fotos: Foto[];
  formatoInicial: "IMAGEN_UNICA" | "CARRUSEL";
  creativeMediaIdInicial: string | null;
  tarjetasIniciales: Tarjeta[];
}) {
  const router = useRouter();
  const [formato, setFormato] = useState(formatoInicial);
  const [tarjetas, setTarjetas] = useState<Tarjeta[]>(tarjetasIniciales);
  const [fotoUnica, setFotoUnica] = useState<string | null>(creativeMediaIdInicial);
  const [arrastrando, setArrastrando] = useState<number | null>(null);
  const [generando, setGenerando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);

  const faltan = fotosFaltantes(fotos.length);
  const urlDe = (id: string) => fotos.find((f) => f.id === id)?.url ?? "";

  // Lo que se ve en pantalla vs. lo que está guardado en la base. Si difieren, ni la
  // revisión de cumplimiento ni el botón de publicar saben todavía de estos cambios.
  const firmaGuardada = JSON.stringify({
    formato: formatoInicial,
    foto: creativeMediaIdInicial,
    tarjetas: tarjetasIniciales,
  });
  const firmaActual = JSON.stringify({ formato, foto: fotoUnica, tarjetas });
  const sinGuardar = firmaActual !== firmaGuardada;

  function cambiar<T>(accion: () => T) {
    setGuardado(false);
    setError(null);
    return accion();
  }

  function alternar(fotoId: string) {
    cambiar(() =>
      setTarjetas((actuales) => {
        const existe = actuales.some((t) => t.propertyMediaId === fotoId);
        if (existe) return actuales.filter((t) => t.propertyMediaId !== fotoId);
        if (actuales.length >= MAX_TARJETAS) return actuales;
        return [...actuales, { propertyMediaId: fotoId, headline: "", description: "" }];
      })
    );
  }

  function mover(desde: number, hasta: number) {
    cambiar(() =>
      setTarjetas((actuales) => {
        if (hasta < 0 || hasta >= actuales.length || desde === hasta) return actuales;
        const copia = [...actuales];
        const [movida] = copia.splice(desde, 1);
        copia.splice(hasta, 0, movida);
        return copia;
      })
    );
  }

  function editar(indice: number, campo: "headline" | "description", valor: string) {
    cambiar(() =>
      setTarjetas((actuales) => actuales.map((t, i) => (i === indice ? { ...t, [campo]: valor } : t)))
    );
  }

  async function completarConIA() {
    setGenerando(true);
    setError(null);
    try {
      const res = await fetch(`/api/campanas/${campaignId}/carrusel/textos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyMediaIds: tarjetas.map((t) => t.propertyMediaId) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudieron generar los textos.");
      setGuardado(false);
      setTarjetas((actuales) =>
        actuales.map((t, i) => ({
          ...t,
          headline: data.textos[i]?.headline ?? t.headline,
          description: data.textos[i]?.description ?? t.description,
        }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error generando los textos");
    } finally {
      setGenerando(false);
    }
  }

  async function guardar() {
    setGuardando(true);
    setError(null);
    try {
      const datos = new FormData();
      datos.append("adFormat", formato);
      if (formato === "CARRUSEL") datos.append("tarjetas", JSON.stringify(tarjetas));
      else if (fotoUnica) datos.append("creativeMediaId", fotoUnica);

      const res = await fetch(`/api/campanas/${campaignId}/creativo`, {
        method: "POST",
        body: datos,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo guardar el formato.");
      setGuardado(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error guardando el formato");
    } finally {
      setGuardando(false);
    }
  }

  const carruselIncompleto = formato === "CARRUSEL" && tarjetas.length < MIN_TARJETAS;

  if (fotos.length === 0) {
    return (
      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="font-medium">Formato del anuncio</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Esta propiedad no tiene fotos.{" "}
          <Link
            href={`/propiedades/${propertyId}`}
            className="inline-flex items-center gap-1 underline underline-offset-4"
          >
            <Upload className="size-3.5" />
            Subir fotos
          </Link>
        </p>
      </section>
    );
  }

  return (
    <section
      className={`rounded-xl border bg-card p-5 ${sinGuardar ? "border-primary/50" : "border-border"}`}
    >
      <h2 className="font-medium">Formato del anuncio</h2>

      {/* Selector de formato */}
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => cambiar(() => setFormato("IMAGEN_UNICA"))}
          className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-all ${
            formato === "IMAGEN_UNICA"
              ? "border-primary bg-primary/5 shadow-[0_0_20px_-8px] shadow-primary/50"
              : "border-border hover:border-muted-foreground/40"
          }`}
        >
          <ImageIcon className="mt-0.5 size-4 shrink-0 text-primary" />
          <span>
            <span className="block text-sm font-medium">Imagen única</span>
            <span className="block text-xs text-muted-foreground">
              Una foto. Es el formato más simple y rápido de aprobar.
            </span>
          </span>
        </button>

        <button
          type="button"
          onClick={() => cambiar(() => setFormato("CARRUSEL"))}
          disabled={faltan > 0}
          className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
            formato === "CARRUSEL"
              ? "border-primary bg-primary/5 shadow-[0_0_20px_-8px] shadow-primary/50"
              : "border-border hover:border-muted-foreground/40"
          }`}
        >
          <Images className="mt-0.5 size-4 shrink-0 text-primary" />
          <span>
            <span className="block text-sm font-medium">Carrusel</span>
            <span className="block text-xs text-muted-foreground">
              {faltan > 0
                ? `Faltan ${faltan} foto(s): se necesitan ${MIN_TARJETAS}.`
                : `De ${MIN_TARJETAS} a ${MAX_TARJETAS} fotos deslizables. Muestra varias vistas de la propiedad.`}
            </span>
          </span>
        </button>
      </div>

      {/* --- Imagen única --- */}
      {formato === "IMAGEN_UNICA" && (
        <div className="mt-4">
          <p className="text-xs text-muted-foreground">
            Elige la foto que va a mostrar el anuncio.
          </p>
          <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {fotos.map((foto) => (
              <button
                type="button"
                key={foto.id}
                onClick={() => cambiar(() => setFotoUnica(fotoUnica === foto.id ? null : foto.id))}
                className={`block overflow-hidden rounded-lg border-2 transition-all ${
                  fotoUnica === foto.id
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
              </button>
            ))}
          </div>
        </div>
      )}

      {/* --- Carrusel --- */}
      {formato === "CARRUSEL" && (
        <div className="mt-4 space-y-4">
          <div>
            <p className="text-xs text-muted-foreground">
              Toca las fotos que quieras incluir. {tarjetas.length} de {MAX_TARJETAS} elegidas.
            </p>
            <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {fotos.map((foto) => {
                const posicion = tarjetas.findIndex((t) => t.propertyMediaId === foto.id);
                const elegida = posicion >= 0;
                return (
                  <button
                    type="button"
                    key={foto.id}
                    onClick={() => alternar(foto.id)}
                    className={`relative block overflow-hidden rounded-lg border-2 transition-all ${
                      elegida
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
                    {elegida && (
                      <span className="absolute left-1 top-1 flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
                        {posicion + 1}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {tarjetas.length > 0 && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  Arrastra para cambiar el orden. El título y la descripción son opcionales;
                  si los dejas vacíos, Meta usa el copy de la campaña.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={generando}
                  onClick={completarConIA}
                >
                  <Sparkles className="size-4" />
                  {generando ? "Generando…" : "Completar con IA"}
                </Button>
              </div>

              {tarjetas.map((tarjeta, i) => (
                <div
                  key={tarjeta.propertyMediaId}
                  draggable
                  onDragStart={() => setArrastrando(i)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (arrastrando !== null) mover(arrastrando, i);
                    setArrastrando(null);
                  }}
                  onDragEnd={() => setArrastrando(null)}
                  className={`flex items-center gap-2 rounded-lg border bg-background/40 p-2 transition-opacity ${
                    arrastrando === i ? "border-primary opacity-40" : "border-border"
                  }`}
                >
                  <GripVertical className="size-4 shrink-0 cursor-grab text-muted-foreground" />
                  <span className="w-4 shrink-0 text-center text-xs text-muted-foreground">
                    {i + 1}
                  </span>
                  <Image
                    src={urlDe(tarjeta.propertyMediaId)}
                    alt=""
                    width={56}
                    height={56}
                    className="size-14 shrink-0 rounded object-cover"
                  />
                  <div className="grid min-w-0 flex-1 gap-1.5 sm:grid-cols-2">
                    <CampoTarjeta
                      valor={tarjeta.headline}
                      onChange={(v) => editar(i, "headline", v)}
                      placeholder={`Título tarjeta ${i + 1}`}
                      limite={COPY_LIMITS.headline.recomendado}
                    />
                    <CampoTarjeta
                      valor={tarjeta.description}
                      onChange={(v) => editar(i, "description", v)}
                      placeholder="Descripción (opcional)"
                      limite={COPY_LIMITS.description.recomendado}
                    />
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => mover(i, i - 1)}
                      disabled={i === 0}
                      title="Mover antes"
                      className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-30"
                    >
                      <ArrowLeft className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => mover(i, i + 1)}
                      disabled={i === tarjetas.length - 1}
                      title="Mover después"
                      className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-30"
                    >
                      <ArrowRight className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => alternar(tarjeta.propertyMediaId)}
                      title="Quitar"
                      className="rounded p-1 text-muted-foreground hover:bg-destructive/20 hover:text-destructive"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {carruselIncompleto && (
            <p className="flex items-center gap-2 text-xs text-amber-400">
              <AlertTriangle className="size-3.5 shrink-0" />
              Elige al menos {MIN_TARJETAS} fotos para poder publicar el carrusel.
            </p>
          )}
        </div>
      )}

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

      {/* Estado del guardado. Sin esto es fácil creer que lo que se ve en pantalla ya
          quedó guardado, y la revisión de cumplimiento sigue viendo lo anterior. */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button type="button" size="sm" disabled={guardando || !sinGuardar} onClick={guardar}>
          <Save className="size-4" />
          {guardando ? "Guardando…" : "Guardar formato"}
        </Button>
        {sinGuardar && (
          <>
            <span className="text-xs text-amber-400">
              Tienes cambios sin guardar. La revisión de cumplimiento y la publicación usan
              lo guardado, no lo que se ve acá.
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setFormato(formatoInicial);
                setTarjetas(tarjetasIniciales);
                setFotoUnica(creativeMediaIdInicial);
                setError(null);
              }}
            >
              <Undo2 className="size-4" />
              Deshacer
            </Button>
          </>
        )}
        {!sinGuardar && guardado && <span className="text-xs text-emerald-400">Formato guardado.</span>}
      </div>
    </section>
  );
}
