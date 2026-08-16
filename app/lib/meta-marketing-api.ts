// Servicio que traduce lo que arma el usuario en el wizard a llamadas reales
// contra la Marketing API de Meta (M3 + M5). Referencia:
// developers.facebook.com/docs/marketing-api/reference/ad-campaign-group

import { CAMPAIGN_TYPES, type CampaignTypeKey } from "@/lib/meta-campaign-types";

const API_VERSION = "v21.0";
const GRAPH_URL = `https://graph.facebook.com/${API_VERSION}`;

class MetaApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MetaApiError";
  }
}

async function parseErrorMessage(res: Response): Promise<string> {
  try {
    const body = await res.json();
    // Meta devuelve el motivo del rechazo en error.error_user_msg (si existe) o error.message.
    return body?.error?.error_user_msg ?? body?.error?.message ?? `Error HTTP ${res.status}`;
  } catch {
    return `Error HTTP ${res.status}`;
  }
}

// Siempre se crea en estado PAUSED — nunca se publica una campaña activa desde el
// código todavía (ver CLAUDE.md, regla de seguridad de la cuenta real).
export async function createMetaCampaign(params: {
  accessToken: string;
  adAccountId: string;
  name: string;
  campaignType: CampaignTypeKey;
  // true solo si la segmentación incluye EE. UU./Canadá/Europa (M6). Para Chile
  // va en false — ver sección 3 del plan de trabajo.
  specialAdCategory?: boolean;
}): Promise<{ id: string }> {
  const config = CAMPAIGN_TYPES[params.campaignType];
  if (!config) {
    throw new MetaApiError(`Tipo de campaña desconocido: "${params.campaignType}".`);
  }

  const res = await fetch(`${GRAPH_URL}/${params.adAccountId}/campaigns`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: params.name,
      objective: config.odaxObjective,
      status: "PAUSED",
      special_ad_categories: params.specialAdCategory ? ["HOUSING"] : [],
      // El presupuesto se define a nivel del conjunto de anuncios (ABO), no de la
      // campaña (CBO) — por eso hay que decir explícitamente que los conjuntos de
      // anuncios NO van a compartir presupuesto entre ellos.
      is_adset_budget_sharing_enabled: false,
      access_token: params.accessToken,
    }),
  });

  if (!res.ok) throw new MetaApiError(await parseErrorMessage(res));
  return res.json();
}

