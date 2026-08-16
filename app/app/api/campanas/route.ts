import { prisma } from "@/lib/prisma";
import { MAX_TARJETAS, validarCarrusel } from "@/lib/carrusel";
import { getCurrentUser } from "@/lib/session";
import { resolveOrganizationForUser } from "@/lib/org";
import { getActiveMetaConnection } from "@/lib/meta-connection";
import { CAMPAIGN_TYPES, type CampaignTypeKey } from "@/lib/meta-campaign-types";
import { copyEsValido } from "@/lib/copy-limits";
import { PROMPT_VERSION } from "@/lib/copy-generator";
import {
  SEGMENTACION_POR_DEFECTO,
  construirTargeting,
  comoJson,
  requiereSpecialAdCategory,
  type ConfigSegmentacion,
} from "@/lib/meta-targeting";
import { urlDeLaApp } from "@/lib/urls";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.redirect(urlDeLaApp("/login", request));

  const organization = await resolveOrganizationForUser(user);
  if (!organization) return new Response("No hay organización.", { status: 400 });

  const connection = await getActiveMetaConnection(organization.id);
  if (!connection) return new Response("No hay una conexión de Meta activa.", { status: 400 });

  const form = await request.formData();
  const name = String(form.get("name") ?? "").trim();
  const campaignType = String(form.get("campaignType") ?? "") as CampaignTypeKey;
  const destinationUrl = String(form.get("destinationUrl") ?? "").trim() || null;
  const budgetAmountClp = Number(form.get("budgetAmountClp"));
  const startDateRaw = String(form.get("startDate") ?? "");
  // Puede venir una, varias o ninguna. Con varias se crea una campaña por propiedad.
  const idsPropiedades = [
    ...form.getAll("propertyIds").map((v) => String(v).trim()),
    ...form.getAll("propertyId").map((v) => String(v).trim()),
  ].filter(Boolean);

  const config = CAMPAIGN_TYPES[campaignType];
  if (!name || !config || !Number.isFinite(budgetAmountClp) || budgetAmountClp < 1000) {
    return new Response("Datos inválidos.", { status: 400 });
  }
  if (config.requiereUrl && !destinationUrl) {
    return new Response("Este tipo de campaña necesita una URL de destino.", { status: 400 });
  }

  // Las propiedades elegidas deben ser de esta inmobiliaria.
  const propiedades = idsPropiedades.length
    ? await prisma.property.findMany({
        where: { id: { in: idsPropiedades }, organizationId: organization.id },
        include: { media: { orderBy: { orden: "asc" } } },
      })
    : [];
  if (propiedades.length !== new Set(idsPropiedades).size) {
    return new Response("Alguna propiedad no existe o no es de tu inmobiliaria.", { status: 400 });
  }

  // Segmentación: es la misma para todas las campañas que se creen.
  let segmentacion: ConfigSegmentacion = SEGMENTACION_POR_DEFECTO;
  const segmentacionRaw = String(form.get("segmentacion") ?? "");
  if (segmentacionRaw) {
    try {
      segmentacion = JSON.parse(segmentacionRaw) as ConfigSegmentacion;
    } catch {
      // Si llega malformada se usa el default en vez de fallar la creación entera.
      console.error("Segmentación inválida recibida; se usa la por defecto.");
    }
  }

  const esCarrusel = String(form.get("adFormat") ?? "") === "CARRUSEL";
  const creativeMediaIdRaw = String(form.get("creativeMediaId") ?? "").trim();
  const primaryText = String(form.get("primaryText") ?? "").trim();
  const headline = String(form.get("headline") ?? "").trim();
  const hayCopy = Boolean(primaryText && headline && copyEsValido({ primaryText, headline }));

  // Con varias propiedades se crea una campaña por cada una: mismo tipo, mismo
  // presupuesto y misma segmentación, pero cada una con SUS fotos. Sin propiedad se
  // crea una sola campaña sin vínculo. `[null]` hace que el bucle corra una vez.
  const objetivos: (typeof propiedades)[number][] | [null] = propiedades.length
    ? propiedades
    : [null];

  let primeraCampanaId: string | null = null;

  for (const property of objetivos) {
    const fotos = property?.media ?? [];

    // La foto del creativo solo aplica cuando el usuario eligió UNA propiedad; con
    // varias, cada campaña usa la portada de la suya.
    let creativeMediaId: string | null = null;
    if (property) {
      if (propiedades.length === 1 && creativeMediaIdRaw) {
        const media = fotos.find((f) => f.id === creativeMediaIdRaw);
        if (!media) return new Response("Foto inválida.", { status: 400 });
        creativeMediaId = media.id;
      } else {
        creativeMediaId = fotos[0]?.id ?? null;
      }
    }

    let fotosCarrusel: { id: string }[] = [];
    if (esCarrusel && property) {
      fotosCarrusel = fotos.slice(0, MAX_TARJETAS);
      const problema = validarCarrusel(fotosCarrusel);
      if (problema) {
        return new Response(`${property.title}: ${problema}`, { status: 400 });
      }
    }

    // Con varias propiedades el nombre lleva cuál es; si no, serían indistinguibles
    // en Ads Manager.
    const nombreCampana = propiedades.length > 1 ? `${name} — ${property!.title}` : name;

    const campaign = await prisma.campaign.create({
      data: {
        organizationId: organization.id,
        metaConnectionId: connection.id,
        propertyId: property?.id ?? null,
        adFormat: esCarrusel ? "CARRUSEL" : "IMAGEN_UNICA",
        creativeMediaId: esCarrusel ? null : creativeMediaId,
        carouselCards: esCarrusel
          ? { create: fotosCarrusel.map((f, i) => ({ propertyMediaId: f.id, orden: i })) }
          : undefined,
        name: nombreCampana,
        campaignType,
        destinationUrl: config.requiereUrl ? destinationUrl : null,
        // El objetivo no lo elige el usuario: se deriva del tipo de campaña (M5).
        objective: config.objective,
        budgetType: "DIARIO",
        budgetAmountClp: Math.round(budgetAmountClp),
        startDate: startDateRaw ? new Date(startDateRaw) : null,
        createdByUserId: user.id,
        // El conjunto se crea ya como borrador, con la segmentación elegida. Al
        // publicar (M3) solo se le agrega el ID que devuelve Meta.
        adSets: {
          create: {
            name: `${nombreCampana} — Conjunto`,
            targetingMode: segmentacion.modo,
            targetingJson: construirTargeting(segmentacion),
            targetingConfigJson: comoJson(segmentacion),
            specialAdCategoryActive: requiereSpecialAdCategory(segmentacion),
          },
        },
        // El copy escrito en el wizard describe una propiedad concreta, así que solo
        // se copia cuando hay una sola. Con varias, cada campaña genera el suyo desde
        // su detalle.
        copyVariants:
          hayCopy && propiedades.length <= 1
            ? {
                create: {
                  primaryText,
                  headline,
                  description: String(form.get("description") ?? "").trim() || null,
                  generatedBy: "IA",
                  promptVersion: PROMPT_VERSION,
                  approved: true,
                },
              }
            : undefined,
      },
    });

    primeraCampanaId ??= campaign.id;
  }

  // Con varias campañas se vuelve al listado; con una, a su detalle.
  if (propiedades.length > 1) {
    return Response.redirect(urlDeLaApp("/campanas", request));
  }
  return Response.redirect(urlDeLaApp(`/campanas/${primeraCampanaId}`, request));
}
