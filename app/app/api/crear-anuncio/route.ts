import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { resolveOrganizationForUser } from "@/lib/org";
import { CAMPAIGN_TYPES, validarRequisitos } from "@/lib/meta-campaign-types";
import {
  construirTargeting,
  requiereSpecialAdCategory,
  type ConfigSegmentacion,
} from "@/lib/meta-targeting";
import { generarCopys, generarTextosCarrusel, PROMPT_VERSION } from "@/lib/copy-generator";
import { miniaturaParaIA } from "@/lib/miniatura";
import { MAX_TARJETAS, validarCarrusel } from "@/lib/carrusel";
import {
  SEGMENTACION_SIMPLE,
  MINIMO_DIARIO_CLP,
  esDestinoSimple,
  nombreAutomatico,
  tipoDeCampana,
} from "@/lib/modo-simple";

// Prisma guarda la segmentación en columnas JSON; hay que pasarla por JSON.parse/stringify
// para que el tipo calce con el que espera el cliente.
function comoJson(config: ConfigSegmentacion) {
  return JSON.parse(JSON.stringify(config));
}

// Crea un anuncio completo desde el modo simple: campaña, conjunto de anuncios,
// copy generado con IA y —si es carrusel— las tarjetas con sus textos.
//
// Todo queda en BORRADOR local: nada se manda a Meta acá. El usuario revisa el
// resultado y recién después presiona "Publicar", que además deja la campaña PAUSADA
// en Meta (regla del proyecto: nunca se activa nada sin confirmación explícita).
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "No autorizado" }, { status: 401 });

  const organization = await resolveOrganizationForUser(user);
  if (!organization) return Response.json({ error: "No hay organización" }, { status: 400 });

  const connection = await prisma.metaConnection.findFirst({
    where: { organizationId: organization.id, status: "ACTIVA" },
  });
  if (!connection) {
    return Response.json(
      { error: "Primero tienes que conectar tu cuenta de Meta en “Conexión Meta”." },
      { status: 400 }
    );
  }

  let cuerpo: {
    propertyId?: string;
    destino?: string;
    destinationUrl?: string;
    budgetAmountClp?: number;
    adFormat?: string;
  };
  try {
    cuerpo = await request.json();
  } catch {
    return Response.json({ error: "Petición inválida" }, { status: 400 });
  }

  // --- Validaciones en el servidor. El navegador ya avisa, pero es manipulable ---
  const destino = String(cuerpo.destino ?? "");
  if (!esDestinoSimple(destino)) {
    return Response.json({ error: "Elige dónde quieres que te contacten." }, { status: 400 });
  }
  const campaignType = tipoDeCampana(destino);
  const config = CAMPAIGN_TYPES[campaignType];

  const property = await prisma.property.findFirst({
    where: { id: String(cuerpo.propertyId ?? ""), organizationId: organization.id },
    include: { media: { orderBy: { orden: "asc" } } },
  });
  if (!property) return Response.json({ error: "Elige una propiedad." }, { status: 400 });
  if (property.media.length === 0) {
    return Response.json({ error: "Sube al menos una foto de la propiedad." }, { status: 400 });
  }

  const presupuesto = Math.round(Number(cuerpo.budgetAmountClp ?? 0));
  if (!Number.isFinite(presupuesto) || presupuesto < MINIMO_DIARIO_CLP) {
    return Response.json(
      { error: `El presupuesto diario mínimo es $${MINIMO_DIARIO_CLP.toLocaleString("es-CL")}.` },
      { status: 400 }
    );
  }

  const esCarrusel = cuerpo.adFormat === "CARRUSEL";
  const fotosCarrusel = property.media.slice(0, MAX_TARJETAS);
  if (esCarrusel) {
    const problema = validarCarrusel(fotosCarrusel);
    if (problema) return Response.json({ error: problema }, { status: 400 });
  }

  const destinationUrl = config.requiereUrl ? String(cuerpo.destinationUrl ?? "").trim() : null;

  // Requisitos del tipo de campaña (URL, Página, WhatsApp). Se revisan ANTES de crear
  // nada: es lo que se aprendió al implementar estrategias, donde se creaban decenas
  // de objetos que después resultaban impublicables.
  const faltantes = validarRequisitos(campaignType, {
    destinationUrl,
    pageId: connection.pageId,
    whatsappBusinessAccountId: connection.whatsappBusinessAccountId,
    instagramActorId: connection.instagramActorId,
    telefono: property.agentPhone,
  });
  if (faltantes.length > 0) {
    return Response.json({ error: `Falta ${faltantes.join(", ")}.` }, { status: 400 });
  }

  // --- Copy con IA. Si falla, la campaña igual se crea sin copy: es recuperable
  //     desde el detalle, y perder toda la estructura sería peor. ---
  let copy: { primaryText: string; headline: string; description: string } | null = null;
  let avisoCopy: string | null = null;
  try {
    const variantes = await generarCopys({ propiedad: property, campaignType, cantidad: 1 });
    copy = variantes[0] ?? null;
  } catch (err) {
    avisoCopy =
      err instanceof Error
        ? `No se pudo generar el texto con IA (${err.message}). Puedes escribirlo a mano en el detalle.`
        : "No se pudo generar el texto con IA.";
  }

  // --- Textos de las tarjetas del carrusel, también con IA ---
  let textosTarjetas: { headline: string; description: string }[] = [];
  if (esCarrusel) {
    try {
      const imagenes = await Promise.all(
        fotosCarrusel.map((f) => miniaturaParaIA(f.pathname, f.url))
      );
      textosTarjetas = await generarTextosCarrusel({ propiedad: property, campaignType, imagenes });
    } catch (err) {
      console.error("No se pudieron generar los textos de las tarjetas:", err);
      // Las tarjetas se crean igual, sin título: Meta usa el copy de la campaña.
    }
  }

  // --- Creación. Todo junto para no dejar una campaña a medio armar ---
  const campaign = await prisma.campaign.create({
    data: {
      organizationId: organization.id,
      metaConnectionId: connection.id,
      propertyId: property.id,
      name: nombreAutomatico(property.title),
      campaignType,
      destinationUrl,
      objective: config.objective,
      budgetType: "DIARIO",
      budgetAmountClp: presupuesto,
      createdByUserId: user.id,
      adFormat: esCarrusel ? "CARRUSEL" : "IMAGEN_UNICA",
      // En imagen única se usa la primera foto: es la portada que el usuario ya
      // ordenó en la ficha de la propiedad.
      creativeMediaId: esCarrusel ? null : property.media[0].id,
      carouselCards: esCarrusel
        ? {
            create: fotosCarrusel.map((f, i) => ({
              propertyMediaId: f.id,
              orden: i,
              headline: textosTarjetas[i]?.headline || null,
              description: textosTarjetas[i]?.description || null,
            })),
          }
        : undefined,
      adSets: {
        create: {
          name: `${nombreAutomatico(property.title)} — Conjunto`,
          targetingMode: SEGMENTACION_SIMPLE.modo,
          targetingJson: construirTargeting(SEGMENTACION_SIMPLE),
          targetingConfigJson: comoJson(SEGMENTACION_SIMPLE),
          specialAdCategoryActive: requiereSpecialAdCategory(SEGMENTACION_SIMPLE),
        },
      },
      copyVariants: copy
        ? {
            create: {
              primaryText: copy.primaryText,
              headline: copy.headline,
              description: copy.description,
              generatedBy: "IA",
              promptVersion: PROMPT_VERSION,
              // Se aprueba sola porque en modo simple no hay pantalla de aprobación.
              // El usuario la ve y la puede editar en el paso siguiente.
              approved: true,
            },
          }
        : undefined,
    },
  });

  return Response.json({ campaignId: campaign.id, aviso: avisoCopy });
}
