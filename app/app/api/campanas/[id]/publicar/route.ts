import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { resolveOrganizationForUser } from "@/lib/org";
import { getActiveMetaConnection } from "@/lib/meta-connection";
import {
  createMetaCampaign,
  createMetaAdSet,
  subirImagenAMeta,
  createMetaAdCreative,
  createMetaAd,
} from "@/lib/meta-marketing-api";
import { CAMPAIGN_TYPES, validarRequisitos, type CampaignTypeKey } from "@/lib/meta-campaign-types";
import { leerArchivo } from "@/lib/storage";
import { revisarCumplimiento, bloquea } from "@/lib/cumplimiento";
import { paisesRestringidosIncluidos, type ConfigSegmentacion } from "@/lib/meta-targeting";
import { registrarAuditoria } from "@/lib/auditoria";
import { validarCarrusel } from "@/lib/carrusel";
import { urlDeLaApp } from "@/lib/urls";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return Response.redirect(urlDeLaApp("/login", request));

  const organization = await resolveOrganizationForUser(user);
  if (!organization) return new Response("No hay organización.", { status: 400 });

  const { id } = await params;
  const campaign = await prisma.campaign.findFirst({
    where: { id, organizationId: organization.id },
    include: {
      adSets: { include: { ads: { include: { copyVariant: true, creativeMedia: true } } } },
      creativeMedia: true,
      property: true,
      carouselCards: { include: { media: true }, orderBy: { orden: "asc" } },
      copyVariants: { where: { approved: true } },
    },
  });
  if (!campaign) return new Response("Campaña no encontrada.", { status: 404 });

  const connection = await getActiveMetaConnection(organization.id);
  if (!connection) return new Response("No hay una conexión de Meta activa.", { status: 400 });

  // Vuelve al lugar correcto: a la estrategia si la campaña es parte de una.
  const destinoVuelta = campaign.strategyId
    ? `/estrategias/${campaign.strategyId}`
    : `/campanas/${campaign.id}`;
  const volver = () => Response.redirect(urlDeLaApp(destinoVuelta, request));

  // Se revisan los requisitos del tipo de campaña ANTES de llamar a Meta, para
  // mostrar un mensaje entendible en vez de un error críptico de la API.
  const faltantes = validarRequisitos(campaign.campaignType as CampaignTypeKey, {
    destinationUrl: campaign.destinationUrl,
    pageId: connection.pageId,
    whatsappBusinessAccountId: connection.whatsappBusinessAccountId,
    instagramActorId: connection.instagramActorId,
    telefono: campaign.property?.agentPhone,
  });
  if (faltantes.length > 0) {
    await prisma.campaign.update({
      where: { id: campaign.id },
      data: { status: "ERROR", errorMessage: `Falta configurar: ${faltantes.join(", ")}.` },
    });
    return volver();
  }

  const config = CAMPAIGN_TYPES[campaign.campaignType as CampaignTypeKey];
  const copyAprobadoCampana = campaign.copyVariants[0] ?? null;

  // --- Revisión de cumplimiento antes de enviar nada a Meta (M9) ---
  const segmentacionGuardada = campaign.adSets[0]?.targetingConfigJson as ConfigSegmentacion | null;
  const hallazgos = revisarCumplimiento({
    campaignType: campaign.campaignType as CampaignTypeKey,
    destinationUrl: campaign.destinationUrl,
    tieneImagen: Boolean(
      campaign.creativeMedia ?? campaign.adSets.some((s) => s.ads.some((a) => a.creativeMediaId))
    ),
    adFormat: campaign.adFormat,
    tarjetasCarrusel: campaign.carouselCards.length,
    textosCarrusel: campaign.carouselCards.flatMap((c) => [c.headline ?? "", c.description ?? ""]),
    copyAprobado: copyAprobadoCampana,
    propiedad: campaign.property
      ? { price: campaign.property.price, currency: campaign.property.currency }
      : null,
    specialAdCategoryActive: campaign.adSets.some((s) => s.specialAdCategoryActive),
    paisesRestringidos: segmentacionGuardada
      ? paisesRestringidosIncluidos(segmentacionGuardada)
      : [],
    privacyPolicyUrl: organization.privacyPolicyUrl,
  });

  // Se guarda el resultado completo (no solo los problemas) para tener trazabilidad
  // de qué se revisó y cuándo, como pide el plan.
  await prisma.complianceCheck.deleteMany({ where: { campaignId: campaign.id } });
  if (hallazgos.length > 0) {
    await prisma.complianceCheck.createMany({
      data: hallazgos.map((h) => ({
        campaignId: campaign.id,
        codigo: h.codigo,
        norma: h.norma,
        severidad: h.severidad,
        mensaje: h.mensaje,
        aprobado: h.severidad !== "BLOQUEA",
      })),
    });
  }

  if (bloquea(hallazgos)) {
    const motivos = hallazgos.filter((h) => h.severidad === "BLOQUEA").map((h) => h.mensaje);
    await prisma.campaign.update({
      where: { id: campaign.id },
      data: { status: "ERROR", errorMessage: `No cumple: ${motivos.join(" ")}` },
    });
    await registrarAuditoria({
      organizationId: organization.id,
      actor: { id: user.id, email: user.email },
      action: "CUMPLIMIENTO_BLOQUEO",
      entityType: "Campaign",
      entityId: campaign.id,
      metadata: { motivos },
    });
    return volver();
  }

  // Las imágenes se suben a Meta una sola vez por foto, aunque varios anuncios
  // usen la misma: subir la misma imagen N veces gastaría cuota de API sin motivo.
  const hashesPorFoto = new Map<string, string>();
  async function hashDeFoto(media: { id: string; pathname: string; url: string; contentType: string | null }) {
    const existente = hashesPorFoto.get(media.id);
    if (existente) return existente;
    const bytes = await leerArchivo(media.pathname, media.url);
    const hash = await subirImagenAMeta({
      accessToken: connection!.accessToken,
      adAccountId: connection!.adAccountId,
      imagen: bytes,
      nombreArchivo: media.pathname,
      contentType: media.contentType ?? "image/jpeg",
    });
    hashesPorFoto.set(media.id, hash);
    return hash;
  }

  try {
    // Si la campaña ya existe en Meta (por ejemplo al reintentar), se reutiliza.
    let metaCampaignId = campaign.metaCampaignId;
    if (!metaCampaignId) {
      const creada = await createMetaCampaign({
        accessToken: connection.accessToken,
        adAccountId: connection.adAccountId,
        name: campaign.name,
        campaignType: campaign.campaignType as CampaignTypeKey,
        // La categoría especial se fija al crear la campaña y ya no se puede
        // cambiar en Meta, por eso se resuelve desde la segmentación guardada (M6).
        specialAdCategory: campaign.adSets.some((s) => s.specialAdCategoryActive),
      });
      metaCampaignId = creada.id;
      await prisma.campaign.update({ where: { id: campaign.id }, data: { metaCampaignId } });
    }

    // Una campaña puede tener varios conjuntos (estrategia) o uno solo.
    // Si no tiene ninguno todavía, se crea uno con los valores de la campaña.
    const conjuntos = campaign.adSets.length
      ? campaign.adSets
      : [
          await prisma.adSet.create({
            data: { campaignId: campaign.id, name: `${campaign.name} — Conjunto` },
            include: { ads: { include: { copyVariant: true, creativeMedia: true } } },
          }),
        ];

    for (const conjunto of conjuntos) {
      let metaAdSetId = conjunto.metaAdSetId;

      if (!metaAdSetId) {
        const creado = await createMetaAdSet({
          accessToken: connection.accessToken,
          adAccountId: connection.adAccountId,
          metaCampaignId,
          name: conjunto.name,
          campaignType: campaign.campaignType as CampaignTypeKey,
          dailyBudgetClp: conjunto.dailyBudgetClp ?? campaign.budgetAmountClp,
          startDate: campaign.startDate ?? undefined,
          pageId: connection.pageId,
          targeting: (conjunto.targetingJson as Record<string, unknown> | null) ?? null,
        });
        metaAdSetId = creado.id;
        await prisma.adSet.update({
          where: { id: conjunto.id },
          data: {
            metaAdSetId: creado.id,
            destinationType: creado.destinationType,
            status: "EN_META",
            errorMessage: null,
          },
        });
      }

      // Un conjunto sin anuncios definidos (campaña suelta) crea uno con la foto y
      // el copy aprobado de la campaña.
      const anuncios = conjunto.ads.length
        ? conjunto.ads
        : [await prisma.ad.create({ data: { adSetId: conjunto.id }, include: { copyVariant: true, creativeMedia: true } })];

      for (const anuncio of anuncios) {
        if (anuncio.status === "EN_META" && anuncio.metaAdId) continue; // ya creado

        const copy = anuncio.copyVariant ?? copyAprobadoCampana;
        const media = anuncio.creativeMedia ?? campaign.creativeMedia;

        const esCarrusel = campaign.adFormat === "CARRUSEL";
        const problemaCarrusel = esCarrusel ? validarCarrusel(campaign.carouselCards) : null;

        const falta: string[] = [];
        if (esCarrusel) {
          if (problemaCarrusel) falta.push(problemaCarrusel);
        } else if (!media) {
          falta.push("elegir la foto del anuncio");
        }
        if (!copy) falta.push("aprobar un copy");
        if (!connection.pageId) falta.push("vincular una Página de Facebook a la conexión");
        if (!config.creativoImplementado) {
          falta.push(`el anuncio para campañas de tipo "${config.label}" (aún no implementado)`);
        }

        if (falta.length > 0) {
          await prisma.ad.update({
            where: { id: anuncio.id },
            data: {
              status: "BORRADOR",
              errorMessage:
                `Campaña y conjunto creados en Meta. Para crear el anuncio falta: ${falta.join(", ")}. ` +
                `Cuando lo resuelvas, presiona “Crear el anuncio en Meta”.`,
            },
          });
          continue;
        }

        // Cada anuncio se maneja por separado: que uno falle no debe impedir que
        // los demás del mismo conjunto se creen.
        try {
          // En carrusel se sube una imagen por tarjeta; hashDeFoto() cachea, así que
          // una misma foto usada en varias tarjetas o anuncios se sube una sola vez.
          let imageHash: string | undefined;
          let tarjetas = null;

          if (esCarrusel) {
            tarjetas = [];
            for (const carta of campaign.carouselCards) {
              tarjetas.push({
                imageHash: await hashDeFoto(carta.media),
                headline: carta.headline,
                description: carta.description,
              });
            }
          } else {
            imageHash = await hashDeFoto(media!);
          }

          const creative = await createMetaAdCreative({
            accessToken: connection.accessToken,
            adAccountId: connection.adAccountId,
            name: `${conjunto.name} — Creativo`,
            campaignType: campaign.campaignType as CampaignTypeKey,
            pageId: connection.pageId!,
            imageHash,
            tarjetas,
            primaryText: copy!.primaryText,
            headline: copy!.headline,
            description: copy!.description,
            destinationUrl: campaign.destinationUrl,
            whatsappNumber: connection.whatsappBusinessAccountId,
            telefono: campaign.property?.agentPhone,
          });

          const creado = await createMetaAd({
            accessToken: connection.accessToken,
            adAccountId: connection.adAccountId,
            metaAdSetId,
            metaCreativeId: creative.id,
            name: `${conjunto.name} — Anuncio`,
          });

          await prisma.ad.update({
            where: { id: anuncio.id },
            data: {
              copyVariantId: copy!.id,
              creativeMediaId: esCarrusel ? null : media!.id,
              metaAdId: creado.id,
              metaCreativeId: creative.id,
              metaImageHash: imageHash ?? null,
              status: "EN_META",
              errorMessage: null,
            },
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Error desconocido creando el anuncio";
          console.error("Error creando anuncio en Meta:", err);
          await prisma.ad.update({
            where: { id: anuncio.id },
            data: { status: "ERROR", errorMessage: message },
          });
        }
      }
    }

    await prisma.campaign.update({
      where: { id: campaign.id },
      data: { status: "EN_META", errorMessage: null },
    });

    await registrarAuditoria({
      organizationId: organization.id,
      actor: { id: user.id, email: user.email },
      action: "CAMPANA_PUBLICADA",
      entityType: "Campaign",
      entityId: campaign.id,
      metadata: {
        metaCampaignId,
        nombre: campaign.name,
        presupuestoDiarioClp: campaign.budgetAmountClp,
        advertencias: hallazgos.filter((h) => h.severidad === "ADVIERTE").map((h) => h.codigo),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    console.error("Error publicando campaña en Meta:", err);
    await prisma.campaign.update({
      where: { id: campaign.id },
      data: { status: "ERROR", errorMessage: message },
    });
  }

  return volver();
}
