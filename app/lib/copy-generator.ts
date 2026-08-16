// Generación de copys publicitarios con IA (M7).
//
// Usa la API de OpenAI. La clave se lee de la variable de entorno OPENAI_API_KEY
// (nunca hardcodeada, nunca commiteada — ver .env.local y CLAUDE.md).

import OpenAI from "openai";
import { COPY_LIMITS } from "@/lib/copy-limits";
import { CAMPAIGN_TYPES, type CampaignTypeKey } from "@/lib/meta-campaign-types";

// Se versiona el prompt para poder saber después con qué reglas se generó cada copy
// guardado (queda en CopyVariant.promptVersion).
export const PROMPT_VERSION = "v1-2026-08";

const MODEL = process.env.OPENAI_MODEL ?? "gpt-4o";

export type PropiedadParaCopy = {
  title: string;
  propertyType: string;
  operation: string;
  comuna?: string | null;
  region?: string | null;
  price: number;
  currency: string;
  surfaceM2?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  description?: string | null;
};

export type CopyGenerado = {
  primaryText: string;
  headline: string;
  description: string;
};

// Cada tipo de campaña (M5) pide una llamada a la acción distinta: no es lo mismo
// invitar a escribir por WhatsApp que a dejar los datos en un formulario.
const CTA_POR_TIPO: Record<CampaignTypeKey, string> = {
  LANDING_SITIO_WEB: "invitar a visitar la página de la propiedad para ver más fotos y agendar una visita",
  WHATSAPP: "invitar a escribir por WhatsApp para coordinar una visita o resolver dudas",
  FORMULARIO_INSTANTANEO: "invitar a dejar sus datos en el formulario para que un asesor lo contacte",
  INSTAGRAM_MESSENGER: "invitar a enviar un mensaje directo para coordinar una visita",
  LLAMADA_TELEFONO: "invitar a llamar por teléfono ahora mismo para preguntar por la propiedad",
  ALCANCE_PROYECTO:
    "dar a conocer el proyecto en su zona: que la gente lo recuerde, sin pedirle todavía que haga algo",
};

function describirPropiedad(p: PropiedadParaCopy): string {
  const partes = [
    `Título interno: ${p.title}`,
    `Tipo: ${p.propertyType}`,
    `Operación: ${p.operation}`,
    `Precio: ${p.currency === "UF" ? "UF " : "$"}${p.price.toLocaleString("es-CL")}`,
  ];
  if (p.comuna) partes.push(`Comuna: ${p.comuna}`);
  if (p.region) partes.push(`Región: ${p.region}`);
  if (p.surfaceM2) partes.push(`Superficie: ${p.surfaceM2} m²`);
  if (p.bedrooms !== null && p.bedrooms !== undefined) partes.push(`Dormitorios: ${p.bedrooms}`);
  if (p.bathrooms !== null && p.bathrooms !== undefined) partes.push(`Baños: ${p.bathrooms}`);
  if (p.description) partes.push(`Descripción del corredor: ${p.description}`);
  return partes.join("\n");
}

