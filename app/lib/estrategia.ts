// Estrategia de marketing (generación de varias campañas a la vez).
//
// El usuario puede crear una campaña suelta o una "estrategia": una estructura
// completa de campañas/conjuntos/anuncios dimensionada según el presupuesto mensual.
//
// Cantidad de CAMPAÑAS (regla definida por Paul):
//   - Menos de $100.000/mes     -> 1 campaña
//   - Entre $100.000 y $500.000 -> 2 campañas
//   - Más de $500.000           -> 4 campañas
//
// Cantidad de CONJUNTOS por campaña: NO es fija, se calcula acá (ver
// planificarConjuntos) para evitar dos problemas conocidos de Meta:
//   1. Fragmentar el presupuesto entre muchos conjuntos impide que cada uno junte
//      los eventos necesarios para salir de la fase de aprendizaje.
//   2. Conjuntos que apuntan a la misma gente compiten entre sí en la subasta
//      ("auction overlap") y encarecen el costo del propio anunciante.

import type { ConfigSegmentacion } from "@/lib/meta-targeting";

export const ANUNCIOS_POR_CONJUNTO = 4;

// Presupuesto diario mínimo por conjunto que exige Meta para billing_event =
// IMPRESSIONS en cuentas en CLP. Dato leído de la cuenta real
// (act_.../minimum_budgets -> min_daily_budget_imp = 918). Es un límite duro: bajo
// esto la API rechaza o el conjunto no entrega.
export const MIN_DIARIO_POR_CONJUNTO_CLP = 918;

// Piso "sano" para abrir un conjunto ADICIONAL. Muy por encima del mínimo duro:
// un conjunto con el mínimo apenas entrega y nunca sale de la fase de aprendizaje.
// Es una heurística, no un dato de la API: se prefiere un conjunto bien financiado
// antes que dos a medias.
export const MIN_SALUDABLE_POR_CONJUNTO_CLP = 3_000;

// Tope de conjuntos por campaña. Más allá de esto la campaña se fragmenta aunque
// haya presupuesto: es preferible subir el gasto por conjunto.
export const MAX_CONJUNTOS_POR_CAMPANA = 5;

// Ancho mínimo de cada banda de edad. Bandas más angostas dejan audiencias
// demasiado chicas y vuelven a fragmentar la entrega.
const ANCHO_MIN_BANDA_ANOS = 8;

// Meta calcula el gasto por día, así que el presupuesto mensual se reparte sobre
// 30 días. Es una aproximación deliberada: no se ajusta por meses de 28 o 31.
export const DIAS_POR_MES = 30;

export type NivelEstrategia = 1 | 2 | 3;

export function nivelPorPresupuesto(mensualClp: number): NivelEstrategia {
  if (mensualClp < 100_000) return 1;
  // El tramo intermedio incluye los $500.000 exactos; sobre eso pasa al nivel 3.
  if (mensualClp <= 500_000) return 2;
  return 3;
}

const CAMPANAS_POR_NIVEL: Record<NivelEstrategia, number> = { 1: 1, 2: 2, 3: 4 };

export type BandaEdad = { edadMin: number; edadMax: number };

export type PlanConjuntos = {
  cantidad: number;
  // Bandas de edad que NO se solapan, una por conjunto. null cuando hay un solo
  // conjunto (usa el rango completo tal como lo definió el usuario).
  bandas: BandaEdad[] | null;
  motivo: string;
};

// Divide un rango de edad en bandas contiguas que no se pisan.
// Ej: 25-64 en 3 bandas -> 25-37, 38-51, 52-64.
function dividirEdades(edadMin: number, edadMax: number, cantidad: number): BandaEdad[] {
  const total = edadMax - edadMin + 1;
  const ancho = Math.floor(total / cantidad);
  return Array.from({ length: cantidad }, (_, i) => ({
    edadMin: edadMin + i * ancho,
    // La última banda absorbe el resto de la división para no dejar edades fuera.
    edadMax: i === cantidad - 1 ? edadMax : edadMin + (i + 1) * ancho - 1,
  }));
}