export async function createMetaAdSet(params: {
  accessToken: string;
  adAccountId: string;
  metaCampaignId: string;
  name: string;
  campaignType: CampaignTypeKey;
  dailyBudgetClp: number;
  startDate?: Date;
  pageId?: string | null;
  // Objeto `targeting` ya construido (ver lib/meta-targeting.ts). Si no viene, se
  // usa el default del proyecto: todo Chile.
  targeting?: Record<string, unknown> | null;
}): Promise<{ id: string; destinationType: string }> {
  const config = CAMPAIGN_TYPES[params.campaignType];
  if (!config) {
    throw new MetaApiError(`Tipo de campaña desconocido: "${params.campaignType}".`);
  }

  const body: Record<string, unknown> = {
    name: params.name,
    campaign_id: params.metaCampaignId,
    status: "PAUSED",
    // CLP no tiene subunidad (no hay "centavos"), así que el monto se manda tal cual.
    daily_budget: params.dailyBudgetClp,
    billing_event: config.billingEvent,
    optimization_goal: config.optimizationGoal,
    destination_type: config.destinationType,
    bid_strategy: "LOWEST_COST_WITHOUT_CAP",
    targeting: params.targeting ?? { geo_locations: { countries: ["CL"] } },
    start_time: params.startDate?.toISOString(),
    access_token: params.accessToken,
  };

  // Los destinos de mensajería y los formularios instantáneos se "promocionan" sobre
  // una Página de Facebook, así que Meta exige declararla en promoted_object.
  if (config.requierePaginaFacebook && params.pageId) {
    body.promoted_object = { page_id: params.pageId };
  }

  const res = await fetch(`${GRAPH_URL}/${params.adAccountId}/adsets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new MetaApiError(await parseErrorMessage(res));
  const created = await res.json();
  return { id: created.id, destinationType: config.destinationType };
}

// ---------------------------------------------------------------------------
// M8 parte 2 — Anuncio + Creativo
//
// Crear un anuncio en Meta son tres llamadas encadenadas:
//   1. subirImagenAMeta()    -> sube los bytes y devuelve un "image_hash"
//   2. createMetaAdCreative() -> arma el creativo (imagen + textos + destino)
//   3. createMetaAd()         -> une el conjunto de anuncios con ese creativo
// ---------------------------------------------------------------------------

// Meta no acepta una URL nuestra: hay que enviarle los bytes de la imagen y ella
// la guarda en la cuenta publicitaria, devolviendo un hash que se usa en el creativo.
export async function subirImagenAMeta(params: {
  accessToken: string;
  adAccountId: string;
  imagen: Buffer;
  nombreArchivo: string;
  contentType: string;
}): Promise<string> {
  const form = new FormData();
  form.append("access_token", params.accessToken);
  form.append(
    "filename",
    new Blob([new Uint8Array(params.imagen)], { type: params.contentType }),
    params.nombreArchivo
  );

  const res = await fetch(`${GRAPH_URL}/${params.adAccountId}/adimages`, {
    method: "POST",
    body: form,
  });

  if (!res.ok) throw new MetaApiError(await parseErrorMessage(res));

  // Respuesta: { images: { "<nombre>": { hash, url } } } — la clave no siempre
  // coincide con el nombre enviado, así que se toma el primer valor.
  const data = await res.json();
  const primera = Object.values(data.images ?? {})[0] as { hash?: string } | undefined;
  if (!primera?.hash) throw new MetaApiError("Meta no devolvió el identificador de la imagen.");
  return primera.hash;
}

// Tarjeta de un carrusel, ya con la imagen subida a Meta.
export type TarjetaCreativo = {
  imageHash: string;
  headline: string | null;
  description: string | null;
};

export async function createMetaAdCreative(params: {
  accessToken: string;
  adAccountId: string;
  name: string;
  campaignType: CampaignTypeKey;
  pageId: string;
  // Imagen única. Se ignora si vienen tarjetas de carrusel.
  imageHash?: string;
  // Carrusel: 2 a 10 tarjetas (ver lib/carrusel.ts). Si viene, manda sobre imageHash.
  tarjetas?: TarjetaCreativo[] | null;
  primaryText: string;
  headline: string;
  description?: string | null;
  destinationUrl?: string | null;
  whatsappNumber?: string | null;
  // Solo para el tipo de llamada telefónica.
  telefono?: string | null;
}): Promise<{ id: string }> {
  const config = CAMPAIGN_TYPES[params.campaignType];
  if (!config) throw new MetaApiError(`Tipo de campaña desconocido: "${params.campaignType}".`);
  if (!config.creativoImplementado) {
    throw new MetaApiError(
      `El anuncio para campañas de tipo "${config.label}" todavía no está implementado.`
    );
  }

  // A dónde lleva el clic. Cada tipo usa un enlace distinto:
  // - sitio web: la URL que escribió el usuario
  // - WhatsApp: el enlace estándar de WhatsApp con el número del negocio
  // - Messenger: el enlace m.me de la Página
  let link: string;
  if (config.destinationType === "WEBSITE") {
    if (!params.destinationUrl) throw new MetaApiError("Falta la URL de destino.");
    link = params.destinationUrl;
  } else if (config.destinationType === "WHATSAPP") {
    if (!params.whatsappNumber) throw new MetaApiError("Falta el número de WhatsApp Business.");
    link = `https://api.whatsapp.com/send?phone=${params.whatsappNumber.replace(/\D/g, "")}`;
  } else if (config.destinationType === "PHONE_CALL") {
    // Anuncio de llamada: el enlace principal NO puede ser un `tel:` — Meta lo
    // rechaza con "la URL que ingresaste no dirige a un sitio web" (verificado).
    // El número va dentro del botón, en `call_to_action.value.link`; acá se pone la
    // Página como destino de respaldo para quien mire el anuncio desde un computador.
    if (!params.telefono) throw new MetaApiError("Falta el teléfono de contacto.");
    link = `https://facebook.com/${params.pageId}`;
  } else {
    link = `https://m.me/${params.pageId}`;
  }

  // En un anuncio de llamada el botón lleva el número; en los demás basta el tipo.
  const callToAction: Record<string, unknown> = { type: config.callToAction };
  if (config.destinationType === "PHONE_CALL" && params.telefono) {
    // Formato E.164: Meta necesita el país. Si el número viene sin "+", se asume Chile.
    const numero = params.telefono.replace(/[^\d+]/g, "");
    const e164 = numero.startsWith("+") ? numero : `+56${numero.replace(/^56/, "")}`;
    callToAction.value = { link: `tel:${e164}` };
  }

  const linkData: Record<string, unknown> = {
    link,
    message: params.primaryText,
    call_to_action: callToAction,
  };

  if (params.tarjetas?.length) {
    // Carrusel: cada tarjeta lleva su propia imagen, título y botón. Todas apuntan
    // al mismo destino (una campaña promociona una propiedad); si más adelante se
    // quiere una propiedad distinta por tarjeta, basta variar `link` acá.
    linkData.child_attachments = params.tarjetas.map((t) => {
      const tarjeta: Record<string, unknown> = {
        link,
        image_hash: t.imageHash,
        call_to_action: { type: config.callToAction },
      };
      if (t.headline) tarjeta.name = t.headline;
      if (t.description) tarjeta.description = t.description;
      return tarjeta;
    });
    // Deja que Meta muestre primero las tarjetas que mejor rinden.
    linkData.multi_share_optimized = true;
  } else {
    if (!params.imageHash) throw new MetaApiError("Falta la imagen del anuncio.");
    linkData.image_hash = params.imageHash;
    linkData.name = params.headline;
    if (params.description) linkData.description = params.description;
  }

  const res = await fetch(`${GRAPH_URL}/${params.adAccountId}/adcreatives`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: params.name,
      object_story_spec: { page_id: params.pageId, link_data: linkData },
      // Nota: Meta aplica "mejoras automáticas" al creativo (retoques de imagen,
      // variaciones de texto). Se intentó desactivarlas con
      // degrees_of_freedom_spec.creative_features_spec.standard_enhancements, pero
      // Meta descontinuó ese campo global ("quedó obsoleto; elige configurar
      // funciones individuales"). Desactivarlas requiere enumerar cada función por
      // separado — pendiente. Mientras tanto se pueden apagar desde Meta Ads Manager.
      access_token: params.accessToken,
    }),
  });

  if (!res.ok) throw new MetaApiError(await parseErrorMessage(res));
  return res.json();
}

