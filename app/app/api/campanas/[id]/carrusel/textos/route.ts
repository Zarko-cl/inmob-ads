import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { resolveOrganizationForUser } from "@/lib/org";
import { generarTextosCarrusel } from "@/lib/copy-generator";
import { miniaturaParaIA } from "@/lib/miniatura";
import { MAX_TARJETAS } from "@/lib/carrusel";
import type { CampaignTypeKey } from "@/lib/meta-campaign-types";

// Genera con IA el título y la descripción de cada tarjeta del carrusel.
//
// No guarda nada: devuelve los textos para que el usuario los revise (y edite) en
// pantalla y recién después apriete "Guardar formato". Igual que en M7, la IA
// propone y la persona aprueba.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "No autorizado" }, { status: 401 });

  const organization = await resolveOrganizationForUser(user);
  if (!organization) return Response.json({ error: "No hay organización" }, { status: 400 });

  const { id } = await params;
  const campaign = await prisma.campaign.findFirst({
    where: { id, organizationId: organization.id },
    include: { property: true },
  });
  if (!campaign) return Response.json({ error: "Campaña no encontrada" }, { status: 404 });

  let propertyMediaIds: unknown;
  try {
    ({ propertyMediaIds } = await request.json());
  } catch {
    return Response.json({ error: "Petición inválida" }, { status: 400 });
  }
  if (
    !Array.isArray(propertyMediaIds) ||
    propertyMediaIds.length === 0 ||
    propertyMediaIds.length > MAX_TARJETAS ||
    propertyMediaIds.some((i) => typeof i !== "string")
  ) {
    return Response.json({ error: "Lista de fotos inválida" }, { status: 400 });
  }

  if (!campaign.propertyId) {
    return Response.json({ error: "La campaña no tiene una propiedad asociada." }, { status: 400 });
  }

  // Las fotos tienen que ser de la propiedad de esta campaña: el navegador es
  // manipulable y podrían mandarse ids de otra inmobiliaria.
  const fotos = await prisma.propertyMedia.findMany({
    where: { id: { in: propertyMediaIds as string[] }, propertyId: campaign.propertyId },
  });
  const porId = new Map(fotos.map((f) => [f.id, f]));
  if (porId.size !== new Set(propertyMediaIds as string[]).size) {
    return Response.json({ error: "Alguna foto no pertenece a la propiedad." }, { status: 400 });
  }

  try {
    // El orden importa: la imagen N tiene que corresponder a la tarjeta N.
    const imagenes = await Promise.all(
      (propertyMediaIds as string[]).map((mediaId) => {
        const foto = porId.get(mediaId);
        return foto ? miniaturaParaIA(foto.pathname, foto.url) : Promise.resolve(null);
      })
    );

    const textos = await generarTextosCarrusel({
      propiedad: campaign.property,
      campaignType: campaign.campaignType as CampaignTypeKey,
      imagenes,
    });

    return Response.json({ textos });
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : "No se pudieron generar los textos.";
    console.error("Error generando textos de carrusel:", err);
    return Response.json({ error: mensaje }, { status: 500 });
  }
}