export function planificarConjuntos(
  diarioPorCampanaClp: number,
  segmentacion?: ConfigSegmentacion | null
): PlanConjuntos {
  // Advantage+ funciona mejor concentrado: Meta amplía la audiencia por su cuenta,
  // así que abrir varios conjuntos solo los haría competir entre ellos.
  if (segmentacion?.modo === "AUTOMATICO") {
    return {
      cantidad: 1,
      bandas: null,
      motivo:
        "Advantage+ amplía la audiencia por su cuenta: se usa un solo conjunto para no competir contra sí mismo.",
    };
  }

  const edadMin = segmentacion?.edadMin ?? 18;
  const edadMax = segmentacion?.edadMax ?? 65;

  // Tres topes distintos; manda el más restrictivo.
  const porPresupuesto = Math.floor(diarioPorCampanaClp / MIN_SALUDABLE_POR_CONJUNTO_CLP);
  const porRangoEtario = Math.floor((edadMax - edadMin + 1) / ANCHO_MIN_BANDA_ANOS);
  const cantidad = Math.max(
    1,
    Math.min(porPresupuesto, porRangoEtario, MAX_CONJUNTOS_POR_CAMPANA)
  );

  if (cantidad === 1) {
    const razon =
      porPresupuesto < 2
        ? `el presupuesto diario de la campaña ($${diarioPorCampanaClp.toLocaleString("es-CL")}) alcanza para un conjunto bien financiado`
        : `el rango de edad (${edadMin}-${edadMax}) es muy angosto para dividirlo`;
    return { cantidad: 1, bandas: null, motivo: `Un conjunto: ${razon}.` };
  }

  const limitante =
    porPresupuesto <= porRangoEtario && porPresupuesto <= MAX_CONJUNTOS_POR_CAMPANA
      ? "según el presupuesto disponible"
      : porRangoEtario <= MAX_CONJUNTOS_POR_CAMPANA
        ? "según el rango de edad disponible"
        : "por el tope de conjuntos por campaña";

  return {
    cantidad,
    bandas: dividirEdades(edadMin, edadMax, cantidad),
    motivo: `${cantidad} conjuntos ${limitante}, divididos en bandas de edad que no se solapan para que no compitan entre sí.`,
  };
}

export type PlanEstrategia = {
  nivel: NivelEstrategia;
  campanas: number;
  conjuntosPorCampana: number;
  bandas: BandaEdad[] | null;
  motivoConjuntos: string;
  anunciosPorConjunto: number;
  totalConjuntos: number;
  totalAnuncios: number;
  presupuestoMensualClp: number;
  presupuestoDiarioTotalClp: number;
  presupuestoDiarioPorCampanaClp: number;
  presupuestoDiarioPorConjuntoClp: number;
};

export function planificarEstrategia(
  mensualClp: number,
  segmentacion?: ConfigSegmentacion | null
): PlanEstrategia {
  const nivel = nivelPorPresupuesto(mensualClp);
  const campanas = CAMPANAS_POR_NIVEL[nivel];
  const diarioTotal = Math.floor(mensualClp / DIAS_POR_MES);
  const diarioPorCampana = Math.floor(diarioTotal / campanas);

  const conjuntos = planificarConjuntos(diarioPorCampana, segmentacion);
  const totalConjuntos = campanas * conjuntos.cantidad;

  return {
    nivel,
    campanas,
    conjuntosPorCampana: conjuntos.cantidad,
    bandas: conjuntos.bandas,
    motivoConjuntos: conjuntos.motivo,
    anunciosPorConjunto: ANUNCIOS_POR_CONJUNTO,
    totalConjuntos,
    totalAnuncios: totalConjuntos * ANUNCIOS_POR_CONJUNTO,
    presupuestoMensualClp: mensualClp,
    presupuestoDiarioTotalClp: diarioTotal,
    presupuestoDiarioPorCampanaClp: diarioPorCampana,
    // El presupuesto se define por conjunto (ABO), repartido en partes iguales.
    presupuestoDiarioPorConjuntoClp: Math.floor(diarioPorCampana / conjuntos.cantidad),
  };
}

// Presupuesto mensual mínimo publicable de un nivel: cada campaña necesita al menos
// un conjunto con el mínimo duro de Meta.
export function mensualMinimoParaNivel(nivel: NivelEstrategia): number {
  const campanas = CAMPANAS_POR_NIVEL[nivel];
  return Math.ceil((campanas * MIN_DIARIO_POR_CONJUNTO_CLP * DIAS_POR_MES) / 1000) * 1000;
}

// Revisa si el plan es publicable. Devuelve null si está todo bien, o un mensaje
// explicando el problema y cuánto haría falta.
export function validarPlan(plan: PlanEstrategia): string | null {
  if (plan.presupuestoDiarioPorConjuntoClp >= MIN_DIARIO_POR_CONJUNTO_CLP) return null;

  const minimo = mensualMinimoParaNivel(plan.nivel);
  return (
    `Con $${plan.presupuestoMensualClp.toLocaleString("es-CL")} al mes, cada uno de los ` +
    `${plan.totalConjuntos} conjuntos recibiría $${plan.presupuestoDiarioPorConjuntoClp.toLocaleString("es-CL")} ` +
    `al día, bajo el mínimo de $${MIN_DIARIO_POR_CONJUNTO_CLP.toLocaleString("es-CL")} que exige Meta. ` +
    `Para ${plan.campanas} campaña${plan.campanas > 1 ? "s" : ""} se necesitan al menos ` +
    `$${minimo.toLocaleString("es-CL")} mensuales.`
  );
}
