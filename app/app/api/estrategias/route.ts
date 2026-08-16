import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { resolveOrganizationForUser } from "@/lib/org";
import { getActiveMetaConnection } from "@/lib/meta-connection";
import {
  CAMPAIGN_TYPES,
  type CampaignTypeKey,
} from "@/lib/meta-campaign-types";
import {
  SEGMENTACION_POR_DEFECTO,
  construirTargeting,
  comoJson,
  requiereSpecialAdCategory,
  type ConfigSegmentacion,
} from "@/lib/meta-targeting";
import { planificarEstrategia, ANUNCIOS_POR_CONJUNTO } from "@/lib/estrategia";
import { generarCopys, PROMPT_VERSION } from "@/lib/copy-generator";
import { urlDeLaApp } from "@/lib/urls";

// Crea la estructura completa de una estrategia como BORRADOR. La cantidad de
// campañas y de conjuntos por campaña la decide lib/estrategia.ts según el
// presupuesto y la segmentación. Nada se envía a Meta todavía — eso ocurre al
// publicar cada campaña.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.redirect(urlDeLaApp("/login", request));

  const organization = await resolveOrganizationForUser(user);
  if (!organization)
    return new Response("No hay organización.", { status: 400 });

  const connection = await getActiveMetaConnection(organization.id);
  if (!connection)
    return new Response("No hay una conexión de Meta activa.", { status: 400 });

  const form = await request.formData();
  const name = String(form.get("name") ?? "").trim();
  const campaignType = String(
    form.get("campaignType") ?? "",
  ) as CampaignTypeKey;
  const destinationUrl =
    String(form.get("destinationUrl") ?? "").trim() || null;
  const monthlyBudgetClp = Number(form.get("monthlyBudgetClp"));
  // Puede venir una o varias propiedades: el formulario manda un campo repetido.
  // Se acepta también el nombre antiguo en singular por si queda algún enlace viejo.
  const idsPropiedades = [
    ...form.getAll("propertyIds").map((v) => String(v).trim()),
    ...form.getAll("propertyId").map((v) => String(v).trim()),
  ].filter(Boolean);

  const tipo = CAMPAIGN_TYPES[campaignType];
  if (
    !name ||
    !tipo ||
    !Number.isFinite(monthlyBudgetClp) ||
    monthlyBudgetClp <= 0
  ) {
    return new Response("Datos inválidos.", { status: 400 });
  }
  if (tipo.requiereUrl && !destinationUrl) {
    return new Response("Este tipo de campaña necesita una URL de destino.", {
      status: 400,
    });
  }

  // Una estrategia crea decenas de anuncios y todos necesitan imagen. Si no hay
  // propiedad con fotos, se rechaza acá en vez de generar una estructura completa
  // que después no se puede publicar (fue exactamente lo que pasó en la primera
  // prueba: 8 anuncios en borrador sin foto).
  if (idsPropiedades.length === 0) {
    return new Response(
      "Elige al menos una propiedad: cada anuncio necesita una foto.",
      {
        status: 400,
      },
    );
  }
  const propiedades = await prisma.property.findMany({
    where: { id: { in: idsPropiedades }, organizationId: organization.id },
    include: { media: { orderBy: { orden: "asc" } } },
  });
  if (propiedades.length !== new Set(idsPropiedades).size) {
    return new Response(
      "Alguna propiedad no existe o no es de tu inmobiliaria.",
      { status: 400 },
    );
  }
  const sinFotos = propiedades.filter((p) => p.media.length === 0);
  if (sinFotos.length > 0) {
    return new Response(
      `Sin fotos: ${sinFotos.map((p) => p.title).join(", ")}. Sube al menos una a cada propiedad antes de crear la estrategia.`,
      { status: 400 },
    );
  }

  let segmentacion: ConfigSegmentacion = SEGMENTACION_POR_DEFECTO;
  try {
    const raw = String(form.get("segmentacion") ?? "");
    if (raw) segmentacion = JSON.parse(raw) as ConfigSegmentacion;
  } catch {
    console.error(
      "Segmentación inválida en la estrategia; se usa la por defecto.",
    );
  }

  // Con varias propiedades el presupuesto se REPARTE entre ellas, y cada una recibe
  // el plan que corresponda a su parte. Si no se repartiera, N propiedades gastarían
  // N veces lo que el usuario dijo estar dispuesto a invertir.
  const presupuestoPorPropiedad = Math.floor(
    Math.round(monthlyBudgetClp) / propiedades.length,
  );
  const planPorPropiedad = propiedades.map((prop) => ({
    propiedad: prop,
    plan: planificarEstrategia(presupuestoPorPropiedad, segmentacion),
  }));

  // El nivel y el presupuesto de la estrategia son la suma de sus partes.
  const nivelMayor = Math.max(...planPorPropiedad.map((x) => x.plan.nivel));
  const presupuestoTotal = planPorPropiedad.reduce(
    (suma, x) => suma + x.plan.presupuestoMensualClp,
    0,
  );

  const strategy = await prisma.strategy.create({
    data: {
      organizationId: organization.id,
      // Con una sola propiedad se guarda el vínculo; con varias no hay una única
      // "propiedad de la estrategia" y cada campaña guarda la suya.
      propertyId: propiedades.length === 1 ? propiedades[0].id : null,
      name,
      monthlyBudgetClp: presupuestoTotal,
      nivel: nivelMayor,
      createdByUserId: user.id,
    },
  });

  for (const { propiedad: property, plan } of planPorPropiedad) {
    const fotos = property.media;

    // Los copys se generan por propiedad: el texto habla de ESA propiedad concreta.
    // Si falla la IA la estructura igual se crea, y el copy se escribe después.
    let copys: {
      primaryText: string;
      headline: string;
      description: string;
    }[] = [];
    try {
      copys = await generarCopys({
        propiedad: property,
        campaignType,
        cantidad: ANUNCIOS_POR_CONJUNTO,
      });
    } catch (err) {
      console.error(
        `No se pudieron generar copys para ${property.title}:`,
        err,
      );
    }

    for (let c = 0; c < plan.campanas; c++) {
      // Con varias propiedades el nombre lleva cuál es, si no serían indistinguibles
      // en Ads Manager.
      const prefijo =
        propiedades.length > 1 ? `${name} — ${property.title}` : name;
      const nombreCampana =
        plan.campanas > 1 ? `${prefijo} — Campaña ${c + 1}` : prefijo;

      const campaign = await prisma.campaign.create({
        data: {
          organizationId: organization.id,
          metaConnectionId: connection.id,
          strategyId: strategy.id,
          propertyId: property.id,
          creativeMediaId: fotos[0]?.id ?? null,
          name: nombreCampana,
          campaignType,
          destinationUrl: tipo.requiereUrl ? destinationUrl : null,
          objective: tipo.objective,
          budgetType: "DIARIO",
          budgetAmountClp: plan.presupuestoDiarioPorConjuntoClp,
          createdByUserId: user.id,
        },
      });

      // Los copys se guardan por campaña (así lo modela CopyVariant) y los anuncios
      // de sus conjuntos apuntan a ellos.
      const variantes = [];
      for (const [i, copy] of copys.entries()) {
        variantes.push(
          await prisma.copyVariant.create({
            data: {
              campaignId: campaign.id,
              primaryText: copy.primaryText,
              headline: copy.headline,
              description: copy.description,
              generatedBy: "IA",
              promptVersion: PROMPT_VERSION,
              // El primero queda aprobado para que la campaña sea publicable de inmediato.
              approved: i === 0,
            },
          }),
        );
      }

      for (let j = 0; j < plan.conjuntosPorCampana; j++) {
        // Cada conjunto toma su propia banda de edad, que no se solapa con las de
        // los demás: así los conjuntos de la campaña no compiten entre sí en la
        // subasta de Meta. Con un solo conjunto se usa el rango completo.
        const banda = plan.bandas?.[j];
        const segmentacionConjunto: ConfigSegmentacion = banda
          ? { ...segmentacion, edadMin: banda.edadMin, edadMax: banda.edadMax }
          : segmentacion;

        const sufijo = banda
          ? `${banda.edadMin}-${banda.edadMax} años`
          : "Audiencia completa";

        const adSet = await prisma.adSet.create({
          data: {
            campaignId: campaign.id,
            name: `${nombreCampana} — ${sufijo}`,
            dailyBudgetClp: plan.presupuestoDiarioPorConjuntoClp,
            targetingMode: segmentacionConjunto.modo,
            targetingJson: construirTargeting(segmentacionConjunto),
            targetingConfigJson: comoJson(segmentacionConjunto),
            specialAdCategoryActive:
              requiereSpecialAdCategory(segmentacionConjunto),
          },
        });

        for (let a = 0; a < ANUNCIOS_POR_CONJUNTO; a++) {
          await prisma.ad.create({
            data: {
              adSetId: adSet.id,
              // Se reparten copys y fotos en rotación: si hay menos de 4 se repiten,
              // que es preferible a dejar anuncios vacíos.
              copyVariantId: variantes.length
                ? variantes[a % variantes.length].id
                : null,
              creativeMediaId: fotos.length ? fotos[a % fotos.length].id : null,
            },
          });
        }
      }
    }
  }

  return Response.redirect(urlDeLaApp(`/estrategias/${strategy.id}`, request));
}
