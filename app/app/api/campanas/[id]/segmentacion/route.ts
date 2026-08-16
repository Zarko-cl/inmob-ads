import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { resolveOrganizationForUser } from "@/lib/org";
import {
  construirTargeting,
  comoJson,
  requiereSpecialAdCategory,
  type ConfigSegmentacion,
} from "@/lib/meta-targeting";
import { urlDeLaApp } from "@/lib/urls";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return Response.redirect(urlDeLaApp("/login", request));

  const organization = await resolveOrganizationForUser(user);
  if (!organization) return new Response("No hay organización.", { status: 400 });

  const { id } = await params;
  const campaign = await prisma.campaign.findFirst({
    where: { id, organizationId: organization.id },
    include: { adSets: true },
  });
  if (!campaign) return new Response("Campaña no encontrada.", { status: 404 });

  const form = await request.formData();
  let segmentacion: ConfigSegmentacion;
  try {
    segmentacion = JSON.parse(String(form.get("segmentacion") ?? "")) as ConfigSegmentacion;
  } catch {
    return new Response("Segmentación inválida.", { status: 400 });
  }

  const datos = {
    targetingMode: segmentacion.modo,
    targetingJson: construirTargeting(segmentacion),
      targetingConfigJson: comoJson(segmentacion),
    specialAdCategoryActive: requiereSpecialAdCategory(segmentacion),
  };

  const existente = campaign.adSets[0];
  if (existente) {
    await prisma.adSet.update({ where: { id: existente.id }, data: datos });
  } else {
    await prisma.adSet.create({
      data: { campaignId: campaign.id, name: `${campaign.name} — Conjunto`, ...datos },
    });
  }

  return Response.redirect(urlDeLaApp(`/campanas/${campaign.id}`, request));
}
