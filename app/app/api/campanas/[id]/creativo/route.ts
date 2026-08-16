import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { resolveOrganizationForUser } from "@/lib/org";
import { MAX_TARJETAS } from "@/lib/carrusel";

// Guarda el formato del anuncio y su creativo, desde el detalle de la campaña.
//
// Dos formatos posibles:
//   - IMAGEN_UNICA: una sola foto en `Campaign.creativeMediaId`.
//   - CARRUSEL: varias fotos ordenadas en la tabla `carousel_cards`, cada una con
//     su título y descripción opcionales.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "No autorizado" }, { status: 401 });

  const organization = await resolveOrganizationForUser(user);
  if (!organization) return Response.json({ error: "No hay organización." }, { status: 400 });

  const { id } = await params;
  const campaign = await prisma.campaign.findFirst({
    where: { id, organizationId: organization.id },
  });
  if (!campaign) return Response.json({ error: "Campaña no encontrada." }, { status: 404 });

  const form = await request.formData();
  const formato = String(form.get("adFormat") ?? "IMAGEN_UNICA");

  if (formato === "CARRUSEL") {
    if (!campaign.propertyId) {
      return Response.json({ error: "La campaña no tiene una propiedad asociada." }, { status: 400 });
    }

    // El navegador manda las tarjetas como JSON en un campo oculto: son varias filas
    // con orden, y un formulario plano no expresa bien esa estructura.
    let crudo: unknown;
    try {
      crudo = JSON.parse(String(form.get("tarjetas") ?? "[]"));
    } catch {
      return Response.json({ error: "Tarjetas inválidas." }, { status: 400 });
    }
    if (!Array.isArray(crudo)) return Response.json({ error: "Tarjetas inválidas." }, { status: 400 });
    if (crudo.length > MAX_TARJETAS) {
      return Response.json({ error: `Máximo ${MAX_TARJETAS} tarjetas.` }, { status: 400 });
    }

    // Se validan contra las fotos reales de la propiedad: el navegador es manipulable.
    const fotos = await prisma.propertyMedia.findMany({
      where: { propertyId: campaign.propertyId },
      select: { id: true },
    });
    const validas = new Set(fotos.map((f) => f.id));

    const tarjetas = (crudo as Record<string, unknown>[]).map((t, i) => ({
      propertyMediaId: String(t.propertyMediaId ?? ""),
      headline: String(t.headline ?? "").trim() || null,
      description: String(t.description ?? "").trim() || null,
      orden: i,
    }));

    if (tarjetas.some((t) => !validas.has(t.propertyMediaId))) {
      return Response.json({ error: "Alguna foto no pertenece a la propiedad de la campaña." }, { status: 400 });
    }

    // Se reemplazan todas de una vez: es más simple y seguro que calcular el diff.
    // La transacción evita quedar sin tarjetas si la segunda operación falla.
    await prisma.$transaction([
      prisma.carouselCard.deleteMany({ where: { campaignId: campaign.id } }),
      prisma.carouselCard.createMany({
        data: tarjetas.map((t) => ({ ...t, campaignId: campaign.id })),
      }),
      prisma.campaign.update({
        where: { id: campaign.id },
        // En carrusel la foto única deja de tener sentido, se limpia.
        data: { adFormat: "CARRUSEL", creativeMediaId: null },
      }),
    ]);

    return Response.json({ ok: true });
  }

  // --- Imagen única ---
  const mediaId = String(form.get("creativeMediaId") ?? "").trim();

  let creativeMediaId: string | null = null;
  if (mediaId) {
    if (!campaign.propertyId) {
      return Response.json({ error: "La campaña no tiene una propiedad asociada." }, { status: 400 });
    }
    // La foto tiene que ser de la propiedad de esta campaña, no de cualquier otra.
    const media = await prisma.propertyMedia.findFirst({
      where: { id: mediaId, propertyId: campaign.propertyId },
    });
    if (!media) return Response.json({ error: "Foto inválida." }, { status: 400 });
    creativeMediaId = media.id;
  }

  await prisma.$transaction([
    // Las tarjetas del carrusel se borran al volver a imagen única para que no queden
    // colgando y vuelvan solas si el usuario cambia de opinión más tarde.
    prisma.carouselCard.deleteMany({ where: { campaignId: campaign.id } }),
    prisma.campaign.update({
      where: { id: campaign.id },
      data: { adFormat: "IMAGEN_UNICA", creativeMediaId },
    }),
  ]);

  return Response.json({ ok: true });
}
