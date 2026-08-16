import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { resolveOrganizationForUser } from "@/lib/org";
import { generarCopys, PROMPT_VERSION } from "@/lib/copy-generator";
import { CAMPAIGN_TYPES, type CampaignTypeKey } from "@/lib/meta-campaign-types";

// Genera variantes de copy con IA. Sirve a los dos flujos:
// - Con campaignId: guarda las variantes en esa campaña (editar campaña existente).
// - Sin campaignId: solo las devuelve para previsualizar (wizard de campaña nueva,
//   donde la campaña todavía no existe en la base de datos).
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "No autorizado" }, { status: 401 });

  const organization = await resolveOrganizationForUser(user);
  if (!organization) return Response.json({ error: "No hay organización" }, { status: 400 });

  let body: { propertyId?: string | null; campaignType?: string; campaignId?: string | null };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const campaignType = body.campaignType as CampaignTypeKey;
  if (!CAMPAIGN_TYPES[campaignType]) {
    return Response.json({ error: "Tipo de campaña inválido" }, { status: 400 });
  }

  // Si se pasa una campaña, se valida que sea de esta organización (aislamiento
  // multi-tenant: nadie puede generar copys sobre campañas de otra inmobiliaria).
  let campaign = null;
  if (body.campaignId) {
    campaign = await prisma.campaign.findFirst({
      where: { id: body.campaignId, organizationId: organization.id },
    });
    if (!campaign) return Response.json({ error: "Campaña no encontrada" }, { status: 404 });
  }

  const propertyId = body.propertyId ?? campaign?.propertyId ?? null;
  let propiedad = null;
  if (propertyId) {
    propiedad = await prisma.property.findFirst({
      where: { id: propertyId, organizationId: organization.id },
    });
    if (!propiedad) return Response.json({ error: "Propiedad no encontrada" }, { status: 404 });
  }

  try {
    const variantes = await generarCopys({ propiedad, campaignType });

    if (campaign) {
      await prisma.copyVariant.createMany({
        data: variantes.map((v) => ({
          campaignId: campaign.id,
          primaryText: v.primaryText,
          headline: v.headline,
          description: v.description,
          generatedBy: "IA" as const,
          promptVersion: PROMPT_VERSION,
        })),
      });
    }

    return Response.json({ variantes });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido generando copys";
    console.error("Error generando copys:", err);
    return Response.json({ error: message }, { status: 500 });
  }
}