function construirPrompt(propiedad: PropiedadParaCopy | null, tipo: CampaignTypeKey, cantidad: number) {
  const datos = propiedad
    ? describirPropiedad(propiedad)
    : "No se seleccionó una propiedad específica: escribe copys genéricos para una inmobiliaria en Chile.";

  return `Eres redactor publicitario especializado en el mercado inmobiliario chileno.

Escribe ${cantidad} variante(s) de anuncio para Facebook/Instagram Ads con estos datos:

${datos}

Objetivo del anuncio: ${CTA_POR_TIPO[tipo]}.

Reglas obligatorias:
- Español de Chile, tono cercano y profesional. Trata de "tú", no de "usted".
- El texto principal DEBE comunicar lo esencial en los primeros ${COPY_LIMITS.primaryText.recomendado} caracteres, porque Meta corta ahí con "Ver más". No excedas ese largo.
- El título debe tener entre 27 y ${COPY_LIMITS.headline.recomendado} caracteres, contando espacios. Cuenta los caracteres antes de responder: un título de menos de 27 caracteres desaprovecha el espacio disponible y se ve pobre. Aprovecha ese largo para incluir un dato concreto (comuna, tipo, precio o superficie), no solo una frase genérica.
- La descripción, máximo ${COPY_LIMITS.description.recomendado} caracteres.
- Prohibido inventar datos que no estén arriba (no inventes metros cuadrados, estacionamientos, año de construcción, cercanía a metro ni plazos de entrega).
- Prohibido usar afirmaciones engañosas, superlativos no verificables ("la mejor de Chile") o promesas de rentabilidad. La Ley del Consumidor chilena (19.496) sanciona la publicidad engañosa.
- No prometas precios o condiciones distintas a las indicadas.
- Como máximo un emoji por variante, y solo si aporta.
- Cada variante debe ser claramente distinta de las otras en ángulo o gancho, no una reformulación mínima.`;
}

export async function generarCopys(params: {
  propiedad: PropiedadParaCopy | null;
  campaignType: CampaignTypeKey;
  cantidad?: number;
}): Promise<CopyGenerado[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Falta la variable de entorno OPENAI_API_KEY. Agrégala en app/.env.local para poder generar copys."
    );
  }
  if (!CAMPAIGN_TYPES[params.campaignType]) {
    throw new Error(`Tipo de campaña desconocido: "${params.campaignType}".`);
  }

  const cantidad = params.cantidad ?? 3;
  const openai = new OpenAI({ apiKey });

  // response_format con json_schema y strict:true obliga al modelo a devolver
  // exactamente esta estructura, en vez de texto libre que habría que parsear.
  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [{ role: "user", content: construirPrompt(params.propiedad, params.campaignType, cantidad) }],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "variantes_de_copy",
        strict: true,
        schema: {
          type: "object",
          properties: {
            variantes: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  primaryText: { type: "string", description: "Texto principal del anuncio" },
                  headline: { type: "string", description: "Título corto" },
                  description: { type: "string", description: "Descripción breve" },
                },
                required: ["primaryText", "headline", "description"],
                additionalProperties: false,
              },
            },
          },
          required: ["variantes"],
          additionalProperties: false,
        },
      },
    },
  });

  const contenido = response.choices[0]?.message?.content;
  if (!contenido) throw new Error("OpenAI no devolvió contenido.");

  const parsed = JSON.parse(contenido) as { variantes?: CopyGenerado[] };
  if (!parsed.variantes?.length) throw new Error("OpenAI no devolvió variantes de copy.");

  // Red de seguridad: si el modelo se pasa del máximo duro de Meta, se recorta
  // antes de guardar para que el anuncio no sea rechazado por la API.
  return parsed.variantes.map((v) => ({
    primaryText: v.primaryText.trim().slice(0, COPY_LIMITS.primaryText.maximo),
    headline: v.headline.trim().slice(0, COPY_LIMITS.headline.maximo),
    description: v.description.trim().slice(0, COPY_LIMITS.description.maximo),
  }));
}

// --- Textos de las tarjetas del carrusel ---

export type TextoTarjeta = { headline: string; description: string };

