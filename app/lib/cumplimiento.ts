// Motor de validación de cumplimiento previo a publicar (M9).
//
// Cubre tres frentes:
//   - Normas de Publicidad de Meta (Ad Standards): universales, no dependen del país.
//   - Ley 19.496 (protección al consumidor, Chile): prohíbe la publicidad engañosa.
//     Es la más relevante para inmobiliaria: promesas de plusvalía, superlativos no
//     verificables, precios que no calzan con la propiedad.
//   - Ley 21.719 (protección de datos personales, Chile): si la campaña capta datos
//     de personas, hace falta informar el tratamiento.
//
// IMPORTANTE: esto reduce riesgos, no los elimina. No sustituye la revisión de un
// abogado ni garantiza que Meta apruebe el anuncio: Meta tiene su propio criterio y
// puede rechazar contenido que acá pase.

import { CAMPAIGN_TYPES, type CampaignTypeKey } from "@/lib/meta-campaign-types";
import { validarCarrusel } from "@/lib/carrusel";

export type Severidad = "BLOQUEA" | "ADVIERTE";
export type Norma = "META_AD_STANDARDS" | "LEY_19496" | "LEY_21719" | "REQUISITOS_TECNICOS";

export type Hallazgo = {
  codigo: string;
  norma: Norma;
  severidad: Severidad;
  mensaje: string;
  comoCorregir: string;
};

export const ETIQUETA_NORMA: Record<Norma, string> = {
  META_AD_STANDARDS: "Normas de publicidad de Meta",
  LEY_19496: "Ley 19.496 — protección al consumidor",
  LEY_21719: "Ley 21.719 — protección de datos",
  REQUISITOS_TECNICOS: "Requisitos técnicos de Meta",
};

// Frases que prometen un resultado económico. En publicidad inmobiliaria son el
// riesgo más concreto bajo la Ley 19.496: afirman algo que no se puede garantizar.
const PROMESAS_PROHIBIDAS = [
  "rentabilidad garantizada",
  "ganancia asegurada",
  "plusvalía garantizada",
  "plusvalia garantizada",
  "retorno garantizado",
  "inversión segura",
  "inversion segura",
  "sin riesgo",
  "ganancia garantizada",
  "se valoriza seguro",
];

// Superlativos que no se pueden comprobar. No están prohibidos por sí solos, pero
// SERNAC los considera engañosos si no hay respaldo objetivo.
const SUPERLATIVOS = [
  "el mejor",
  "la mejor",
  "el más barato",
  "el mas barato",
  "la más barata",
  "la mas barata",
  "único en",
  "unico en",
  "el más exclusivo",
  "el mas exclusivo",
  "líder del mercado",
  "lider del mercado",
  "imperdible oportunidad",
  "la mejor inversión",
  "la mejor inversion",
];

// Absolutos que suelen requerir letra chica y por eso levantan sospecha de engaño.
const ABSOLUTOS = ["100% seguro", "garantizado", "sin letra chica", "gratis total", "para siempre"];

function contiene(texto: string, frases: string[]): string | null {
  const limpio = texto.toLowerCase();
  return frases.find((f) => limpio.includes(f)) ?? null;
}

// Extrae cifras que parezcan precios: "UF 4.500", "$120.000.000".
function preciosMencionados(texto: string): number[] {
  const encontrados: number[] = [];
  const patron = /(?:uf|\$)\s*([\d.,]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = patron.exec(texto)) !== null) {
    // En Chile el punto separa miles y la coma decimales.
    const valor = Number(m[1].replace(/\./g, "").replace(",", "."));
    if (Number.isFinite(valor) && valor > 0) encontrados.push(valor);
  }
  return encontrados;
}

export type DatosRevision = {
  campaignType: CampaignTypeKey;
  destinationUrl: string | null;
  tieneImagen: boolean;
  // Formato del anuncio: en carrusel no basta una foto, hacen falta varias.
  adFormat?: "IMAGEN_UNICA" | "CARRUSEL";
  tarjetasCarrusel?: number;
  // Títulos y descripciones de las tarjetas del carrusel. Se revisan igual que el
  // copy: un superlativo o una promesa de rentabilidad en una tarjeta es tan
  // engañoso como en el texto principal.
  textosCarrusel?: string[];
  copyAprobado: { primaryText: string; headline: string; description: string | null } | null;
  propiedad: { price: number; currency: string } | null;
  // Segmentación
  specialAdCategoryActive: boolean;
  paisesRestringidos: string[];
  // Organización
  privacyPolicyUrl: string | null;
};

