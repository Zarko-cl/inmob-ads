// Tipos de campaña / destino del clic (M5).
//
// Meta no acepta cualquier combinación de objetivo + destino + optimización: cada
// tipo de campaña tiene una receta fija. Esta tabla es la fuente única de verdad de
// esas recetas, para no repartir la lógica por varios archivos.
//
// Referencias:
// - destination_type: developers.facebook.com/docs/marketing-api/reference/ad-campaign
// - Click to WhatsApp: developers.facebook.com/docs/marketing-api/ad-creative/messaging-ads/click-to-whatsapp

export type CampaignTypeKey =
  | "LANDING_SITIO_WEB"
  | "FORMULARIO_INSTANTANEO"
  | "WHATSAPP"
  | "INSTAGRAM_MESSENGER"
  | "LLAMADA_TELEFONO"
  | "ALCANCE_PROYECTO";

type CampaignTypeConfig = {
  label: string;
  descripcion: string;
  objective: "TRAFICO" | "INTERACCION" | "LEADS" | "VENTAS" | "RECONOCIMIENTO";
  odaxObjective: string;
  destinationType: string;
  optimizationGoal: string;
  billingEvent: string;
  requierePaginaFacebook: boolean;
  requiereUrl: boolean;
  requiereWhatsApp: boolean;
  requiereInstagram: boolean;
  // Anuncio de llamada: necesita un teléfono al que marcar.
  requiereTelefono?: boolean;
  // Botón de llamada a la acción del anuncio (M8 parte 2).
  callToAction: string;
  // Si el creativo de este tipo ya está implementado en lib/meta-marketing-api.ts.
  // Los que están en false crean campaña y conjunto, pero todavía no el anuncio.
  creativoImplementado: boolean;
};