// Genera el título y la descripción de cada tarjeta de un carrusel.
//
// A diferencia de generarCopys(), acá el modelo SÍ ve las fotos: en un carrusel
// inmobiliario cada tarjeta muestra un ambiente distinto, y un título que no
// corresponde a lo que se ve resta credibilidad. Las que no se pudieron leer van
// como null y se resuelven solo con los datos de la propiedad.
export async function generarTextosCarrusel(params: {
  propiedad: PropiedadParaCopy | null;
  campaignType: CampaignTypeKey;
  imagenes: (string | null)[];
}): Promise<TextoTarjeta[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Falta la variable de entorno OPENAI_API_KEY. Agrégala en app/.env.local para poder generar textos."
    );
  }
  const cantidad = params.imagenes.length;
  if (cantidad === 0) throw new Error("No hay tarjetas para las que generar texto.");

  const datos = params.propiedad
    ? describirPropiedad(params.propiedad)
    : "No hay datos de la propiedad: usa solo lo que se vea en las fotos.";

  const instrucciones = `Eres redactor publicitario del mercado inmobiliario chileno.

Vas a escribir el título y la descripción de cada una de las ${cantidad} tarjetas de un
carrusel de Facebook/Instagram Ads. Las tarjetas van en el orden en que te muestro las
imágenes: la imagen 1 corresponde a la tarjeta 1, y así sucesivamente.

Datos de la propiedad:
${datos}

Objetivo del anuncio: ${CTA_POR_TIPO[params.campaignType]}.

Reglas obligatorias:
- Español de Chile, tono cercano y profesional. Trata de "tú".
- Cada título describe LO QUE SE VE en su imagen (por ejemplo el ambiente: living, cocina,
  dormitorio, baño, fachada, patio). Entre 3 y 5 palabras.
- La descripción complementa el título y debe ser MUY breve: entre 2 y 4 palabras, nunca una
  frase completa. Meta la corta cerca de los ${COPY_LIMITS.description.recomendado} caracteres.
  Ejemplos del largo correcto: "Luz natural todo el día", "Ideal para la familia", "Recién pintada".
- Prohibido inventar: si en la foto no se distingue el material, la marca, los metros
  cuadrados o el equipamiento, no lo menciones. Describe solo lo visible y lo que está
  en los datos de la propiedad.
- Prohibidos los superlativos no verificables y las promesas de rentabilidad o plusvalía
  (Ley 19.496 de protección al consumidor).
- Sin emojis en las tarjetas: el espacio es muy corto.
- No repitas el mismo título en dos tarjetas.
- Si una imagen no está disponible, escribe un texto genérico y correcto usando solo los
  datos de la propiedad.
- Devuelve exactamente ${cantidad} tarjetas, en orden.`;

  const contenidoUsuario: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
    { type: "text", text: instrucciones },
  ];
  params.imagenes.forEach((dataUrl, i) => {
    contenidoUsuario.push({ type: "text", text: `Imagen de la tarjeta ${i + 1}:` });
    if (dataUrl) {
      // detail "low" le basta para reconocer el ambiente y cuesta una fracción.
      contenidoUsuario.push({ type: "image_url", image_url: { url: dataUrl, detail: "low" } });
    } else {
      contenidoUsuario.push({ type: "text", text: "(imagen no disponible)" });
    }
  });

  const openai = new OpenAI({ apiKey });
  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [{ role: "user", content: contenidoUsuario }],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "textos_de_tarjetas",
        strict: true,
        schema: {
          type: "object",
          properties: {
            tarjetas: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  headline: { type: "string", description: "Título corto de la tarjeta" },
                  description: { type: "string", description: "Descripción breve de la tarjeta" },
                },
                required: ["headline", "description"],
                additionalProperties: false,
              },
            },
          },
          required: ["tarjetas"],
          additionalProperties: false,
        },
      },
    },
  });

  const contenido = response.choices[0]?.message?.content;
  if (!contenido) throw new Error("OpenAI no devolvió contenido.");

  const parsed = JSON.parse(contenido) as { tarjetas?: TextoTarjeta[] };
  if (!parsed.tarjetas?.length) throw new Error("OpenAI no devolvió textos de tarjetas.");

  // Se devuelve siempre exactamente una entrada por tarjeta: si el modelo manda de
  // menos, las que falten quedan vacías en vez de descuadrar el orden.
  return Array.from({ length: cantidad }, (_, i) => ({
    headline: (parsed.tarjetas?.[i]?.headline ?? "").trim().slice(0, COPY_LIMITS.headline.maximo),
    description: (parsed.tarjetas?.[i]?.description ?? "").trim().slice(0, COPY_LIMITS.description.maximo),
  }));
}
