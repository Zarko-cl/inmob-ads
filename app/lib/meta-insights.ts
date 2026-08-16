// Reportería: lectura de resultados desde la Insights API de Meta (M11).
//
// El objetivo del plan es mostrar métricas útiles para una inmobiliaria, no las
// métricas genéricas de publicidad. Lo que importa acá es: cuánta gente distinta vio
// el anuncio, cuántos CONTACTARON, y cuánto costó cada contacto.

const API_VERSION = "v21.0";
const GRAPH_URL = `https://graph.facebook.com/${API_VERSION}`;

// Rangos que ofrece la pantalla. Se usan los presets de Meta para no tener que
// calcular fechas ni preocuparse por la zona horaria de la cuenta.
export const RANGOS = {
  last_7d: "Últimos 7 días",
  last_30d: "Últimos 30 días",
  this_month: "Este mes",
  maximum: "Todo el historial",
} as const;

export type RangoFecha = keyof typeof RANGOS;

// Tipos de acción de Meta que, para una inmobiliaria, significan "alguien se
// contactó". Es el proxy de "visitas incentivadas" que pide el plan: no podemos
// saber si la persona finalmente visitó la propiedad, pero sí que dio el paso
// de contactar.
const ACCIONES_DE_CONTACTO = [
  "lead", // formulario instantáneo
  "onsite_conversion.messaging_conversation_started_7d", // WhatsApp / Messenger
  "onsite_conversion.total_messaging_connection",
];

export type MetricasCampana = {
  metaCampaignId: string;
  impresiones: number;
  alcance: number;
  clicsEnlace: number;
  gastoClp: number;
  contactos: number;
};

export const METRICAS_VACIAS = (metaCampaignId: string): MetricasCampana => ({
  metaCampaignId,
  impresiones: 0,
  alcance: 0,
  clicsEnlace: 0,
  gastoClp: 0,
  contactos: 0,
});

type FilaInsights = {
  campaign_id?: string;
  impressions?: string;
  reach?: string;
  inline_link_clicks?: string;
  spend?: string;
  actions?: { action_type: string; value: string }[];
};

function sumarContactos(acciones: FilaInsights["actions"]): number {
  if (!acciones) return 0;
  return acciones
    .filter((a) => ACCIONES_DE_CONTACTO.includes(a.action_type))
    .reduce((n, a) => n + Number(a.value ?? 0), 0);
}

// Lee los resultados de TODAS las campañas de la cuenta en una sola llamada,
// agrupadas por campaña. Igual que en la sincronización (M10), se evita pedir
// campaña por campaña para no gastar cuota.
export async function leerResultados(params: {
  accessToken: string;
  adAccountId: string;
  rango: RangoFecha;
}): Promise<{ porCampana: Map<string, MetricasCampana>; usoApi: string | null }> {
  const qs = new URLSearchParams({
    level: "campaign",
    date_preset: params.rango,
    fields: "campaign_id,impressions,reach,inline_link_clicks,spend,actions",
    limit: "200",
    access_token: params.accessToken,
  });

  const res = await fetch(`${GRAPH_URL}/${params.adAccountId}/insights?${qs.toString()}`);
  const usoApi = res.headers.get("x-business-use-case-usage");

  if (!res.ok) {
    const cuerpo = await res.json().catch(() => null);
    throw new Error(
      cuerpo?.error?.error_user_msg ?? cuerpo?.error?.message ?? `Error HTTP ${res.status} leyendo resultados`
    );
  }

  const data = await res.json();
  const porCampana = new Map<string, MetricasCampana>();

  for (const fila of (data.data ?? []) as FilaInsights[]) {
    if (!fila.campaign_id) continue;
    porCampana.set(fila.campaign_id, {
      metaCampaignId: fila.campaign_id,
      impresiones: Number(fila.impressions ?? 0),
      alcance: Number(fila.reach ?? 0),
      clicsEnlace: Number(fila.inline_link_clicks ?? 0),
      // La cuenta está en CLP, que no tiene decimales, pero Meta devuelve el gasto
      // como texto ("1234.56"), así que se redondea.
      gastoClp: Math.round(Number(fila.spend ?? 0)),
      contactos: sumarContactos(fila.actions),
    });
  }

  return { porCampana, usoApi };
}

export function sumarMetricas(lista: MetricasCampana[]): Omit<MetricasCampana, "metaCampaignId"> {
  return lista.reduce(
    (acc, m) => ({
      impresiones: acc.impresiones + m.impresiones,
      alcance: acc.alcance + m.alcance,
      clicsEnlace: acc.clicsEnlace + m.clicsEnlace,
      gastoClp: acc.gastoClp + m.gastoClp,
      contactos: acc.contactos + m.contactos,
    }),
    { impresiones: 0, alcance: 0, clicsEnlace: 0, gastoClp: 0, contactos: 0 }
  );
}

// Costo por contacto: la métrica que de verdad le importa a una inmobiliaria.
// Devuelve null si todavía no hay contactos (dividir por cero no informa nada).
export function costoPorContacto(m: { gastoClp: number; contactos: number }): number | null {
  return m.contactos > 0 ? Math.round(m.gastoClp / m.contactos) : null;
}

export function costoPorClic(m: { gastoClp: number; clicsEnlace: number }): number | null {
  return m.clicsEnlace > 0 ? Math.round(m.gastoClp / m.clicsEnlace) : null;
}

// OJO: el alcance NO se puede sumar entre campañas sin sobreestimar (la misma
// persona puede haber visto dos campañas). Meta lo calcula deduplicado por campaña,
// no entre ellas. Se muestra como referencia, no como total exacto.
export const NOTA_ALCANCE =
  "El alcance de varias campañas se suma como referencia: una misma persona puede haber visto más de una, así que el total real es algo menor.";
