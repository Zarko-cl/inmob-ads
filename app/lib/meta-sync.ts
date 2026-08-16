// Sincronización de estado con Meta y control de cuota de la API (M10).
//
// La app publica y luego "se olvida": si Meta rechaza un anuncio por políticas, o
// una campaña entra en revisión, eso solo se ve en Ads Manager. Este módulo trae
// ese estado de vuelta.
//
// Estrategia de llamadas: se leen TODOS los objetos de la cuenta en 3 peticiones
// (una por nivel) en vez de una por objeto. Con 4 campañas × 5 conjuntos × 4
// anuncios serían 80 llamadas; así son 3.

const API_VERSION = "v21.0";
const GRAPH_URL = `https://graph.facebook.com/${API_VERSION}`;

// Estados que Meta puede reportar en effective_status, traducidos.
export const ESTADOS_META: Record<string, { texto: string; tono: "ok" | "aviso" | "malo" }> = {
  ACTIVE: { texto: "Activa (entregando)", tono: "ok" },
  PAUSED: { texto: "Pausada", tono: "aviso" },
  DELETED: { texto: "Eliminada", tono: "malo" },
  ARCHIVED: { texto: "Archivada", tono: "aviso" },
  PENDING_REVIEW: { texto: "En revisión por Meta", tono: "aviso" },
  DISAPPROVED: { texto: "Rechazada por Meta", tono: "malo" },
  PREAPPROVED: { texto: "Aprobada provisoriamente", tono: "ok" },
  PENDING_BILLING_INFO: { texto: "Falta información de pago", tono: "malo" },
  CAMPAIGN_PAUSED: { texto: "Pausada (su campaña está pausada)", tono: "aviso" },
  ADSET_PAUSED: { texto: "Pausada (su conjunto está pausado)", tono: "aviso" },
  IN_PROCESS: { texto: "Procesando", tono: "aviso" },
  WITH_ISSUES: { texto: "Con problemas", tono: "malo" },
};

export function describirEstadoMeta(estado: string | null): { texto: string; tono: string } {
  if (!estado) return { texto: "Sin sincronizar", tono: "aviso" };
  return ESTADOS_META[estado] ?? { texto: estado, tono: "aviso" };
}

export type UsoApi = {
  porcentaje: number; // el mayor entre llamadas, CPU y tiempo
  tier: string | null;
  segundosParaRecuperar: number;
};

// Meta informa el consumo de cuota en cada respuesta. El plan de trabajo pide
// actuar entre 70-80% de uso, no al llegar al tope.
export const UMBRAL_AVISO_API = 70;

export function parsearUsoApi(header: string | null): UsoApi | null {
  if (!header) return null;
  try {
    const datos = JSON.parse(header) as Record<
      string,
      {
        call_count?: number;
        total_cputime?: number;
        total_time?: number;
        estimated_time_to_regain_access?: number;
        ads_api_access_tier?: string;
      }[]
    >;
    const primera = Object.values(datos)[0]?.[0];
    if (!primera) return null;
    return {
      // Los tres contadores van de 0 a 100; el que primero llegue a 100 bloquea.
      porcentaje: Math.max(
        primera.call_count ?? 0,
        primera.total_cputime ?? 0,
        primera.total_time ?? 0
      ),
      tier: primera.ads_api_access_tier ?? null,
      segundosParaRecuperar: primera.estimated_time_to_regain_access ?? 0,
    };
  } catch {
    return null;
  }
}

export type EstadoObjeto = {
  id: string;
  effectiveStatus: string | null;
  issues: unknown | null;
};

export type ResultadoSync = {
  campanas: Map<string, EstadoObjeto>;
  conjuntos: Map<string, EstadoObjeto>;
  anuncios: Map<string, EstadoObjeto>;
  uso: UsoApi | null;
};

type FilaMeta = {
  id: string;
  effective_status?: string;
  issues_info?: unknown;
};