export function revisarCumplimiento(datos: DatosRevision): Hallazgo[] {
  const hallazgos: Hallazgo[] = [];
  const config = CAMPAIGN_TYPES[datos.campaignType];

  // --- Requisitos técnicos: sin esto Meta ni siquiera crea el anuncio ---
  if (datos.adFormat === "CARRUSEL") {
    const problema = validarCarrusel({ length: datos.tarjetasCarrusel ?? 0 });
    if (problema) {
      hallazgos.push({
        codigo: "CARRUSEL_INVALIDO",
        norma: "REQUISITOS_TECNICOS",
        severidad: "BLOQUEA",
        mensaje: problema,
        comoCorregir: "Ajusta las tarjetas en la sección “Formato del anuncio” y guarda.",
      });
    }
  } else if (!datos.tieneImagen) {
    hallazgos.push({
      codigo: "SIN_IMAGEN",
      norma: "REQUISITOS_TECNICOS",
      severidad: "BLOQUEA",
      mensaje: "La campaña no tiene una foto elegida para el anuncio.",
      comoCorregir: "Elige una foto en la sección “Formato del anuncio” y guarda.",
    });
  }

  if (!datos.copyAprobado) {
    hallazgos.push({
      codigo: "SIN_COPY",
      norma: "REQUISITOS_TECNICOS",
      severidad: "BLOQUEA",
      mensaje: "No hay ningún copy aprobado.",
      comoCorregir: "Genera o escribe un copy y presiona “Guardar y aprobar”.",
    });
  }

  if (config?.requiereUrl && !datos.destinationUrl) {
    hallazgos.push({
      codigo: "SIN_URL",
      norma: "REQUISITOS_TECNICOS",
      severidad: "BLOQUEA",
      mensaje: "Este tipo de campaña necesita una URL de destino.",
      comoCorregir: "Agrega la URL de la ficha de la propiedad o del sitio.",
    });
  }

  // --- Meta Ad Standards ---
  if (datos.destinationUrl && !datos.destinationUrl.startsWith("https://")) {
    hallazgos.push({
      codigo: "URL_NO_SEGURA",
      norma: "META_AD_STANDARDS",
      severidad: "ADVIERTE",
      mensaje: "La URL de destino no usa HTTPS.",
      comoCorregir:
        "Usa una dirección https://. Meta penaliza los destinos inseguros y algunos navegadores los bloquean.",
    });
  }

  const textoCompleto = [
    ...(datos.copyAprobado
      ? [datos.copyAprobado.primaryText, datos.copyAprobado.headline, datos.copyAprobado.description ?? ""]
      : []),
    ...(datos.textosCarrusel ?? []),
  ]
    .filter(Boolean)
    .join(" ");

  if (textoCompleto) {
    // Meta desaconseja el uso excesivo de mayúsculas ("gritar" en el anuncio).
    const letras = textoCompleto.replace(/[^a-záéíóúñA-ZÁÉÍÓÚÑ]/g, "");
    const mayusculas = textoCompleto.replace(/[^A-ZÁÉÍÓÚÑ]/g, "");
    if (letras.length > 20 && mayusculas.length / letras.length > 0.4) {
      hallazgos.push({
        codigo: "EXCESO_MAYUSCULAS",
        norma: "META_AD_STANDARDS",
        severidad: "ADVIERTE",
        mensaje: "El texto usa demasiadas mayúsculas.",
        comoCorregir: "Escribe en minúsculas salvo nombres propios; Meta puede limitar la entrega.",
      });
    }

    // --- Ley 19.496: publicidad engañosa ---
    const promesa = contiene(textoCompleto, PROMESAS_PROHIBIDAS);
    if (promesa) {
      hallazgos.push({
        codigo: "PROMESA_ECONOMICA",
        norma: "LEY_19496",
        severidad: "BLOQUEA",
        mensaje: `El copy promete un resultado económico que no se puede garantizar: “${promesa}”.`,
        comoCorregir:
          "Elimina esa frase. Puedes describir características reales de la propiedad, pero no garantizar rentabilidad ni plusvalía.",
      });
    }

    const superlativo = contiene(textoCompleto, SUPERLATIVOS);
    if (superlativo) {
      hallazgos.push({
        codigo: "SUPERLATIVO_NO_VERIFICABLE",
        norma: "LEY_19496",
        severidad: "ADVIERTE",
        mensaje: `El copy usa un superlativo que habría que poder demostrar: “${superlativo}”.`,
        comoCorregir:
          "Reemplázalo por un dato concreto y verificable (metros, ubicación, precio) o elimínalo.",
      });
    }

    const absoluto = contiene(textoCompleto, ABSOLUTOS);
    if (absoluto) {
      hallazgos.push({
        codigo: "AFIRMACION_ABSOLUTA",
        norma: "LEY_19496",
        severidad: "ADVIERTE",
        mensaje: `El copy usa una afirmación absoluta: “${absoluto}”.`,
        comoCorregir: "Si tiene condiciones, deben estar visibles; si no puedes cumplirlo siempre, quítalo.",
      });
    }

    // Precio del copy vs precio real de la propiedad.
    if (datos.propiedad) {
      const precios = preciosMencionados(textoCompleto);
      const real = datos.propiedad.price;
      const hayDistinto = precios.length > 0 && !precios.some((p) => Math.abs(p - real) / real < 0.02);
      if (hayDistinto) {
        hallazgos.push({
          codigo: "PRECIO_NO_COINCIDE",
          norma: "LEY_19496",
          severidad: "ADVIERTE",
          mensaje: `El copy menciona ${precios.map((p) => p.toLocaleString("es-CL")).join(", ")} y la propiedad está registrada en ${real.toLocaleString("es-CL")} ${datos.propiedad.currency}.`,
          comoCorregir:
            "Verifica que el precio publicado sea el real. Anunciar un precio distinto al vigente es publicidad engañosa.",
        });
      }
    }
  }

  // --- Ley 21.719: datos personales ---
  // Los tipos que abren una conversación o un formulario recogen datos de personas.
  const captaDatos =
    datos.campaignType === "FORMULARIO_INSTANTANEO" ||
    datos.campaignType === "WHATSAPP" ||
    datos.campaignType === "INSTAGRAM_MESSENGER";

  if (captaDatos && !datos.privacyPolicyUrl) {
    hallazgos.push({
      codigo: "SIN_POLITICA_PRIVACIDAD",
      norma: "LEY_21719",
      severidad: "BLOQUEA",
      mensaje:
        "Esta campaña capta datos personales y la inmobiliaria no tiene una política de privacidad publicada.",
      comoCorregir:
        "Publica la política de privacidad y regístrala en la ficha de la inmobiliaria. La Ley 21.719 exige informar quién trata los datos, para qué y por cuánto tiempo.",
    });
  }

  if (captaDatos && datos.privacyPolicyUrl) {
    hallazgos.push({
      codigo: "RECORDATORIO_CONSENTIMIENTO",
      norma: "LEY_21719",
      severidad: "ADVIERTE",
      mensaje: "Esta campaña capta datos personales de quienes respondan.",
      comoCorregir:
        "Asegúrate de pedir consentimiento antes de usar esos datos para otra cosa (por ejemplo, enviar otras propiedades), y de respetar el plazo de retención definido.",
    });
  }

  // --- Coherencia de Special Ad Category (M6) ---
  if (datos.paisesRestringidos.length > 0 && !datos.specialAdCategoryActive) {
    hallazgos.push({
      codigo: "CATEGORIA_ESPECIAL_FALTANTE",
      norma: "META_AD_STANDARDS",
      severidad: "BLOQUEA",
      mensaje: `La segmentación incluye ${datos.paisesRestringidos.join(", ")}, donde Meta exige la categoría especial de vivienda, pero no está activada.`,
      comoCorregir:
        "Vuelve a guardar la segmentación para que se active sola, o quita esos países si la campaña es solo para Chile.",
    });
  }

  return hallazgos;
}

export function bloquea(hallazgos: Hallazgo[]): boolean {
  return hallazgos.some((h) => h.severidad === "BLOQUEA");
}
