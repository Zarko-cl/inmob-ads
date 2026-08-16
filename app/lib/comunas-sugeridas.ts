// Sugerencia de comunas parecidas a la de una propiedad, con IA.
//
// La idea: si vendes un departamento en Providencia a UF 20.000, tu comprador probable
// también mira Las Condes, Vitacura o Ñuñoa. Segmentar solo la comuna de la propiedad
// deja fuera a mucha gente con el mismo poder adquisitivo que sí compraría ahí.
//
// **La IA propone nombres; Meta decide cuáles existen.** Un modelo de lenguaje puede
// inventar una comuna o escribirla distinto, y una clave de ubicación inventada no da
// error: Meta simplemente entrega un alcance ridículo y el anuncio no se entrega
// (pasó en M6 con una clave falsa, que devolvió 1.000 personas). Por eso cada nombre
// sugerido se busca en el catálogo real y las que no aparecen se descartan.

import OpenAI from "openai";

const MODEL = process.env.OPENAI_MODEL ?? "gpt-4o";

export type PropiedadParaComunas = {
  comuna: string;
  region?: string | null;
  price: number;
  currency: string;
  propertyType: string;
  operation: string;
};

export type ComunaSugerida = { nombre: string; motivo: string };

// Cuántas pedirle al modelo. Se piden algunas de más porque en el filtrado contra
// Meta siempre se cae alguna.
const CUANTAS_PEDIR = 8;

export async function sugerirComunasParecidas(
  propiedad: PropiedadParaComunas
): Promise<ComunaSugerida[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Falta OPENAI_API_KEY en app/.env.local.");
  }
  if (!propiedad.comuna?.trim()) {
    throw new Error("La propiedad no tiene comuna registrada. Complétala en su ficha.");
  }

  const precio =
    propiedad.currency === "UF"
      ? `UF ${propiedad.price.toLocaleString("es-CL")}`
      : `$${propiedad.price.toLocaleString("es-CL")}`;

  const prompt = `Eres un tasador inmobiliario chileno con conocimiento del mercado por comuna.

Propiedad:
- Comuna: ${propiedad.comuna}
${propiedad.region ? `- Región: ${propiedad.region}\n` : ""}- Tipo: ${propiedad.propertyType}
- Operación: ${propiedad.operation}
- Precio: ${precio}

Devuelve ${CUANTAS_PEDIR} comunas de Chile donde vivan personas con capacidad de compra
similar a la que necesita esta propiedad, para segmentar un anuncio dirigido a
compradores potenciales.

Criterios, en orden de importancia:
1. **Nivel socioeconómico compatible con el precio.** Alguien que puede pagar ${precio}
   por ${propiedad.propertyType.toLowerCase()} vive en comunas de ingreso similar. Este es
   el criterio que manda: no sugieras comunas donde el ingreso típico no alcance.
2. **Cercanía geográfica.** Prioriza comunas vecinas o de la misma región
   (${propiedad.region ?? "la región de la propiedad"}), porque la gente suele mudarse
   cerca de donde ya vive, trabaja o estudian sus hijos.
3. **Sustituibilidad.** Comunas que un comprador consideraría como alternativa real a
   ${propiedad.comuna} por ese precio.

Reglas:
- NO incluyas ${propiedad.comuna} en la lista: ya está considerada.
- Usa el nombre oficial exacto de la comuna, sin la región ni la palabra "comuna".
  Ejemplos correctos: "Las Condes", "Ñuñoa", "Viña del Mar", "Puerto Varas".
- Solo comunas que existan de verdad en Chile.
- El motivo debe ser concreto y en menos de 12 palabras (por qué esa comuna calza con
  este precio o esta ubicación). Nada de frases genéricas como "buena zona".
- Ordena de la más parecida a la menos parecida.`;

  const openai = new OpenAI({ apiKey });
  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [{ role: "user", content: prompt }],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "comunas_sugeridas",
        strict: true,
        schema: {
          type: "object",
          properties: {
            comunas: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  nombre: { type: "string", description: "Nombre oficial de la comuna" },
                  motivo: { type: "string", description: "Por qué se parece, en pocas palabras" },
                },
                required: ["nombre", "motivo"],
                additionalProperties: false,
              },
            },
          },
          required: ["comunas"],
          additionalProperties: false,
        },
      },
    },
  });

  const contenido = response.choices[0]?.message?.content;
  if (!contenido) throw new Error("OpenAI no devolvió contenido.");

  const parsed = JSON.parse(contenido) as { comunas?: ComunaSugerida[] };
  const comunas = parsed.comunas ?? [];

  // Se descarta la propia comuna por si el modelo la incluyó igual.
  const propia = propiedad.comuna.trim().toLowerCase();
  return comunas
    .filter((c) => c.nombre.trim().toLowerCase() !== propia)
    .map((c) => ({ nombre: c.nombre.trim(), motivo: c.motivo.trim() }));
}
