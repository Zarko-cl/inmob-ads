// Enlaces directos a Ads Manager.
//
// Encontrar un objeto recién creado en Ads Manager es sorprendentemente difícil: la
// vista filtra por un rango de fechas (por defecto los últimos 30 días **hasta ayer**),
// así que un anuncio creado hoy simplemente no aparece, y además hay que cambiarse a
// la pestaña correcta — un anuncio nunca se ve en la pestaña "Campañas".
//
// Estos enlaces abren Ads Manager en la pestaña que corresponde, con el objeto
// preseleccionado y el rango de fechas puesto en "maximum" (todo el historial), para
// que el objeto siempre esté dentro del filtro.

const BASE = "https://adsmanager.facebook.com/adsmanager/manage";

// El parámetro `act` va sin el prefijo "act_" que usa la API.
function cuenta(adAccountId: string): string {
  return adAccountId.replace(/^act_/, "");
}

export function urlCampanaEnMeta(adAccountId: string, metaCampaignId: string): string {
  return `${BASE}/campaigns?act=${cuenta(adAccountId)}&selected_campaign_ids=${metaCampaignId}&date=maximum`;
}

export function urlConjuntoEnMeta(adAccountId: string, metaAdSetId: string): string {
  return `${BASE}/adsets?act=${cuenta(adAccountId)}&selected_adset_ids=${metaAdSetId}&date=maximum`;
}

export function urlAnuncioEnMeta(adAccountId: string, metaAdId: string): string {
  return `${BASE}/ads?act=${cuenta(adAccountId)}&selected_ad_ids=${metaAdId}&date=maximum`;
}
