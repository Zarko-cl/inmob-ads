"use client";

// Panel de segmentación (M6). Se usa tanto al crear la campaña como al editarla.
// Guarda la configuración en un <input type="hidden"> como JSON, para que viaje
// junto con el resto del formulario sin necesidad de una API aparte.

import { useState, useEffect, useEffectEvent } from "react";
import { X, Search, AlertTriangle, Plus, Sparkles } from "lucide-react";
import {
  SEGMENTACION_POR_DEFECTO,
  paisesRestringidosIncluidos,
  RADIO_MIN_KM,
  RADIO_MAX_KM,
  type ConfigSegmentacion,
  type GeoSeleccion,
  type InteresSeleccion,
} from "@/lib/meta-targeting";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { INTERESES_INMOBILIARIOS } from "@/lib/intereses-inmobiliarios";

const ETIQUETA_TIPO: Record<GeoSeleccion["type"], string> = {
  subcity: "comuna",
  city: "ciudad",
  region: "región",
  country: "país",
};

type GeoResultado = GeoSeleccion & { descripcion: string };
type InteresResultado = InteresSeleccion & { audienceSize: number | null };

// Campo de edad que se puede vaciar mientras se escribe.
//
// El problema que resuelve: con `value={numero}` y `onChange={Number(...)}`, al borrar
// el contenido `Number("")` da 0, el campo se rellena con "0" y escribir 25 deja "025".
// Acá el texto se guarda tal cual mientras el campo está en foco y solo se convierte a
// número cuando es válido; al salir del campo se acota al rango que acepta Meta.
function CampoEdad({
  id,
  valor,
  onCambio,
  deshabilitado = false,
}: {
  id: string;
  valor: number;
  onCambio: (v: number) => void;
  deshabilitado?: boolean;
}) {
  const [texto, setTexto] = useState(String(valor));

  // Si el valor cambia desde fuera (por ejemplo al restringirse la categoría especial),
  // el texto se resincroniza.
  const [valorPrevio, setValorPrevio] = useState(valor);
  if (valor !== valorPrevio) {
    setValorPrevio(valor);
    setTexto(String(valor));
  }

  return (
    <Input
      id={id}
      type="text"
      inputMode="numeric"
      disabled={deshabilitado}
      value={texto}
      onChange={(e) => {
        const limpio = e.target.value.replace(/\D/g, "");
        setTexto(limpio);
        if (limpio !== "") onCambio(Number(limpio));
      }}
      onBlur={() => {
        const n = Number(texto);
        const acotado = !texto || !Number.isFinite(n) ? valor : Math.min(Math.max(n, EDAD_MIN_META), EDAD_MAX_META);
        setTexto(String(acotado));
        onCambio(acotado);
      }}
    />
  );
}

// Rango que acepta Meta para la segmentación por edad.
const EDAD_MIN_META = 18;
const EDAD_MAX_META = 65;

const BASE_SELECT =
  "h-9 rounded-lg border border-border bg-input/30 px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";
const claseSelect = `w-full ${BASE_SELECT}`;
// Variante que NO ocupa todo el ancho, para cuando el select convive con otro campo.
const claseSelectAuto = `shrink-0 ${BASE_SELECT}`;

// Espera a que el usuario deje de escribir antes de consultar a Meta, para no
// disparar una búsqueda por cada tecla.
function useBusqueda<T>(tipo: "ubicacion" | "interes", texto: string, pais?: string) {
  const [resultados, setResultados] = useState<T[]>([]);
  const [buscando, setBuscando] = useState(false);

  // Con menos de 2 caracteres no se consulta a Meta. La condición se evalúa acá,
  // durante el render, y no dentro del efecto: antes se hacía `setResultados([])`
  // adentro, lo que obliga a React a renderizar una segunda vez solo para vaciar
  // una lista que ya sabíamos que había que esconder.
  const consultaValida = texto.trim().length >= 2;

  useEffect(() => {
    if (!consultaValida) return;
    let cancelado = false;
    const temporizador = setTimeout(async () => {
      // El indicador se enciende acá dentro, no en el cuerpo del efecto: durante
      // los 350 ms de espera todavía no hay ninguna consulta en curso, y además
      // un setState síncrono en el efecto provoca un render extra en cada tecla.
      setBuscando(true);
      try {
        const params = new URLSearchParams({ tipo, q: texto });
        if (pais) params.set("pais", pais);
        const res = await fetch(`/api/meta/targeting-search?${params.toString()}`);
        const data = await res.json();
        if (!cancelado) setResultados(data.resultados ?? []);
      } catch {
        if (!cancelado) setResultados([]);
      } finally {
        if (!cancelado) setBuscando(false);
      }
    }, 350);

    return () => {
      cancelado = true;
      clearTimeout(temporizador);
    };
  }, [tipo, texto, pais, consultaValida]);

  // Se decide al devolver, no al guardar: si la consulta no es válida no se
  // muestra nada, aunque en el estado sigan los resultados de la búsqueda anterior.
  return {
    resultados: consultaValida ? resultados : [],
    buscando: consultaValida && buscando,
  };
}

