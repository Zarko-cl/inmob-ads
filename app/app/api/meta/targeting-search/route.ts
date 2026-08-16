import { getCurrentUser } from "@/lib/session";
import { resolveOrganizationForUser } from "@/lib/org";
import { getActiveMetaConnection } from "@/lib/meta-connection";
import { buscarUbicaciones, buscarIntereses } from "@/lib/meta-marketing-api";

// Busca ubicaciones o intereses en el catálogo de Meta mientras el usuario escribe.
// Va por el servidor y no directo desde el navegador porque la búsqueda necesita el
// token de acceso, que nunca debe salir al frontend.
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "No autorizado" }, { status: 401 });

  const organization = await resolveOrganizationForUser(user);
  if (!organization) return Response.json({ error: "No hay organización" }, { status: 400 });

  const connection = await getActiveMetaConnection(organization.id);
  if (!connection) return Response.json({ error: "No hay conexión de Meta activa" }, { status: 400 });

  const url = new URL(request.url);
  const tipo = url.searchParams.get("tipo");
  const query = (url.searchParams.get("q") ?? "").trim();
  // "pais" vacío o "TODOS" busca en el mundo entero; por defecto se filtra a Chile.
  const paisRaw = url.searchParams.get("pais");
  const countryCode = !paisRaw || paisRaw === "TODOS" ? null : paisRaw;

  if (query.length < 2) return Response.json({ resultados: [] });

  try {
    if (tipo === "ubicacion") {
      return Response.json({
        resultados: await buscarUbicaciones({ accessToken: connection.accessToken, query, countryCode }),
      });
    }
    if (tipo === "interes") {
      return Response.json({
        resultados: await buscarIntereses({ accessToken: connection.accessToken, query }),
      });
    }
    return Response.json({ error: "Tipo de búsqueda inválido" }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error buscando en Meta";
    console.error("Error en targeting-search:", err);
    return Response.json({ error: message }, { status: 500 });
  }
}