// Igual que campaña y conjunto: siempre PAUSED (ver CLAUDE.md, regla de seguridad).
export async function createMetaAd(params: {
  accessToken: string;
  adAccountId: string;
  metaAdSetId: string;
  metaCreativeId: string;
  name: string;
}): Promise<{ id: string }> {
  const res = await fetch(`${GRAPH_URL}/${params.adAccountId}/ads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: params.name,
      adset_id: params.metaAdSetId,
      creative: { creative_id: params.metaCreativeId },
      status: "PAUSED",
      access_token: params.accessToken,
    }),
  });

  if (!res.ok) throw new MetaApiError(await parseErrorMessage(res));
  return res.json();
}

// ---------------------------------------------------------------------------
// M6 — Búsqueda de segmentación (Targeting Search API)
// Meta no acepta nombres libres ("Providencia", "bienes raíces"): hay que enviar
// los identificadores de su catálogo, que se obtienen buscando primero.
// Referencia: developers.facebook.com/docs/marketing-api/audiences/reference/targeting-search
// ---------------------------------------------------------------------------

// OJO: en Chile las comunas (Providencia, Las Condes, Pudahuel...) son "subcity"
// para Meta, no "city". "city" corresponde a Santiago como conurbación.
export type GeoResultado = {
  key: string;
  name: string;
  type: "city" | "subcity" | "region" | "country";
  countryCode: string;
  descripcion: string;
};

const TIPOS_GEO_SOPORTADOS = ["city", "subcity", "region", "country"];

export async function buscarUbicaciones(params: {
  accessToken: string;
  query: string;
  // Sin filtro de país, Meta ordena por audiencia global y las comunas chilenas
  // quedan sepultadas bajo homónimas de México, Colombia, etc. (verificado con
  // "Providencia"). Por eso se filtra por país salvo que se pida lo contrario.
  countryCode?: string | null;
}): Promise<GeoResultado[]> {
  // NO se envía location_types: combinarlo con country_code hace que Meta devuelva
  // cero resultados (verificado contra la Graph API). Sin ese parámetro devuelve
  // todos los tipos, que es justamente lo que se necesita, y se filtra acá abajo.
  const qs = new URLSearchParams({
    type: "adgeolocation",
    q: params.query,
    limit: "20",
    access_token: params.accessToken,
  });
  if (params.countryCode) qs.set("country_code", params.countryCode);

  const res = await fetch(`${GRAPH_URL}/search?${qs.toString()}`);
  if (!res.ok) throw new MetaApiError(await parseErrorMessage(res));

  const data = await res.json();
  type Fila = {
    key: string;
    name: string;
    type: string;
    country_code?: string;
    region?: string;
    country_name?: string;
  };

  return (data.data ?? [])
    .filter((f: Fila) => TIPOS_GEO_SOPORTADOS.includes(f.type))
    .map((f: Fila) => ({
      key: f.key,
      name: f.name,
      type: f.type as GeoResultado["type"],
      // Para un país, country_code viene vacío y la clave ES el código ISO.
      countryCode: f.country_code ?? (f.type === "country" ? f.key : ""),
      descripcion: [f.region, f.country_name].filter(Boolean).join(", "),
    }));
}

export type InteresResultado = { id: string; name: string; audienceSize: number | null };

export async function buscarIntereses(params: {
  accessToken: string;
  query: string;
}): Promise<InteresResultado[]> {
  const qs = new URLSearchParams({
    type: "adinterest",
    q: params.query,
    limit: "15",
    access_token: params.accessToken,
  });

  const res = await fetch(`${GRAPH_URL}/search?${qs.toString()}`);
  if (!res.ok) throw new MetaApiError(await parseErrorMessage(res));

  const data = await res.json();
  type Fila = { id: string; name: string; audience_size_lower_bound?: number };
  return (data.data ?? []).map((f: Fila) => ({
    id: f.id,
    name: f.name,
    audienceSize: f.audience_size_lower_bound ?? null,
  }));
}