export function SegmentacionPanel({
  valorInicial,
  // Opcional: quien lo use puede enterarse de los cambios. Lo usa el formulario de
  // estrategia, donde el rango de edad y el modo deciden cuántos conjuntos se abren.
  onCambio,
  // Los intereses recomendados solo se ofrecen en la campaña avanzada: es la pantalla
  // de quien sabe lo que hace. En estrategia y modo fácil la segmentación la resuelve
  // la app, y agregar intereses ahí acotaría la audiencia sin que se note.
  mostrarRecomendados = false,
  // Id de la propiedad que se va a promocionar. Con esto el panel puede precargar su
  // comuna y ofrecer comunas parecidas.
  propertyId,
}: {
  valorInicial?: ConfigSegmentacion | null;
  onCambio?: (config: ConfigSegmentacion) => void;
  mostrarRecomendados?: boolean;
  propertyId?: string | null;
}) {
  const [config, setConfig] = useState<ConfigSegmentacion>(valorInicial ?? SEGMENTACION_POR_DEFECTO);
  // `useEffectEvent` envuelve la función del padre en una identidad estable que
  // por dentro siempre llama a la versión más reciente. Así el efecto de abajo
  // depende solo de `config` y no se re-ejecuta en cada render del padre, que es
  // lo mismo que antes se lograba a mano con una ref (pero escribir en una ref
  // durante el render está prohibido: React no garantiza cuándo ocurre).
  const avisarCambio = useEffectEvent((valor: ConfigSegmentacion) => {
    onCambio?.(valor);
  });
  const [textoUbicacion, setTextoUbicacion] = useState("");
  const [textoInteres, setTextoInteres] = useState("");
  const [paisBusqueda, setPaisBusqueda] = useState("CL");

  const { resultados: geos, buscando: buscandoGeo } = useBusqueda<GeoResultado>(
    "ubicacion",
    textoUbicacion,
    paisBusqueda
  );
  const { resultados: intereses, buscando: buscandoInteres } = useBusqueda<InteresResultado>(
    "interes",
    textoInteres
  );

  const restringidos = paisesRestringidosIncluidos(config);
  const restringido = restringidos.length > 0;

  // Avisar al componente padre va en un efecto, no dentro del setState: llamar a
  // onCambio durante el render provoca "Cannot update a component while rendering
  // a different component" en React.
  useEffect(() => {
    avisarCambio(config);
  }, [config]);

  function actualizar(cambios: Partial<ConfigSegmentacion>) {
    setConfig((previo) => ({ ...previo, ...cambios }));
  }

  // --- Comuna de la propiedad y comunas parecidas ---
  const [sugeridas, setSugeridas] = useState<(GeoSeleccion & { motivo: string })[]>([]);
  const [buscandoComunas, setBuscandoComunas] = useState(false);
  const [avisoComunas, setAvisoComunas] = useState<string | null>(null);
  // Para no precargar dos veces la misma propiedad ni pisar lo que el usuario ya eligió.
  const [propiedadPrecargada, setPropiedadPrecargada] = useState<string | null>(null);

  async function pedirSugerencias(conIa: boolean) {
    if (!propertyId) return;
    if (conIa) setBuscandoComunas(true);
    setAvisoComunas(null);
    try {
      const res = await fetch("/api/segmentacion/sugerencias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId, conIa }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudieron obtener sugerencias.");

      if (data.aviso) setAvisoComunas(data.aviso);
      if (Array.isArray(data.sugeridas)) setSugeridas(data.sugeridas);

      // La comuna de la propiedad se precarga sola, una sola vez y solo si el usuario
      // todavía no tocó las ubicaciones (para no borrarle lo que eligió).
      if (data.comuna && !conIa) {
        setConfig((previo) => {
          const soloPais =
            previo.ubicaciones.length === 0 ||
            (previo.ubicaciones.length === 1 && previo.ubicaciones[0].type === "country");
          if (!soloPais) return previo;
          return { ...previo, ubicaciones: [data.comuna] };
        });
      }
    } catch (err) {
      setAvisoComunas(err instanceof Error ? err.message : "Error obteniendo sugerencias");
    } finally {
      setBuscandoComunas(false);
    }
  }

  // Al cambiar la propiedad elegida se precarga su comuna. Va durante el render (no en
  // un efecto) para decidir si hay que pedirla; la petición en sí se dispara aparte.
  if (propertyId && propertyId !== propiedadPrecargada) {
    setPropiedadPrecargada(propertyId);
    setSugeridas([]);
    setAvisoComunas(null);
    void pedirSugerencias(false);
  }

  function agregarUbicacion(geo: GeoResultado) {
    if (config.ubicaciones.some((u) => u.key === geo.key)) return;
    const { descripcion, ...limpio } = geo;
    void descripcion;

    // Un país no puede convivir con divisiones internas: Meta anula el alcance
    // (país+región) o hace que el país absorba a la comuna. Al agregar algo más
    // específico, se quita el país del mismo territorio.
    let ubicaciones = config.ubicaciones;
    if (geo.type !== "country") {
      ubicaciones = ubicaciones.filter((u) => u.type !== "country");
    } else {
      ubicaciones = ubicaciones.filter((u) => u.type === "country");
    }

    actualizar({
      ubicaciones: [
        ...ubicaciones,
        // Solo las ciudades llevan radio; las comunas se segmentan completas.
        { ...limpio, radiusKm: geo.type === "city" ? RADIO_MIN_KM : undefined },
      ],
    });
    setTextoUbicacion("");
  }

  function agregarInteres(interes: InteresResultado) {
    if (config.intereses.some((i) => i.id === interes.id)) return;
    actualizar({ intereses: [...config.intereses, { id: interes.id, name: interes.name }] });
    setTextoInteres("");
  }

  // Los recomendados que todavía no están elegidos.
  const recomendadosDisponibles = INTERESES_INMOBILIARIOS.filter(
    (r) => !config.intereses.some((i) => i.id === r.id)
  );

  function agregarTodosLosRecomendados() {
    actualizar({
      intereses: [
        ...config.intereses,
        ...recomendadosDisponibles.map((r) => ({ id: r.id, name: r.name })),
      ],
    });
  }

  return (
    <fieldset className="space-y-4 rounded-xl border border-border bg-background/40 p-4">
      <legend className="px-2 text-sm font-medium">Segmentación</legend>

      {/* Todo el estado viaja al servidor en este campo oculto. */}
      <input type="hidden" name="segmentacion" value={JSON.stringify(config)} />

      <div className="space-y-2">
        <Label htmlFor="modo-segmentacion">Modo</Label>
        <select
          id="modo-segmentacion"
          value={config.modo}
          onChange={(e) => {
            const modo = e.target.value as "MANUAL" | "AUTOMATICO";
            // Advantage+ no admite un rango de edad acotado: Meta rechaza el conjunto
            // con cualquier valor distinto de 18-65. Se ajusta acá para que el usuario
            // lo vea al elegir, en vez de descubrirlo al publicar.
            actualizar(
              modo === "AUTOMATICO"
                ? { modo, edadMin: EDAD_MIN_META, edadMax: EDAD_MAX_META }
                : { modo }
            );
          }}
          className={claseSelect}
        >
          <option value="MANUAL">Manual — tú defines la audiencia</option>
          <option value="AUTOMATICO">Automático (Advantage+) — Meta amplía la audiencia</option>
        </select>
        <p className="text-xs text-muted-foreground">
          {config.modo === "MANUAL"
            ? "Se usa exactamente lo que definas abajo."
            : "Lo de abajo se usa como punto de partida; Meta busca más gente parecida si eso mejora el resultado."}
        </p>
        {config.modo === "AUTOMATICO" && (
          <p className="text-xs text-amber-400">
            Con Advantage+, Meta no deja acotar la edad: queda en 18-65. Si necesitas un
            rango específico (por ejemplo 30-55), cambia a manual.
          </p>
        )}
      </div>

      {restringido && (
        <div className="flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-400">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div>
            Incluiste {restringidos.join(", ")}, donde Meta obliga a usar la categoría especial de
            vivienda. Para esta campaña se ignoran edad, género e intereses (18-65, todos los géneros)
            y el radio mínimo sube a 25 km. En Chile esto no aplica.
          </div>
        </div>
      )}

      {/* Ubicaciones */}
      <div className="space-y-2">
        <Label>Ubicaciones</Label>

        <div className="grid gap-2">
          {config.ubicaciones.map((u) => (
            <div
              key={u.key}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm"
            >
              <span className="flex-1">
                {u.name} <span className="text-xs text-muted-foreground">({ETIQUETA_TIPO[u.type]})</span>
              </span>

              {/* El radio solo aplica a ciudades: en una comuna deja el alcance en
                  cero. Meta solo acepta entre 16 y 80 km. */}
              {u.type === "city" && (
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  radio
                  <Input
                    type="number"
                    min={RADIO_MIN_KM}
                    max={RADIO_MAX_KM}
                    value={u.radiusKm ?? RADIO_MIN_KM}
                    onChange={(e) =>
                      actualizar({
                        ubicaciones: config.ubicaciones.map((x) =>
                          x.key === u.key ? { ...x, radiusKm: Number(e.target.value) } : x
                        ),
                      })
                    }
                    className="h-7 w-16 px-2"
                  />
                  km
                </label>
              )}
              {u.type === "subcity" && (
                <span className="text-xs text-muted-foreground">comuna completa</span>
              )}

              <button
                type="button"
                onClick={() => actualizar({ ubicaciones: config.ubicaciones.filter((x) => x.key !== u.key) })}
                className="text-destructive transition-opacity hover:opacity-70"
                aria-label={`Quitar ${u.name}`}
              >
                <X className="size-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={textoUbicacion}
              onChange={(e) => setTextoUbicacion(e.target.value)}
              placeholder="Buscar comuna, región o país (ej: Providencia)"
              className="pl-8"
            />
          </div>
          <select
            value={paisBusqueda}
            onChange={(e) => setPaisBusqueda(e.target.value)}
            title="País donde buscar"
            className={claseSelectAuto}
          >
            <option value="CL">Chile</option>
            <option value="TODOS">Todos</option>
          </select>
        </div>

        {/* Comunas parecidas a la de la propiedad. La IA las propone y Meta decide
            cuáles existen: las que no están en su catálogo se descartan antes de
            llegar acá, porque una clave inventada deja el anuncio sin entrega. */}
        {propertyId && !restringido && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-medium">Comunas parecidas</p>
              <button
                type="button"
                onClick={() => pedirSugerencias(true)}
                disabled={buscandoComunas}
                className="inline-flex items-center gap-1 text-xs text-primary underline-offset-4 hover:underline disabled:opacity-60"
              >
                <Sparkles className="size-3" />
                {buscandoComunas ? "Buscando…" : sugeridas.length ? "Buscar de nuevo" : "Sugerir con IA"}
              </button>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Comunas con nivel socioeconómico parecido al que necesita esta propiedad,
              considerando su precio y su ubicación.
            </p>

            {sugeridas.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {sugeridas
                  .filter((s) => !config.ubicaciones.some((u) => u.key === s.key))
                  .map((s) => (
                    <button
                      key={s.key}
                      type="button"
                      title={s.motivo}
                      onClick={() => agregarUbicacion({ ...s, descripcion: s.motivo })}
                      className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-xs transition-colors hover:border-primary hover:text-primary"
                    >
                      <Plus className="size-3" />
                      {s.name}
                    </button>
                  ))}
              </div>
            )}

            {avisoComunas && <p className="mt-2 text-[11px] text-amber-400">{avisoComunas}</p>}
          </div>
        )}

        {buscandoGeo && <p className="text-xs text-muted-foreground">Buscando…</p>}
        {geos.length > 0 && (
          <ul className="overflow-hidden rounded-lg border border-border bg-card">
            {geos.map((g) => (
              <li key={g.key}>
                <button
                  type="button"
                  onClick={() => agregarUbicacion(g)}
                  className="w-full px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
                >
                  {g.name}{" "}
                  <span className="text-xs text-muted-foreground">
                    {ETIQUETA_TIPO[g.type]} · {g.descripcion}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {!restringido && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="edad-min">Edad mínima</Label>
              <CampoEdad
                id="edad-min"
                valor={config.edadMin}
                deshabilitado={config.modo === "AUTOMATICO"}
                onCambio={(v) => actualizar({ edadMin: v })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edad-max">Edad máxima</Label>
              <CampoEdad
                id="edad-max"
                valor={config.edadMax}
                deshabilitado={config.modo === "AUTOMATICO"}
                onCambio={(v) => actualizar({ edadMax: v })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="genero">Género</Label>
              <select
                id="genero"
                value={config.generos.length === 1 ? config.generos[0] : "TODOS"}
                onChange={(e) =>
                  actualizar({
                    generos: e.target.value === "TODOS" ? [] : [e.target.value as "HOMBRES" | "MUJERES"],
                  })
                }
                className={claseSelect}
              >
                <option value="TODOS">Todos</option>
                <option value="HOMBRES">Hombres</option>
                <option value="MUJERES">Mujeres</option>
              </select>
            </div>
          </div>

          {/* Intereses */}
          <div className="space-y-2">
            <Label>Intereses</Label>

            {/* Recomendados para inmobiliaria. Los ids son los reales del catálogo de
                Meta (ver lib/intereses-inmobiliarios.ts). No se activan solos porque
                agregar intereses REDUCE la audiencia: Meta muestra el anuncio solo a
                quien calce con alguno. El usuario decide cuánto acotar. */}
            {mostrarRecomendados && recomendadosDisponibles.length > 0 && (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-medium">Recomendados para inmobiliaria</p>
                  <button
                    type="button"
                    onClick={agregarTodosLosRecomendados}
                    className="text-xs text-primary underline-offset-4 hover:underline"
                  >
                    Agregar los {recomendadosDisponibles.length}
                  </button>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Personas que buscan o piensan comprar una propiedad. Ojo: mientras más
                  agregues, a menos gente le llega el anuncio.
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {recomendadosDisponibles.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      title={r.paraQue}
                      onClick={() => agregarInteres({ id: r.id, name: r.name, audienceSize: null })}
                      className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-xs transition-colors hover:border-primary hover:text-primary"
                    >
                      <Plus className="size-3" />
                      {r.name.replace(/\s*\([^)]*\)$/, "")}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {config.intereses.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {config.intereses.map((i) => (
                  <Badge key={i.id} variant="secondary" className="gap-1.5">
                    {i.name}
                    <button
                      type="button"
                      onClick={() => actualizar({ intereses: config.intereses.filter((x) => x.id !== i.id) })}
                      className="text-destructive transition-opacity hover:opacity-70"
                      aria-label={`Quitar ${i.name}`}
                    >
                      <X className="size-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}

            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={textoInteres}
                onChange={(e) => setTextoInteres(e.target.value)}
                placeholder="Buscar interés (ej: bienes raíces)"
                className="pl-8"
              />
            </div>

            {buscandoInteres && <p className="text-xs text-muted-foreground">Buscando…</p>}
            {intereses.length > 0 && (
              <ul className="overflow-hidden rounded-lg border border-border bg-card">
                {intereses.map((i) => (
                  <li key={i.id}>
                    <button
                      type="button"
                      onClick={() => agregarInteres(i)}
                      className="w-full px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
                    >
                      {i.name}
                      {i.audienceSize && (
                        <span className="text-xs text-muted-foreground">
                          {" "}
                          — {i.audienceSize.toLocaleString("es-CL")} personas
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </fieldset>
  );
}
