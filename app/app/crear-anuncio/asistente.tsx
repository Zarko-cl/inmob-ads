"use client";

// Asistente del modo simple: crear un anuncio en cinco decisiones.
//
// El principio de esta pantalla es que el usuario no sabe nada de publicidad en Meta.
// No aparece en ningún momento la palabra "objetivo", "conjunto de anuncios",
// "optimización" ni "segmentación": todo eso lo decide lib/modo-simple.ts. Lo único
// que se pregunta es lo que nadie puede responder por él.

import { useState, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Upload,
  Images,
  Image as ImageIcon,
  MessageCircle,
  Globe,
  AlertTriangle,
  Check,
  Sparkles,
  Home,
} from "lucide-react";
import { validarArchivo, formatearBytes, MAX_FILE_BYTES } from "@/lib/storage-limits";
import { MIN_TARJETAS, MAX_TARJETAS } from "@/lib/carrusel";
import {
  PRESUPUESTOS_SUGERIDOS,
  TEXTO_DESTINO,
  MINIMO_DIARIO_CLP,
  gastoMensualEstimado,
  type DestinoSimple,
} from "@/lib/modo-simple";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Foto = { id: string; url: string };
type Propiedad = { id: string; title: string; media: Foto[] };

// Cada bloque de la pantalla es un "paso" numerado. Es una sola página con scroll y
// no un asistente de varias pantallas a propósito: así el usuario ve de una todo lo
// que se le va a preguntar y puede volver atrás sin perder nada.
function Paso({
  numero,
  titulo,
  ayuda,
  listo,
  children,
}: {
  numero: number;
  titulo: string;
  ayuda?: string;
  listo?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
            listo ? "bg-emerald-500/20 text-emerald-400" : "bg-primary/15 text-primary"
          }`}
        >
          {listo ? <Check className="size-3.5" /> : numero}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-medium">{titulo}</h2>
          {ayuda && <p className="mt-0.5 text-sm text-muted-foreground">{ayuda}</p>}
          <div className="mt-4">{children}</div>
        </div>
      </div>
    </section>
  );
}

// Tarjeta de opción grande, del tamaño suficiente para tocarse en un teléfono.
function Opcion({
  activa,
  onClick,
  disabled,
  icono,
  titulo,
  ayuda,
}: {
  activa: boolean;
  onClick: () => void;
  disabled?: boolean;
  icono: React.ReactNode;
  titulo: string;
  ayuda: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-start gap-3 rounded-lg border p-4 text-left transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
        activa
          ? "border-primary bg-primary/5 shadow-[0_0_24px_-10px] shadow-primary/60"
          : "border-border hover:border-muted-foreground/40"
      }`}
    >
      <span className="mt-0.5 shrink-0 text-primary">{icono}</span>
      <span className="min-w-0">
        <span className="block text-sm font-medium">{titulo}</span>
        <span className="block text-xs text-muted-foreground">{ayuda}</span>
      </span>
    </button>
  );
}

