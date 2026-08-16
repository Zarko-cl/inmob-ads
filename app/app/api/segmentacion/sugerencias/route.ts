import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { resolveOrganizationForUser } from "@/lib/org";
import { getActiveMetaConnection } from "@/lib/meta-connection";
import { buscarUbicaciones } from "@/lib/meta-marketing-api";
import { sugerirComunasParecidas } from "@/lib/comunas-sugeridas";
import type { GeoSeleccion } from "@/lib/meta-targeting";

// Dado el nombre de una comuna, devuelve la ubicación real del catálogo de Meta o
// null si no existe. Sin esto no se puede segmentar: Meta necesita su clave, y una
// clave inventada no da error — simplemente deja el anuncio sin entrega.
// Compara nombres ignorando tildes, mayúsculas y espacios sobrantes: la IA escribe
// "Nunoa" o "ÑUÑOA" y Meta guarda "Ñuñoa".
function normalizar(texto: string): string {
  return texto
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

async function resolverComuna(
  nombre: string,
  accessToken: string
): Promise<GeoSeleccion | null> {
  try {
    const resultados = await buscarUbicaciones({ accessToken, query: nombre, countryCode: "CL" });

    // Se exige coincidencia EXACTA del nombre. Antes, si no la había, se tomaba la
    // primera comuna que devolviera Meta — y eso producía sugerencias mentirosas:
    // buscar "Santiago" devolvía Providencia como primer resultado, así que el botón
    // decía una comuna y habría segmentado otra. Ante la duda es mejor descartar:
    // el usuario siempre puede buscarla a mano.
    // Se aceptan los dos tipos que usa Meta para las comunas chilenas: las del Gran
    // Santiago son "subcity" (Providencia, Las Condes) y las del resto del país son
    // "city" (Viña del Mar, Concepción, Puerto Varas). Verificado contra el catálogo.
    // Se prefiere subcity por ser más específica.
    const buscado = normalizar(nombre);
    const calza = (r: { name: string; type: string }, tipo: string) =>
      r.type === tipo && normalizar(r.name) === buscado;
    const elegida =
      resultados.find((r) => calza(r, "subcity")) ??
      resultados.find((r) => calza(r, "city")) ??
      null;
    if (!elegida) return null;

    return {
      key: elegida.key,
      name: elegida.name,
      type: elegida.type,
      countryCode: elegida.countryCode || "CL",
    };
  } catch (err) {
    console.error(`No se pudo resolver la comuna "${nombre}":`, err);
    return null;
  }
}

// Devuelve, para una propiedad:
//   - `comuna`: su comuna ya resuelta contra Meta, lista para precargar.
//   - `sugeridas`: comunas parecidas por nivel socioeconómico y cercanía (solo si se
//     piden con `conIa`, porque cada llamada cuesta).
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "No autorizado" }, { status: 401 });

  const organization = await resolveOrganizationForUser(user);
  if (!organization) return Response.json({ error: "No hay organización" }, { status: 400 });

  const connection = await getActiveMetaConnection(organization.id);
  if (!connection) {
    return Response.json({ error: "No hay una conexión de Meta activa." }, { status: 400 });
  }

  let cuerpo: { propertyId?: string; conIa?: boolean };
  try {
    cuerpo = await request.json();
  } catch {
    return Response.json({ error: "Petición inválida" }, { status: 400 });
  }

  const property = await prisma.property.findFirst({
    where: { id: String(cuerpo.propertyId ?? ""), organizationId: organization.id },
  });
  if (!property) return Response.json({ error: "Propiedad no encontrada" }, { status: 404 });

  if (!property.comuna?.trim()) {
    return Response.json({
      comuna: null,
      sugeridas: [],
      aviso: "Esta propiedad no tiene comuna registrada. Complétala en su ficha para poder segmentar por zona.",
    });
  }

  const comuna = await resolverComuna(property.comuna, connection.accessToken);

  if (!cuerpo.conIa) {
    return Response.json({
      comuna,
      sugeridas: [],
      aviso: comuna
        ? null
        : `No se encontró "${property.comuna}" en el catálogo de Meta. Revisa cómo está escrita en la ficha de la propiedad.`,
    });
  }

  // --- Sugerencias con IA ---
  try {
    const propuestas = await sugerirComunasParecidas({
      comuna: property.comuna,
      region: property.region,
      price: property.price,
      currency: property.currency,
      propertyType: property.propertyType,
      operation: property.operation,
    });

    // Cada nombre propuesto se valida contra el catálogo real. Las que Meta no conoce
    // se descartan en silencio: mostrarlas llevaría a segmentar una clave inválida.
    const resueltas = await Promise.all(
      propuestas.map(async (p) => {
        const geo = await resolverComuna(p.nombre, connection.accessToken);
        return geo ? { ...geo, motivo: p.motivo } : null;
      })
    );

    const validas = resueltas.filter((r): r is NonNullable<typeof r> => r !== null);
    // Sin duplicados y sin la comuna de la propiedad.
    const vistas = new Set(comuna ? [comuna.key] : []);
    const sugeridas = validas.filter((s) => !vistas.has(s.key) && vistas.add(s.key));

    return Response.json({
      comuna,
      sugeridas,
      aviso:
        sugeridas.length === 0
          ? "La IA no propuso comunas que Meta reconozca. Puedes buscarlas a mano."
          : null,
    });
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : "No se pudieron sugerir comunas.";
    console.error("Error sugiriendo comunas:", err);
    // La comuna de la propiedad igual se devuelve: es lo más valioso y no depende de la IA.
    return Response.json({ comuna, sugeridas: [], aviso: mensaje });
  }
}