async function leerNivel(
  accessToken: string,
  adAccountId: string,
  edge: "campaigns" | "adsets" | "ads"
): Promise<{ mapa: Map<string, EstadoObjeto>; uso: UsoApi | null }> {
  const params = new URLSearchParams({
    fields: "id,effective_status,issues_info",
    // Meta pagina de a 25 por defecto; se pide más para no encadenar páginas.
    limit: "200",
    access_token: accessToken,
  });

  const res = await fetch(`${GRAPH_URL}/${adAccountId}/${edge}?${params.toString()}`);
  const uso = parsearUsoApi(res.headers.get("x-business-use-case-usage"));

  if (!res.ok) {
    const cuerpo = await res.json().catch(() => null);
    throw new Error(
      cuerpo?.error?.error_user_msg ?? cuerpo?.error?.message ?? `Error HTTP ${res.status} leyendo ${edge}`
    );
  }

  const data = await res.json();
  const mapa = new Map<string, EstadoObjeto>();
  for (const fila of (data.data ?? []) as FilaMeta[]) {
    mapa.set(fila.id, {
      id: fila.id,
      effectiveStatus: fila.effective_status ?? null,
      // issues_info solo viene cuando hay algo que corregir; su ausencia es buena señal.
      issues: fila.issues_info ?? null,
    });
  }
  return { mapa, uso };
}

export async function leerEstadosDesdeMeta(params: {
  accessToken: string;
  adAccountId: string;
}): Promise<ResultadoSync> {
  const campanas = await leerNivel(params.accessToken, params.adAccountId, "campaigns");
  const conjuntos = await leerNivel(params.accessToken, params.adAccountId, "adsets");
  const anuncios = await leerNivel(params.accessToken, params.adAccountId, "ads");

  return {
    campanas: campanas.mapa,
    conjuntos: conjuntos.mapa,
    anuncios: anuncios.mapa,
    // El uso más reciente es el de la última llamada.
    uso: anuncios.uso ?? conjuntos.uso ?? campanas.uso,
  };
}

// Elimina un objeto en Meta (campaña, conjunto o anuncio).
//
// OJO: Meta no borra de verdad, lo marca como DELETED y lo saca de la vista normal
// de Ads Manager. Lo ya gastado y las estadísticas históricas se conservan. Aun así
// es una acción que no se puede deshacer desde la app, por eso el flujo la protege
// con confirmación escrita.
export async function eliminarEnMeta(params: {
  accessToken: string;
  metaObjectId: string;
}): Promise<void> {
  const res = await fetch(
    `${GRAPH_URL}/${params.metaObjectId}?access_token=${encodeURIComponent(params.accessToken)}`,
    { method: "DELETE" }
  );

  if (!res.ok) {
    const cuerpo = await res.json().catch(() => null);
    const mensaje = cuerpo?.error?.error_user_msg ?? cuerpo?.error?.message ?? "";
    // Si el objeto ya no existe en Meta, para nosotros el resultado es el mismo:
    // no hay nada que borrar. No se trata como error.
    if (res.status === 400 && /does not exist|no existe|Unsupported get request/i.test(mensaje)) return;
    throw new Error(mensaje || `Error HTTP ${res.status} eliminando en Meta`);
  }
}

// Cambia el estado de un objeto en Meta (pausar / activar).
// ACTIVAR GASTA DINERO REAL: quien llame a esto debe pedir confirmación explícita
// (ver la regla de seguridad en CLAUDE.md).
export async function cambiarEstadoEnMeta(params: {
  accessToken: string;
  metaObjectId: string;
  estado: "ACTIVE" | "PAUSED";
}): Promise<void> {
  const res = await fetch(`${GRAPH_URL}/${params.metaObjectId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: params.estado, access_token: params.accessToken }),
  });

  if (!res.ok) {
    const cuerpo = await res.json().catch(() => null);
    throw new Error(
      cuerpo?.error?.error_user_msg ?? cuerpo?.error?.message ?? `Error HTTP ${res.status}`
    );
  }
}
