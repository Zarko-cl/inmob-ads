"use client";

// Panel de fotos de una propiedad (M8): subir, seleccionar, reordenar y eliminar.
//
// Se pueden elegir varias fotos de una vez. Se suben **en serie**, no en paralelo,
// a propósito: el servidor asigna el campo `orden` contando las fotos que ya hay,
// así que dos subidas simultáneas se pisarían el número y el carrusel saldría
// desordenado. En serie el orden queda igual al de la selección.

import { useState, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Upload,
  Trash2,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Save,
  Undo2,
  CheckSquare,
  Square,
  ArrowUpDown,
} from "lucide-react";
import { validarArchivo, formatearBytes, MAX_FILE_BYTES } from "@/lib/storage-limits";
import { Button } from "@/components/ui/button";

type Foto = {
  id: string;
  url: string;
  sizeBytes: number | null;
};

// En cuántas campañas y tarjetas de carrusel se usa cada foto, para avisar antes
// de borrar algo que va a dejar una campaña sin creativo.
type UsoFoto = { campanas: number; tarjetas: number };

// Una foto que no se pudo subir, con el motivo, para poder listarlas todas juntas
// en vez de cortar la subida en la primera que falla.
type Rechazada = { nombre: string; motivo: string };

export function FotosPanel({
  propertyId,
  fotos,
  uso,
  storageConfigurado,
  motivoStorage,
}: {
  propertyId: string;
  fotos: Foto[];
  uso: Record<string, UsoFoto>;
  storageConfigurado: boolean;
  motivoStorage?: string | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [subiendo, setSubiendo] = useState(false);
  const [progreso, setProgreso] = useState({ hecho: 0, total: 0 });
  const [rechazadas, setRechazadas] = useState<Rechazada[]>([]);
  const [subidasOk, setSubidasOk] = useState(0);

  // Orden que se está viendo en pantalla. Puede diferir del guardado mientras el
  // usuario mueve fotos y todavía no aprieta "Guardar orden".
  const [orden, setOrden] = useState<Foto[]>(fotos);
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false);
  const [arrastrando, setArrastrando] = useState<number | null>(null);
  // Modo edición del orden. Está separado de la selección con casillas a propósito:
  // arrastrar para reordenar y marcar para borrar son dos gestos distintos sobre las
  // mismas fotos, y mezclarlos hace que ninguno se entienda.
  const [modoOrden, setModoOrden] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cuando el servidor manda otra lista (se subió, se borró o se guardó el orden),
  // la pantalla se vuelve a sincronizar con lo que hay realmente en la base.
  //
  // Esto va durante el render y no en un useEffect a propósito: es el patrón que
  // recomienda React para "reiniciar estado cuando cambia una prop". React detecta
  // el setState, descarta este render y vuelve a renderizar con el valor nuevo,
  // sin pintar el intermedio. Con useEffect el usuario alcanzaría a ver un parpadeo
  // con los datos viejos.
  const firmaServidor = fotos.map((f) => f.id).join(",");
  const [firmaPrevia, setFirmaPrevia] = useState(firmaServidor);
  if (firmaServidor !== firmaPrevia) {
    setFirmaPrevia(firmaServidor);
    setOrden(fotos);
    setSeleccion(new Set());
    setConfirmandoBorrado(false);
    setModoOrden(false);
  }

  const ordenCambiado = orden.map((f) => f.id).join(",") !== firmaServidor;

  async function alElegirArchivos(e: React.ChangeEvent<HTMLInputElement>) {
    const elegidos = Array.from(e.target.files ?? []);
    if (elegidos.length === 0) return;

    // Validación ANTES de subir: las que no cumplen ni siquiera se envían (ahorra
    // tiempo y datos), pero no bloquean a las demás.
    const problemas: Rechazada[] = [];
    const validos: File[] = [];
    for (const archivo of elegidos) {
      const problema = validarArchivo(archivo);
      if (problema) problemas.push({ nombre: archivo.name, motivo: problema });
      else validos.push(archivo);
    }

    setRechazadas(problemas);
    setSubidasOk(0);
    setProgreso({ hecho: 0, total: validos.length });

    if (validos.length === 0) {
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    setSubiendo(true);
    let correctas = 0;
    for (const archivo of validos) {
      try {
        const datos = new FormData();
        datos.append("archivo", archivo);

        const res = await fetch(`/api/propiedades/${propertyId}/fotos`, {
          method: "POST",
          body: datos,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "No se pudo subir la foto.");
        correctas += 1;
      } catch (err) {
        problemas.push({
          nombre: archivo.name,
          motivo: err instanceof Error ? err.message : "Error subiendo la foto",
        });
        setRechazadas([...problemas]);
      } finally {
        setProgreso((p) => ({ ...p, hecho: p.hecho + 1 }));
      }
    }

    setSubidasOk(correctas);
    setSubiendo(false);
    if (inputRef.current) inputRef.current.value = "";
    router.refresh();
  }

  function alternarSeleccion(id: string) {
    setConfirmandoBorrado(false);
    setSeleccion((actual) => {
      const copia = new Set(actual);
      if (copia.has(id)) copia.delete(id);
      else copia.add(id);
      return copia;
    });
  }

  // Mueve la foto de la posición `desde` a la posición `hasta`. Sirve tanto para las
  // flechas (hasta = desde ± 1) como para arrastrar y soltar en cualquier posición.
  function mover(desde: number, hasta: number) {
    setOrden((actuales) => {
      if (hasta < 0 || hasta >= actuales.length || desde === hasta) return actuales;
      const copia = [...actuales];
      const [movida] = copia.splice(desde, 1);
      copia.splice(hasta, 0, movida);
      return copia;
    });
  }

  async function guardarOrden() {
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch(`/api/propiedades/${propertyId}/fotos/orden`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: orden.map((f) => f.id) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo guardar el orden.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error guardando el orden");
    } finally {
      setGuardando(false);
    }
  }

  async function borrarSeleccionadas() {
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch(`/api/propiedades/${propertyId}/fotos/borrar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [...seleccion] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudieron borrar las fotos.");
      setSeleccion(new Set());
      setConfirmandoBorrado(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error borrando las fotos");
    } finally {
      setGuardando(false);
    }
  }

  // Cuántas campañas/tarjetas quedarían afectadas si se borra lo seleccionado.
  const afectadas = [...seleccion].reduce(
    (acc, id) => {
      const u = uso[id];
      if (u) {
        acc.campanas += u.campanas;
        acc.tarjetas += u.tarjetas;
      }
      return acc;
    },
    { campanas: 0, tarjetas: 0 }
  );

  return (
    <section>
      <div className="mb-1 flex items-center justify-between gap-3">
        <h2 className="font-medium">Fotos</h2>
        <span className="text-xs text-muted-foreground">
          JPG, PNG o WebP · máx. {formatearBytes(MAX_FILE_BYTES)} por foto
        </span>
      </div>

      {!storageConfigurado && (
        <div className="mt-3 flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>
            El almacenamiento de archivos no está configurado. Hasta entonces no se pueden
            subir fotos.
            {motivoStorage && <span className="mt-1 block opacity-90">{motivoStorage}</span>}
          </span>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input
          ref={inputRef}
          id="foto"
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          onChange={alElegirArchivos}
          disabled={subiendo || !storageConfigurado}
          className="hidden"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={subiendo || !storageConfigurado}
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="size-4" />
          {subiendo ? `Subiendo ${progreso.hecho + 1} de ${progreso.total}…` : "Subir fotos"}
        </Button>

        {orden.length > 1 && !modoOrden && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setModoOrden(true);
              setSeleccion(new Set());
              setConfirmandoBorrado(false);
            }}
          >
            <ArrowUpDown className="size-4" />
            Cambiar el orden
          </Button>
        )}

        {orden.length > 0 && !modoOrden && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() =>
              setSeleccion(
                seleccion.size === orden.length ? new Set() : new Set(orden.map((f) => f.id))
              )
            }
          >
            {seleccion.size === orden.length ? (
              <Square className="size-4" />
            ) : (
              <CheckSquare className="size-4" />
            )}
            {seleccion.size === orden.length ? "Quitar selección" : "Seleccionar todas"}
          </Button>
        )}

        {subiendo && progreso.total > 1 && (
          <div className="h-1.5 w-40 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${(progreso.hecho / progreso.total) * 100}%` }}
            />
          </div>
        )}
      </div>

      {!subiendo && subidasOk > 0 && (
        <p className="mt-3 text-sm text-emerald-400">
          {subidasOk} foto{subidasOk === 1 ? "" : "s"} subida{subidasOk === 1 ? "" : "s"}.
        </p>
      )}

      {rechazadas.length > 0 && (
        <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3">
          <p className="flex items-center gap-2 text-sm font-medium text-destructive">
            <AlertTriangle className="size-4 shrink-0" />
            {rechazadas.length} foto{rechazadas.length === 1 ? "" : "s"} no se pudo
            {rechazadas.length === 1 ? "" : "n"} subir
          </p>
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
            {rechazadas.map((r) => (
              <li key={r.nombre}>
                <span className="text-foreground">{r.nombre}</span> — {r.motivo}
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

      {/* Barra de acciones sobre la selección */}
      {seleccion.size > 0 && !modoOrden && (
        <div className="mt-3 rounded-lg border border-border bg-background/60 px-4 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm">
              {seleccion.size} foto{seleccion.size === 1 ? "" : "s"} seleccionada
              {seleccion.size === 1 ? "" : "s"}
            </span>
            {confirmandoBorrado ? (
              <>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={guardando}
                  onClick={borrarSeleccionadas}
                >
                  <Trash2 className="size-4" />
                  {guardando ? "Borrando…" : `Sí, borrar ${seleccion.size}`}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmandoBorrado(false)}
                >
                  Cancelar
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => setConfirmandoBorrado(true)}
                >
                  <Trash2 className="size-4" />
                  Borrar seleccionadas
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSeleccion(new Set())}
                >
                  Quitar selección
                </Button>
              </>
            )}
          </div>

          {(afectadas.campanas > 0 || afectadas.tarjetas > 0) && (
            <p className="mt-2 flex items-start gap-2 text-xs text-amber-400">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              Hay fotos en uso: {afectadas.campanas > 0 && `${afectadas.campanas} anuncio(s) quedarían sin foto`}
              {afectadas.campanas > 0 && afectadas.tarjetas > 0 && " y "}
              {afectadas.tarjetas > 0 && `${afectadas.tarjetas} tarjeta(s) de carrusel se eliminarían`}.
              Vas a tener que volver a elegir el creativo en esas campañas.
            </p>
          )}
        </div>
      )}

      {/* Barra del modo edición del orden */}
      {modoOrden && (
        <div className="mt-3 rounded-lg border border-primary/50 bg-primary/5 px-4 py-3">
          <p className="text-sm font-medium">Estás cambiando el orden</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Arrastra una foto sobre otra para moverla, o usa las flechas. La primera es la
            portada de la propiedad y la que abre el carrusel.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button type="button" size="sm" disabled={guardando || !ordenCambiado} onClick={guardarOrden}>
              <Save className="size-4" />
              {guardando ? "Guardando…" : "Guardar orden"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setOrden(fotos);
                setModoOrden(false);
                setError(null);
              }}
            >
              Cancelar
            </Button>
            {ordenCambiado && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setOrden(fotos)}>
                <Undo2 className="size-4" />
                Deshacer cambios
              </Button>
            )}
          </div>
        </div>
      )}

      {orden.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">Todavía no hay fotos cargadas.</p>
      ) : (
        <>
          {!modoOrden && (
            <p className="mt-4 text-xs text-muted-foreground">
              La primera foto es la portada y el carrusel las toma en este orden. Para cambiarlo,
              usa “Cambiar el orden”.
            </p>
          )}
          <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {orden.map((foto, i) => {
              const elegida = seleccion.has(foto.id);
              const enUso = uso[foto.id];
              return (
                <div
                  key={foto.id}
                  draggable={modoOrden}
                  onDragStart={(e) => {
                    // Firefox exige que el arrastre lleve algún dato para iniciarse.
                    e.dataTransfer.setData("text/plain", foto.id);
                    e.dataTransfer.effectAllowed = "move";
                    setArrastrando(i);
                  }}
                  // Sin preventDefault el navegador no considera esta zona una
                  // destinación válida y nunca dispara onDrop.
                  onDragOver={(e) => {
                    if (!modoOrden) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                  }}
                  onDrop={(e) => {
                    if (!modoOrden) return;
                    e.preventDefault();
                    if (arrastrando !== null) mover(arrastrando, i);
                    setArrastrando(null);
                  }}
                  onDragEnd={() => setArrastrando(null)}
                  // La atenuación va como estilo directo y no como clase de Tailwind:
                  // así no depende de que la utilidad se haya generado en el CSS.
                  style={{ opacity: arrastrando === i ? 0.4 : 1 }}
                  className={`overflow-hidden rounded-lg border-2 transition-all ${
                    modoOrden ? "cursor-grab active:cursor-grabbing" : ""
                  } ${
                    modoOrden
                      ? arrastrando === i
                        ? "border-primary"
                        : "border-primary/40"
                      : elegida
                        ? "border-primary"
                        : "border-border"
                  }`}
                >
                  <div className="relative aspect-[4/3] w-full bg-muted">
                    {/* next/image sirve una miniatura del tamaño que se ve, no la foto
                        completa de varios MB. `sizes` le dice cuánto ancho ocupa según
                        la pantalla para que elija bien. */}
                    {/* draggable={false}: las imágenes son arrastrables por defecto en
                        HTML. Sin esto, al arrastrar desde la foto el navegador arrastra
                        LA IMAGEN (su archivo) en vez de la tarjeta, y el reordenamiento
                        parece no funcionar. */}
                    <Image
                      src={foto.url}
                      alt=""
                      fill
                      draggable={false}
                      sizes="(max-width: 640px) 50vw, 33vw"
                      className="object-cover"
                    />
                    {modoOrden ? (
                      <span className="absolute left-2 top-2 flex size-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground shadow-lg">
                        {i + 1}
                      </span>
                    ) : (
                      <label className="absolute left-2 top-2 flex cursor-pointer items-center gap-1.5 rounded-md bg-background/85 px-2 py-1 backdrop-blur-sm">
                        <input
                          type="checkbox"
                          checked={elegida}
                          onChange={() => alternarSeleccion(foto.id)}
                          className="size-4 accent-primary"
                          aria-label={`Seleccionar foto ${i + 1}`}
                        />
                        <span className="text-xs font-medium">{i + 1}</span>
                      </label>
                    )}
                    {enUso && (
                      <span className="absolute right-2 top-2 rounded-md bg-background/85 px-2 py-1 text-[11px] text-amber-400 backdrop-blur-sm">
                        En uso
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2 px-2 py-1.5">
                    <span className="text-xs text-muted-foreground">
                      {foto.sizeBytes ? formatearBytes(foto.sizeBytes) : ""}
                    </span>
                    {modoOrden && (
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={i === 0}
                          onClick={() => mover(i, i - 1)}
                          aria-label={`Mover la foto ${i + 1} hacia atrás`}
                        >
                          <ArrowLeft className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={i === orden.length - 1}
                          onClick={() => mover(i, i + 1)}
                          aria-label={`Mover la foto ${i + 1} hacia adelante`}
                        >
                          <ArrowRight className="size-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
