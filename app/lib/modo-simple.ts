// Modo simple: crear un anuncio sin saber nada de publicidad.
//
// La app decide por el usuario todo lo que es técnico (objetivo de Meta, segmentación,
// optimización, nombres, copy) y le pide solo las tres cosas que nadie más puede
// responder por él: qué propiedad promociona, dónde quiere que lo contacten y cuánto
// está dispuesto a gastar.
//
// Este archivo es la fuente única de esas decisiones automáticas, para que estén en
// un solo lugar y se puedan revisar sin leer la ruta entera.

import type { CampaignTypeKey } from "@/lib/meta-campaign-types";
import type { ConfigSegmentacion } from "@/lib/meta-targeting";

// Solo dos destinos en modo simple. Los otros dos tipos que soporta la app
// (formulario instantáneo e Instagram/Messenger) piden configuración previa en Meta
// que un usuario nuevo no tiene, así que quedan para la vista avanzada.
export const DESTINOS_SIMPLES = ["WHATSAPP", "LANDING_SITIO_WEB"] as const;
export type DestinoSimple = (typeof DESTINOS_SIMPLES)[number];

export function esDestinoSimple(valor: string): valor is DestinoSimple {
  return (DESTINOS_SIMPLES as readonly string[]).includes(valor);
}

export const TEXTO_DESTINO: Record<DestinoSimple, { titulo: string; ayuda: string }> = {
  WHATSAPP: {
    titulo: "Que te escriban por WhatsApp",
    ayuda:
      "Quien vea el anuncio abre un chat contigo directamente. Es lo más directo para coordinar una visita.",
  },
  LANDING_SITIO_WEB: {
    titulo: "Que visiten la ficha de la propiedad",
    ayuda: "El anuncio lleva a una página web con las fotos y los datos. Necesitas la dirección.",
  },
};

// Presupuestos sugeridos en pesos por día. No son mágicos: son montos redondos que
// dejan a cada conjunto muy por encima del mínimo de Meta (918 CLP diarios en esta
// cuenta) para que el anuncio salga de la fase de aprendizaje.
export const PRESUPUESTOS_SUGERIDOS = [
  { clpPorDia: 5000, etiqueta: "Bajo", ayuda: "Para probar si la propiedad genera interés." },
  { clpPorDia: 10000, etiqueta: "Medio", ayuda: "El más usado. Alcance razonable sin arriesgar mucho." },
  { clpPorDia: 20000, etiqueta: "Alto", ayuda: "Para una propiedad que necesitas mover rápido." },
] as const;

// Por debajo de esto Meta directamente no entrega el anuncio (ver lib/estrategia.ts).
export const MINIMO_DIARIO_CLP = 1000;

export function gastoMensualEstimado(clpPorDia: number): number {
  return Math.round(clpPorDia * 30);
}

// Segmentación automática: Advantage+ Audience, Chile completo, 18-65.
//
// Es deliberado que en modo simple no se pueda segmentar a mano. Una segmentación
// mal hecha (audiencia diminuta, intereses que no aplican) es de las formas más
// rápidas de quemar presupuesto, y Advantage+ deja que Meta encuentre la audiencia
// con su propio modelo. Quien sepa segmentar tiene la vista avanzada.
export const SEGMENTACION_SIMPLE: ConfigSegmentacion = {
  modo: "AUTOMATICO",
  ubicaciones: [{ key: "CL", name: "Chile", type: "country", countryCode: "CL" }],
  // Advantage+ no admite acotar la edad (Meta rechaza el conjunto), así que acá va
  // el rango completo. Quien quiera 30-55 tiene la campaña avanzada, en modo manual.
  edadMin: 18,
  edadMax: 65,
  generos: [],
  intereses: [],
};

// El nombre de la campaña no se le pide al usuario: no aporta nada y es una decisión
// más. Se arma con la propiedad y la fecha para que sea reconocible en Ads Manager.
export function nombreAutomatico(tituloPropiedad: string, fecha = new Date()): string {
  const mes = fecha.toLocaleDateString("es-CL", { month: "short", year: "numeric" });
  return `${tituloPropiedad} — ${mes}`;
}

export function tipoDeCampana(destino: DestinoSimple): CampaignTypeKey {
  return destino;
}