export function Asistente({ propiedades }: { propiedades: Propiedad[] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [propertyId, setPropertyId] = useState(propiedades[0]?.id ?? "");
  const [creandoPropiedad, setCreandoPropiedad] = useState(propiedades.length === 0);
  const [tituloNuevo, setTituloNuevo] = useState("");
  const [precioNuevo, setPrecioNuevo] = useState("");
  const [monedaNueva, setMonedaNueva] = useState<"CLP" | "UF">("UF");

  // Las fotos recién subidas se guardan acá para poder mostrarlas sin recargar.
  const [fotos, setFotos] = useState<Foto[]>(propiedades[0]?.media ?? []);
  const [subiendo, setSubiendo] = useState(false);
  const [progreso, setProgreso] = useState({ hecho: 0, total: 0 });
  const [rechazadas, setRechazadas] = useState<{ nombre: string; motivo: string }[]>([]);

  const [formato, setFormato] = useState<"IMAGEN_UNICA" | "CARRUSEL">("IMAGEN_UNICA");
  const [destino, setDestino] = useState<DestinoSimple | null>(null);
  const [url, setUrl] = useState("");
  const [presupuesto, setPresupuesto] = useState<number>(PRESUPUESTOS_SUGERIDOS[1].clpPorDia);
  const [otroMonto, setOtroMonto] = useState("");

  const [creando, setCreando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const propiedadElegida = propiedades.find((p) => p.id === propertyId);

  function elegirPropiedad(id: string) {
    setPropertyId(id);
    setFotos(propiedades.find((p) => p.id === id)?.media ?? []);
    setError(null);
  }

  // Crea la propiedad con lo mínimo indispensable y sigue en la misma pantalla.
  async function crearPropiedad(): Promise<string | null> {
    const datos = new FormData();
    datos.append("title", tituloNuevo.trim());
    datos.append("price", precioNuevo.replace(/\./g, ""));
    datos.append("currency", monedaNueva);
    const res = await fetch("/api/propiedades", {
      method: "POST",
      headers: { Accept: "application/json" },
      body: datos,
    });
    if (!res.ok) throw new Error("No se pudo crear la propiedad.");
    const data = await res.json();
    return data.id as string;
  }

  async function subirFotos(e: React.ChangeEvent<HTMLInputElement>) {
    const elegidos = Array.from(e.target.files ?? []);
    if (elegidos.length === 0) return;
    setError(null);

    // Si todavía no hay propiedad, se crea al vuelo: las fotos cuelgan de ella.
    let destinoId = propertyId;
    if (!destinoId) {
      if (!tituloNuevo.trim() || !precioNuevo.trim()) {
        setError("Primero escribe el nombre y el precio de la propiedad.");
        if (inputRef.current) inputRef.current.value = "";
        return;
      }
      try {
        destinoId = (await crearPropiedad()) ?? "";
        setPropertyId(destinoId);
        setCreandoPropiedad(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo crear la propiedad.");
        return;
      }
    }

    const problemas: { nombre: string; motivo: string }[] = [];
    const validos: File[] = [];
    for (const archivo of elegidos) {
      const problema = validarArchivo(archivo);
      if (problema) problemas.push({ nombre: archivo.name, motivo: problema });
      else validos.push(archivo);
    }
    setRechazadas(problemas);
    setProgreso({ hecho: 0, total: validos.length });
    if (validos.length === 0) {
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    // En serie, igual que en la ficha de la propiedad: el servidor numera el orden
    // contando las fotos existentes y en paralelo se pisarían.
    setSubiendo(true);
    for (const archivo of validos) {
      try {
        const datos = new FormData();
        datos.append("archivo", archivo);
        const res = await fetch(`/api/propiedades/${destinoId}/fotos`, { method: "POST", body: datos });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "No se pudo subir.");
        setFotos((f) => [...f, { id: data.foto.id, url: data.foto.url }]);
      } catch (err) {
        problemas.push({
          nombre: archivo.name,
          motivo: err instanceof Error ? err.message : "Error subiendo",
        });
        setRechazadas([...problemas]);
      } finally {
        setProgreso((p) => ({ ...p, hecho: p.hecho + 1 }));
      }
    }
    setSubiendo(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  const montoFinal = otroMonto ? Number(otroMonto.replace(/\./g, "")) : presupuesto;
  const montoValido = Number.isFinite(montoFinal) && montoFinal >= MINIMO_DIARIO_CLP;

  const problemas: string[] = [];
  if (!propertyId) problemas.push("Elige o crea una propiedad.");
  if (fotos.length === 0) problemas.push("Sube al menos una foto.");
  if (formato === "CARRUSEL" && fotos.length < MIN_TARJETAS)
    problemas.push(`El carrusel necesita ${MIN_TARJETAS} fotos y tienes ${fotos.length}.`);
  if (!destino) problemas.push("Elige dónde quieres que te contacten.");
  if (destino === "LANDING_SITIO_WEB" && !url.trim())
    problemas.push("Escribe la dirección de la página.");
  if (!montoValido)
    problemas.push(`El presupuesto mínimo es $${MINIMO_DIARIO_CLP.toLocaleString("es-CL")} al día.`);

  async function crear() {
    setCreando(true);
    setError(null);
    try {
      const res = await fetch("/api/crear-anuncio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId,
          destino,
          destinationUrl: url.trim(),
          budgetAmountClp: montoFinal,
          adFormat: formato,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo crear el anuncio.");
      router.push(`/campanas/${data.campaignId}?creada=simple`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error creando el anuncio");
      setCreando(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-4">
      {/* 1. Propiedad */}
      <Paso
        numero={1}
        titulo="¿Qué propiedad quieres promocionar?"
        listo={Boolean(propertyId)}
      >
        {propiedades.length > 0 && !creandoPropiedad && (
          <div className="space-y-2">
            {propiedades.map((p) => (
              <Opcion
                key={p.id}
                activa={propertyId === p.id}
                onClick={() => elegirPropiedad(p.id)}
                icono={<Home className="size-4" />}
                titulo={p.title}
                ayuda={`${p.media.length} foto(s) cargada(s)`}
              />
            ))}
            <button
              type="button"
              onClick={() => {
                setCreandoPropiedad(true);
                setPropertyId("");
                setFotos([]);
              }}
              className="text-sm text-primary underline-offset-4 hover:underline"
            >
              Es una propiedad nueva
            </button>
          </div>
        )}

        {creandoPropiedad && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="tituloNuevo">¿Cómo se llama?</Label>
              <Input
                id="tituloNuevo"
                value={tituloNuevo}
                onChange={(e) => setTituloNuevo(e.target.value)}
                placeholder="Ej: Casa 3 dormitorios en Providencia"
              />
            </div>
            <div className="flex gap-2">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="precioNuevo">Precio</Label>
                <Input
                  id="precioNuevo"
                  value={precioNuevo}
                  onChange={(e) => setPrecioNuevo(e.target.value)}
                  placeholder="5.000"
                  inputMode="numeric"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="monedaNueva">Moneda</Label>
                <select
                  id="monedaNueva"
                  value={monedaNueva}
                  onChange={(e) => setMonedaNueva(e.target.value as "CLP" | "UF")}
                  className="h-9 rounded-md border border-border bg-background px-3 text-sm"
                >
                  <option value="UF">UF</option>
                  <option value="CLP">Pesos</option>
                </select>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Con esto basta para el anuncio. Puedes completar el resto de la ficha después.
            </p>
            {propiedades.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setCreandoPropiedad(false);
                  elegirPropiedad(propiedades[0].id);
                }}
                className="text-sm text-primary underline-offset-4 hover:underline"
              >
                Usar una propiedad que ya tengo
              </button>
            )}
          </div>
        )}
      </Paso>

      {/* 2. Fotos */}
      <Paso
        numero={2}
        titulo="Sube las fotos"
        ayuda={`Son las que va a mostrar el anuncio. JPG, PNG o WebP, hasta ${formatearBytes(MAX_FILE_BYTES)} cada una.`}
        listo={fotos.length > 0}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          onChange={subirFotos}
          disabled={subiendo}
          className="hidden"
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={subiendo}
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="size-4" />
            {subiendo ? `Subiendo ${progreso.hecho + 1} de ${progreso.total}…` : "Elegir fotos"}
          </Button>
          {fotos.length > 0 && (
            <span className="text-xs text-muted-foreground">{fotos.length} foto(s)</span>
          )}
        </div>

        {rechazadas.length > 0 && (
          <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs">
            <p className="font-medium text-destructive">No se pudieron subir:</p>
            <ul className="mt-1 space-y-0.5 text-muted-foreground">
              {rechazadas.map((r) => (
                <li key={r.nombre}>
                  <span className="text-foreground">{r.nombre}</span> — {r.motivo}
                </li>
              ))}
            </ul>
          </div>
        )}

        {fotos.length > 0 && (
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {fotos.map((f) => (
              <div key={f.id} className="relative aspect-[4/3] overflow-hidden rounded-lg bg-muted">
                <Image src={f.url} alt="" fill sizes="150px" className="object-cover" />
              </div>
            ))}
          </div>
        )}

        {propiedadElegida && (
          <p className="mt-3 text-xs text-muted-foreground">
            Para reordenarlas o borrar alguna, entra a{" "}
            <Link
              href={`/propiedades/${propiedadElegida.id}`}
              className="text-primary underline-offset-4 hover:underline"
            >
              la ficha de la propiedad
            </Link>
            .
          </p>
        )}
      </Paso>

      {/* 3. Formato */}
      <Paso numero={3} titulo="¿Cómo quieres que se vea?" listo>
        <div className="grid gap-2 sm:grid-cols-2">
          <Opcion
            activa={formato === "IMAGEN_UNICA"}
            onClick={() => setFormato("IMAGEN_UNICA")}
            icono={<ImageIcon className="size-4" />}
            titulo="Una sola foto"
            ayuda="La opción más simple. Usa la primera foto que subiste."
          />
          <Opcion
            activa={formato === "CARRUSEL"}
            onClick={() => setFormato("CARRUSEL")}
            disabled={fotos.length < MIN_TARJETAS}
            icono={<Images className="size-4" />}
            titulo="Varias fotos deslizables"
            ayuda={
              fotos.length < MIN_TARJETAS
                ? `Necesitas ${MIN_TARJETAS} fotos y tienes ${fotos.length}.`
                : `Muestra hasta ${MAX_TARJETAS} vistas de la propiedad. La IA escribe el texto de cada una.`
            }
          />
        </div>
      </Paso>

      {/* 4. Destino */}
      <Paso
        numero={4}
        titulo="¿Cómo quieres que te contacten?"
        ayuda="Es lo que pasa cuando alguien hace clic en el anuncio."
        listo={Boolean(destino) && (destino !== "LANDING_SITIO_WEB" || Boolean(url.trim()))}
      >
        <div className="space-y-2">
          <Opcion
            activa={destino === "WHATSAPP"}
            onClick={() => setDestino("WHATSAPP")}
            icono={<MessageCircle className="size-4" />}
            titulo={TEXTO_DESTINO.WHATSAPP.titulo}
            ayuda={TEXTO_DESTINO.WHATSAPP.ayuda}
          />
          <Opcion
            activa={destino === "LANDING_SITIO_WEB"}
            onClick={() => setDestino("LANDING_SITIO_WEB")}
            icono={<Globe className="size-4" />}
            titulo={TEXTO_DESTINO.LANDING_SITIO_WEB.titulo}
            ayuda={TEXTO_DESTINO.LANDING_SITIO_WEB.ayuda}
          />
          {destino === "LANDING_SITIO_WEB" && (
            <div className="space-y-1.5 pt-1">
              <Label htmlFor="url">Dirección de la página</Label>
              <Input
                id="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://tusitio.cl/la-propiedad"
              />
            </div>
          )}
        </div>
      </Paso>

      {/* 5. Presupuesto */}
      <Paso
        numero={5}
        titulo="¿Cuánto quieres invertir por día?"
        ayuda="Puedes cambiarlo o detener el anuncio cuando quieras."
        listo={montoValido}
      >
        <div className="grid gap-2 sm:grid-cols-3">
          {PRESUPUESTOS_SUGERIDOS.map((p) => (
            <Opcion
              key={p.clpPorDia}
              activa={!otroMonto && presupuesto === p.clpPorDia}
              onClick={() => {
                setPresupuesto(p.clpPorDia);
                setOtroMonto("");
              }}
              icono={<span className="text-xs font-semibold">{p.etiqueta[0]}</span>}
              titulo={`$${p.clpPorDia.toLocaleString("es-CL")} al día`}
              ayuda={p.ayuda}
            />
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Label htmlFor="otro" className="text-xs text-muted-foreground">
            U otro monto:
          </Label>
          <Input
            id="otro"
            value={otroMonto}
            onChange={(e) => setOtroMonto(e.target.value)}
            placeholder="15.000"
            inputMode="numeric"
            className="h-8 w-32 text-sm"
          />
        </div>
        {montoValido && (
          <p className="mt-3 text-sm">
            Son unos{" "}
            <strong className="text-primary">
              ${gastoMensualEstimado(montoFinal).toLocaleString("es-CL")}
            </strong>{" "}
            al mes si lo dejas activo todo el tiempo.
          </p>
        )}
      </Paso>

      {/* Resumen y creación */}
      <div className="rounded-xl border border-primary/40 bg-primary/5 p-5">
        <p className="flex items-start gap-2 text-sm">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
          <span>
            Del resto nos encargamos nosotros: escribimos el texto del anuncio con IA, elegimos a
            quién mostrárselo y armamos todo en Meta. <strong>El anuncio queda pausado</strong>,
            así puedes revisarlo antes de que empiece a gastar.
          </span>
        </p>

        {problemas.length > 0 && (
          <ul className="mt-4 space-y-1 text-xs text-amber-400">
            {problemas.map((p) => (
              <li key={p} className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                {p}
              </li>
            ))}
          </ul>
        )}

        {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

        <Button
          type="button"
          className="mt-4 h-11 w-full text-base"
          disabled={problemas.length > 0 || creando}
          onClick={crear}
        >
          {creando ? "Creando tu anuncio…" : "Crear mi anuncio"}
        </Button>
      </div>
    </div>
  );
}