export const CAMPAIGN_TYPES: Record<CampaignTypeKey, CampaignTypeConfig> = {
  LANDING_SITIO_WEB: {
    label: "Landing page / sitio web",
    descripcion: "El anuncio lleva a una URL (la ficha de la propiedad o el sitio de la inmobiliaria).",
    objective: "TRAFICO",
    odaxObjective: "OUTCOME_TRAFFIC",
    destinationType: "WEBSITE",
    optimizationGoal: "LINK_CLICKS",
    billingEvent: "IMPRESSIONS",
    requierePaginaFacebook: false,
    requiereUrl: true,
    requiereWhatsApp: false,
    requiereInstagram: false,
    callToAction: "LEARN_MORE",
    creativoImplementado: true,
  },
  WHATSAPP: {
    label: "WhatsApp",
    descripcion: "El anuncio abre un chat de WhatsApp con la inmobiliaria (Click-to-WhatsApp).",
    // Objetivo LEADS y no INTERACCION, aunque el destino sea un chat.
    //
    // El motivo es de calidad de contactos, no técnico: con "Interacción" el algoritmo
    // busca gente que suele chatear, y en inmobiliaria eso llena la bandeja de curiosos
    // que preguntan el precio y desaparecen. Con "Clientes potenciales" Meta busca
    // perfiles con intención de negocio real.
    //
    // La documentación de Click-to-WhatsApp confirma que OUTCOME_LEADS admite
    // `CONVERSATIONS` como optimización con destino WHATSAPP:
    // developers.facebook.com/docs/marketing-api/ad-creative/messaging-ads/click-to-whatsapp/
    // (No se pudo validar contra la API todavía porque falta vincular un número de
    // WhatsApp Business a la Página: Meta corta antes con ese requisito.)
    objective: "LEADS",
    odaxObjective: "OUTCOME_LEADS",
    destinationType: "WHATSAPP",
    optimizationGoal: "CONVERSATIONS",
    billingEvent: "IMPRESSIONS",
    requierePaginaFacebook: true,
    requiereUrl: false,
    requiereWhatsApp: true,
    requiereInstagram: false,
    callToAction: "WHATSAPP_MESSAGE",
    creativoImplementado: true,
  },
  FORMULARIO_INSTANTANEO: {
    label: "Formulario instantáneo",
    descripcion: "El cliente deja sus datos sin salir de Facebook/Instagram (Instant Form).",
    objective: "LEADS",
    odaxObjective: "OUTCOME_LEADS",
    destinationType: "ON_AD",
    optimizationGoal: "LEAD_GENERATION",
    billingEvent: "IMPRESSIONS",
    requierePaginaFacebook: true,
    requiereUrl: false,
    requiereWhatsApp: false,
    requiereInstagram: false,
    // Un formulario instantáneo necesita además un "lead form" creado en Meta
    // (lead_gen_form_id). Crearlo por API es una funcionalidad aparte que todavía
    // no está: por eso este tipo aún no genera el anuncio.
    callToAction: "SIGN_UP",
    creativoImplementado: false,
  },
  LLAMADA_TELEFONO: {
    label: "Llamada telefónica",
    descripcion: "El anuncio muestra un botón para llamar directo al asesor desde el celular.",
    // Verificado contra la cuenta real (16 ago 2026): OUTCOME_LEADS + PHONE_CALL +
    // QUALITY_CALL es aceptado por Meta.
    //
    // QUALITY_CALL y no simplemente "clics": Meta optimiza para gente que de verdad
    // levanta el teléfono y sostiene la llamada, y para las horas en que contesta,
    // en vez de premiar el toque accidental en el botón.
    objective: "LEADS",
    odaxObjective: "OUTCOME_LEADS",
    destinationType: "PHONE_CALL",
    optimizationGoal: "QUALITY_CALL",
    billingEvent: "IMPRESSIONS",
    requierePaginaFacebook: true,
    requiereUrl: false,
    requiereWhatsApp: false,
    requiereInstagram: false,
    requiereTelefono: true,
    callToAction: "CALL_NOW",
    creativoImplementado: true,
  },
  ALCANCE_PROYECTO: {
    label: "Dar a conocer un proyecto",
    descripcion:
      "Muestra el anuncio a la mayor cantidad de gente posible en una zona. Para preventas y proyectos nuevos, antes de buscar contactos.",
    // Verificado contra la cuenta real: OUTCOME_AWARENESS + REACH es aceptado.
    //
    // Alcance y no clics: acá el objetivo es que el proyecto se recuerde en su zona
    // (el vecino, el inversionista local), no que alguien haga algo hoy. Es el
    // objetivo más barato por persona alcanzada.
    objective: "RECONOCIMIENTO",
    odaxObjective: "OUTCOME_AWARENESS",
    destinationType: "WEBSITE",
    optimizationGoal: "REACH",
    billingEvent: "IMPRESSIONS",
    requierePaginaFacebook: false,
    requiereUrl: true,
    requiereWhatsApp: false,
    requiereInstagram: false,
    callToAction: "LEARN_MORE",
    creativoImplementado: true,
  },
  INSTAGRAM_MESSENGER: {
    label: "Instagram / Messenger",
    descripcion: "El anuncio abre un mensaje directo en Messenger.",
    objective: "INTERACCION",
    odaxObjective: "OUTCOME_ENGAGEMENT",
    destinationType: "MESSENGER",
    optimizationGoal: "CONVERSATIONS",
    billingEvent: "IMPRESSIONS",
    requierePaginaFacebook: true,
    requiereUrl: false,
    requiereWhatsApp: false,
    requiereInstagram: true,
    callToAction: "MESSAGE_PAGE",
    creativoImplementado: true,
  },
};

// Revisa, ANTES de llamar a Meta, que estén los requisitos previos de este tipo de
// campaña. Devuelve la lista de lo que falta (vacía si está todo listo), para poder
// mostrar un mensaje claro en vez de un error críptico de la API.
export function validarRequisitos(
  tipo: CampaignTypeKey,
  datos: {
    destinationUrl?: string | null;
    pageId?: string | null;
    whatsappBusinessAccountId?: string | null;
    instagramActorId?: string | null;
    telefono?: string | null;
  }
): string[] {
  const config = CAMPAIGN_TYPES[tipo];
  const faltantes: string[] = [];

  if (config.requiereUrl && !datos.destinationUrl) {
    faltantes.push("una URL de destino");
  }
  if (config.requierePaginaFacebook && !datos.pageId) {
    faltantes.push("una Página de Facebook vinculada a la conexión de Meta");
  }
  if (config.requiereWhatsApp && !datos.whatsappBusinessAccountId) {
    faltantes.push(
      "un número de WhatsApp Business conectado a la Página (se configura en Meta Business Manager)"
    );
  }
  if (config.requiereTelefono && !datos.telefono?.trim()) {
    faltantes.push(
      "un teléfono de contacto (se toma del asesor a cargo en la ficha de la propiedad)"
    );
  }
  if (config.requiereInstagram && !datos.instagramActorId) {
    faltantes.push("una cuenta de Instagram profesional vinculada a la Página");
  }

  return faltantes;
}
