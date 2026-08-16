import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Pause,
  Play,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { resolveOrganizationForUser } from "@/lib/org";
import { CAMPAIGN_TYPES, type CampaignTypeKey } from "@/lib/meta-campaign-types";
import {
  describirSegmentacion,
  paisesRestringidosIncluidos,
  type ConfigSegmentacion,
} from "@/lib/meta-targeting";
import { describirEstadoMeta } from "@/lib/meta-sync";
import { revisarCumplimiento, bloquea, ETIQUETA_NORMA } from "@/lib/cumplimiento";
import { FormatoPanel } from "./formato-panel";
import {
  urlCampanaEnMeta,
  urlConjuntoEnMeta,
  urlAnuncioEnMeta,
} from "@/lib/ads-manager";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SegmentacionPanel } from "@/app/components/segmentacion-panel";
import { AppShell, Aviso } from "@/app/components/app-shell";
import { CopysPanel } from "./copys-panel";

const COLOR_TONO: Record<string, string> = {
  ok: "text-emerald-400",
  aviso: "text-amber-400",
  malo: "text-destructive",
};

// Enlace que abre el objeto en Ads Manager, en otra pestaña. `noopener` evita que la
// página abierta pueda manipular la nuestra a través de window.opener.
function EnlaceMeta({ href, titulo }: { href: string; titulo: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={titulo}
      className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
    >
      <ExternalLink className="size-3" />
      Ver en Meta
    </a>
  );
}

// --- Vista fácil ---

// Traduce el estado de la campaña a una frase que entienda alguien que nunca ha
// creado un anuncio. El vocabulario de Meta (BORRADOR, PAUSED, PENDING_REVIEW) se
// queda en la vista avanzada.
function estadoEnPalabras(
  campaign: { status: string; effectiveStatus: string | null; budgetAmountClp: number },
  anuncio: { status: string } | undefined
): { texto: string; detalle: string; tono: "ok" | "aviso" | "neutro" } {
  if (campaign.status === "BORRADOR") {
    return {
      texto: "Todavía no está en Meta",
      detalle: "Lo tienes armado acá. Cuando lo publiques, queda pausado hasta que tú lo actives.",
      tono: "neutro",
    };
  }
  if (campaign.status === "ERROR") {
    return { texto: "Hubo un problema al publicarlo", detalle: "Revisa el detalle completo.", tono: "aviso" };
  }
  if (campaign.effectiveStatus === "ACTIVE") {
    return {
      texto: "Activo: se está mostrando",
      detalle: `Está gastando hasta $${campaign.budgetAmountClp.toLocaleString("es-CL")} por día.`,
      tono: "ok",
    };
  }
  if (campaign.effectiveStatus === "PENDING_REVIEW") {
    return { texto: "Meta lo está revisando", detalle: "Suele demorar menos de 24 horas.", tono: "aviso" };
  }
  if (campaign.effectiveStatus === "DISAPPROVED") {
    return { texto: "Meta lo rechazó", detalle: "Mira el detalle completo para ver el motivo.", tono: "aviso" };
  }
  if (anuncio?.status !== "EN_META") {
    return {
      texto: "Falta terminar el anuncio",
      detalle: "La campaña ya está en Meta, pero el anuncio todavía no. Revisa qué falta más abajo.",
      tono: "aviso",
    };
  }
  return {
    texto: "Listo y pausado",
    detalle: "Está creado en Meta pero no se muestra ni gasta nada hasta que lo actives.",
    tono: "ok",
  };
}

function ResumenFacil({
  campaign,
  anuncio,
}: {
  campaign: {
    status: string;
    effectiveStatus: string | null;
    budgetAmountClp: number;
    destinationUrl: string | null;
    campaignType: string;
    property: { id: string; title: string } | null;
  };
  anuncio: { status: string } | undefined;
}) {
  const estado = estadoEnPalabras(campaign, anuncio);
  const color =
    estado.tono === "ok" ? "text-emerald-400" : estado.tono === "aviso" ? "text-amber-400" : "";

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className={`text-lg font-medium ${color}`}>{estado.texto}</div>
      <p className="mt-1 text-sm text-muted-foreground">{estado.detalle}</p>

      <dl className="mt-4 grid gap-3 border-t border-border pt-4 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-xs text-muted-foreground">Presupuesto</dt>
          <dd className="mt-0.5 font-medium">
            ${campaign.budgetAmountClp.toLocaleString("es-CL")} por día
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Al hacer clic</dt>
          <dd className="mt-0.5 font-medium">
            {campaign.campaignType === "WHATSAPP"
              ? "Te escriben por WhatsApp"
              : campaign.campaignType === "LANDING_SITIO_WEB"
                ? "Van a tu página"
                : campaign.campaignType === "FORMULARIO_INSTANTANEO"
                  ? "Dejan sus datos"
                  : "Te mandan un mensaje"}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs text-muted-foreground">Propiedad</dt>
          <dd className="mt-0.5 truncate font-medium">
            {campaign.property ? (
              <Link href={`/propiedades/${campaign.property.id}`} className="hover:underline">
                {campaign.property.title}
              </Link>
            ) : (
              <span className="text-muted-foreground">Sin vincular</span>
            )}
          </dd>
        </div>
      </dl>
    </section>
  );
}

// El texto del anuncio en modo lectura. Editarlo, generar variantes y aprobarlas vive
// en la vista avanzada: en modo fácil el texto ya viene escrito por la IA.
function TextoDelAnuncio({
  campaignId,
  copy,
}: {
  campaignId: string;
  copy: { primaryText: string; headline: string; description: string | null } | null;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <h2 className="font-medium">Lo que va a decir tu anuncio</h2>
      {copy ? (
        <>
          <div className="mt-3 space-y-2 rounded-lg border border-border bg-background/40 p-4">
            <p className="text-sm">{copy.primaryText}</p>
            <p className="text-sm font-semibold">{copy.headline}</p>
            {copy.description && (
              <p className="text-xs text-muted-foreground">{copy.description}</p>
            )}
          </div>
          <Link
            href={`/campanas/${campaignId}?vista=avanzado`}
            className="mt-3 inline-block text-sm text-primary underline-offset-4 hover:underline"
          >
            Cambiar el texto
          </Link>
        </>
      ) : (
        <p className="mt-2 text-sm text-amber-400">
          Todavía no hay texto.{" "}
          <Link
            href={`/campanas/${campaignId}?vista=avanzado`}
            className="underline underline-offset-4"
          >
            Escríbelo o genéralo con IA
          </Link>
          .
        </p>
      )}
    </section>
  );
}

export default async function CampanaDetallePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ estado?: string; motivo?: string; sync?: string; vista?: string; creada?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const organization = await resolveOrganizationForUser(user);
  if (!organization) redirect("/conectar");

  const { id } = await params;
  const campaign = await prisma.campaign.findFirst({
    where: { id, organizationId: organization.id },
    include: {
      adSets: { include: { ads: true } },
      property: { include: { media: { orderBy: { orden: "asc" } } } },
      creativeMedia: true,
      metaConnection: { select: { adAccountId: true } },
      carouselCards: { include: { media: true }, orderBy: { orden: "asc" } },
      copyVariants: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!campaign) notFound();

  const adSet = campaign.adSets[0];
  const anuncio = adSet?.ads[0];
  const tipoConfig = CAMPAIGN_TYPES[campaign.campaignType as CampaignTypeKey];
  const segmentacion = (adSet?.targetingConfigJson ?? null) as ConfigSegmentacion | null;

  const { estado: resultadoEstado, motivo, sync, vista, creada } = await searchParams;

  // Dos vistas del mismo detalle. La fácil es la de por defecto: la app está pensada
  // para gente que nunca ha creado un anuncio, y la vista completa abruma. Se guarda
  // en la URL (no en estado del cliente) para que el enlace se pueda compartir.
  const avanzado = vista === "avanzado";
  const estadoMeta = describirEstadoMeta(campaign.effectiveStatus);
  const cuentaMeta = campaign.metaConnection?.adAccountId ?? "";

  // Revisión de cumplimiento (M9). Se calcula al vuelo para que el usuario vea qué
  // le falta ANTES de apretar publicar, no después del rechazo.
  const hallazgos = revisarCumplimiento({
    campaignType: campaign.campaignType as CampaignTypeKey,
    destinationUrl: campaign.destinationUrl,
    tieneImagen: Boolean(
      campaign.creativeMedia ?? campaign.adSets.some((s) => s.ads.some((a) => a.creativeMediaId))
    ),
    adFormat: campaign.adFormat,
    tarjetasCarrusel: campaign.carouselCards.length,
    textosCarrusel: campaign.carouselCards.flatMap((c) => [c.headline ?? "", c.description ?? ""]),
    copyAprobado: campaign.copyVariants.find((c) => c.approved) ?? null,
    propiedad: campaign.property
      ? { price: campaign.property.price, currency: campaign.property.currency }
      : null,
    specialAdCategoryActive: campaign.adSets.some((s) => s.specialAdCategoryActive),
    paisesRestringidos: segmentacion ? paisesRestringidosIncluidos(segmentacion) : [],
    privacyPolicyUrl: organization.privacyPolicyUrl,
  });
  const noPublicable = bloquea(hallazgos);

  return (
    <AppShell
      titulo={campaign.name}
      descripcion={`${tipoConfig?.label ?? campaign.campaignType} · ${campaign.objective}`}
      usuario={user}
      activo="/campanas"
      acciones={
        <Link
          href={campaign.strategyId ? `/estrategias/${campaign.strategyId}` : "/campanas"}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          <ArrowLeft className="size-4" />
          Volver
        </Link>
      }
    >
      <div className="max-w-3xl space-y-6">
        {resultadoEstado === "activada" && (
          <Aviso tono="ok">Campaña activada en Meta. Ya está gastando presupuesto.</Aviso>
        )}
        {resultadoEstado === "pausada" && <Aviso tono="ok">Campaña pausada en Meta.</Aviso>}
        {resultadoEstado === "error" && <Aviso tono="error">No se pudo cambiar el estado: {motivo}</Aviso>}
        {sync === "ok" && <Aviso tono="ok">Estado sincronizado con Meta.</Aviso>}
        {sync === "error" && <Aviso tono="error">Error sincronizando: {motivo}</Aviso>}
        {creada === "simple" && (
          <Aviso tono="ok">
            Tu anuncio está armado. Revísalo acá abajo y, cuando estés listo, publícalo.
          </Aviso>
        )}

        {/* Selector de vista */}
        <div className="inline-flex rounded-lg border border-border bg-card p-1 text-sm">
          <Link
            href={`/campanas/${campaign.id}`}
            className={`rounded-md px-3 py-1.5 transition-colors ${
              avanzado ? "text-muted-foreground hover:text-foreground" : "bg-primary text-primary-foreground"
            }`}
          >
            Vista fácil
          </Link>
          <Link
            href={`/campanas/${campaign.id}?vista=avanzado`}
            className={`rounded-md px-3 py-1.5 transition-colors ${
              avanzado ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Todo el detalle
          </Link>
        </div>

        {/* Resumen técnico */}
        {avanzado && (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="text-xs text-muted-foreground">Estado en la app</div>
            <div className="mt-1 font-medium">{campaign.status}</div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="text-xs text-muted-foreground">Presupuesto</div>
            <div className="mt-1 bg-gradient-to-br from-foreground to-primary bg-clip-text font-medium text-transparent">
              ${campaign.budgetAmountClp.toLocaleString("es-CL")}/día
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="text-xs text-muted-foreground">Propiedad</div>
            <div className="mt-1 truncate font-medium">
              {campaign.property ? (
                <Link href={`/propiedades/${campaign.property.id}`} className="hover:underline">
                  {campaign.property.title}
                </Link>
              ) : (
                <span className="text-muted-foreground">Sin vincular</span>
              )}
            </div>
          </div>
        </div>
        )}

        {avanzado && campaign.destinationUrl && (
          <p className="text-sm">
            <span className="text-muted-foreground">Destino: </span>
            <a href={campaign.destinationUrl} className="underline underline-offset-4">
              {campaign.destinationUrl}
            </a>
          </p>
        )}

        {/* --- Vista fácil: el estado en palabras, sin jerga --- */}
        {!avanzado && <ResumenFacil campaign={campaign} anuncio={anuncio} />}

        {/* Estado real en Meta (M10) */}
        {avanzado && campaign.metaCampaignId && (
          <section className="rounded-xl border border-border bg-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-xs text-muted-foreground">Estado en Meta</div>
                <div className={`mt-1 font-medium ${COLOR_TONO[estadoMeta.tono] ?? ""}`}>
                  {estadoMeta.texto}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {campaign.lastSyncedAt
                    ? `Sincronizado: ${campaign.lastSyncedAt.toLocaleString("es-CL")}`
                    : "Nunca sincronizado"}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <form method="POST" action="/api/meta/sincronizar">
                  <Button type="submit" variant="outline" size="sm">
                    <RefreshCw className="size-4" />
                    Sincronizar
                  </Button>
                </form>
                {campaign.effectiveStatus === "ACTIVE" ? (
                  <form method="POST" action={`/api/campanas/${campaign.id}/estado`}>
                    <input type="hidden" name="accion" value="pausar" />
                    <Button type="submit" variant="secondary" size="sm">
                      <Pause className="size-4" />
                      Pausar
                    </Button>
                  </form>
                ) : (
                  <Link
                    href={`/campanas/${campaign.id}/activar`}
                    className={buttonVariants({ variant: "destructive", size: "sm" })}
                  >
                    <Play className="size-4" />
                    Activar (gasta dinero)
                  </Link>
                )}
              </div>
            </div>

            {/* Enlaces directos a Ads Manager. Buscar el objeto a mano es difícil: la
                vista filtra por fecha (por defecto hasta ayer, así que lo creado hoy
                no aparece) y cada tipo de objeto vive en su propia pestaña. */}
            <dl className="mt-4 grid gap-2 border-t border-border pt-4 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <dt className="text-muted-foreground">Campaña:</dt>
                <dd className="font-mono">{campaign.metaCampaignId}</dd>
                <EnlaceMeta
                  href={urlCampanaEnMeta(cuentaMeta, campaign.metaCampaignId)}
                  titulo="Abrir la campaña en Ads Manager"
                />
              </div>
              {adSet?.metaAdSetId && (
                <div className="flex flex-wrap items-center gap-2">
                  <dt className="text-muted-foreground">Conjunto:</dt>
                  <dd className="font-mono">{adSet.metaAdSetId}</dd>
                  <EnlaceMeta
                    href={urlConjuntoEnMeta(cuentaMeta, adSet.metaAdSetId)}
                    titulo="Abrir el conjunto en Ads Manager"
                  />
                  {adSet.destinationType && <Badge variant="outline">{adSet.destinationType}</Badge>}
                </div>
              )}
            </dl>

            {/* Los anuncios son los que Meta rechaza, no la campaña. */}
            {campaign.adSets.flatMap((s) => s.ads).some((a) => a.metaAdId) && (
              <ul className="mt-3 space-y-1 border-t border-border pt-3 text-sm">
                {campaign.adSets.flatMap((s) =>
                  s.ads
                    .filter((a) => a.metaAdId)
                    .map((a) => {
                      const est = describirEstadoMeta(a.effectiveStatus);
                      return (
                        <li key={a.id} className="flex flex-wrap items-center gap-2">
                          <span className={COLOR_TONO[est.tono] ?? ""}>{est.texto}</span>
                          <span className="font-mono text-xs text-muted-foreground">
                            Anuncio: {a.metaAdId}
                          </span>
                          <EnlaceMeta
                            href={urlAnuncioEnMeta(cuentaMeta, a.metaAdId!)}
                            titulo="Abrir el anuncio en Ads Manager"
                          />
                          {a.issuesInfo != null && (
                            <div className="text-xs text-destructive">
                              Meta reporta: {JSON.stringify(a.issuesInfo)}
                            </div>
                          )}
                        </li>
                      );
                    })
                )}
              </ul>
            )}
          </section>
        )}

        {/* Segmentación (M6) */}
        {avanzado && (
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="font-medium">Segmentación</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {segmentacion ? describirSegmentacion(segmentacion) : "Chile · 18-65 años (por defecto)"}
          </p>

          {campaign.status === "EN_META" && (
            <p className="mt-3 text-xs text-amber-400">
              El conjunto ya existe en Meta. Cambiar la segmentación acá queda guardado, pero no
              modifica el conjunto ya creado.
            </p>
          )}

          <details className="mt-3">
            <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
              Cambiar segmentación
            </summary>
            <form
              method="POST"
              action={`/api/campanas/${campaign.id}/segmentacion`}
              className="mt-4 space-y-4"
            >
              <SegmentacionPanel
                valorInicial={segmentacion}
                mostrarRecomendados
                propertyId={campaign.propertyId}
              />
              <Button type="submit" size="sm">
                Guardar segmentación
              </Button>
            </form>
          </details>
        </section>
        )}

        {/* Formato del anuncio: imagen única o carrusel (M8).
            Se muestra en las dos vistas: elegir las fotos y el formato es
            justamente lo que hace el modo fácil. */}
        {campaign.property && (
          <FormatoPanel
            campaignId={campaign.id}
            propertyId={campaign.property.id}
            fotos={campaign.property.media.map((f) => ({ id: f.id, url: f.url }))}
            formatoInicial={campaign.adFormat}
            creativeMediaIdInicial={campaign.creativeMediaId}
            tarjetasIniciales={campaign.carouselCards.map((c) => ({
              propertyMediaId: c.propertyMediaId,
              headline: c.headline ?? "",
              description: c.description ?? "",
            }))}
          />
        )}

        {/* Revisión de cumplimiento (M9) */}
        <section
          className={`rounded-xl border bg-card p-5 ${
            noPublicable
              ? "border-destructive/40"
              : hallazgos.length
                ? "border-amber-500/40"
                : "border-emerald-500/40"
          }`}
        >
          <div className="flex items-center gap-2">
            {noPublicable || hallazgos.length ? (
              <ShieldAlert
                className={`size-4 ${noPublicable ? "text-destructive" : "text-amber-400"}`}
              />
            ) : (
              <ShieldCheck className="size-4 text-emerald-400" />
            )}
            <h2 className="font-medium">Revisión de cumplimiento</h2>
          </div>

          {hallazgos.length === 0 ? (
            <p className="mt-2 text-sm text-emerald-400">
              Sin observaciones. Cumple las normas de Meta y la normativa chilena que revisamos.
            </p>
          ) : (
            <>
              <p className={`mt-2 text-sm ${noPublicable ? "text-destructive" : "text-amber-400"}`}>
                {noPublicable
                  ? "Hay problemas que impiden publicar:"
                  : "Se puede publicar, pero conviene revisar:"}
              </p>
              <ul className="mt-3 space-y-3">
                {hallazgos.map((h) => (
                  <li key={h.codigo} className="text-sm">
                    <span className={h.severidad === "BLOQUEA" ? "text-destructive" : "text-amber-400"}>
                      {h.mensaje}
                    </span>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {h.comoCorregir} <em>({ETIQUETA_NORMA[h.norma]})</em>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}

          <p className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">
            Esta revisión reduce riesgos pero no los elimina: Meta aplica su propio criterio y puede
            rechazar contenido que acá pase. No sustituye la revisión de un abogado.
          </p>
        </section>

        {campaign.status === "ERROR" && (
          <Aviso tono="error">Meta rechazó la creación: {campaign.errorMessage}</Aviso>
        )}

        {campaign.status === "EN_META" && anuncio?.status === "EN_META" && (
          <Aviso tono="ok">
            <span className="inline-flex items-center gap-2">
              <CheckCircle2 className="size-4" />
              Anuncio creado y pausado en Meta.
            </span>
          </Aviso>
        )}
        {campaign.status === "EN_META" && anuncio?.status === "BORRADOR" && (
          <Aviso tono="aviso">{anuncio.errorMessage}</Aviso>
        )}
        {campaign.status === "EN_META" && anuncio?.status === "ERROR" && (
          <Aviso tono="error">No se pudo crear el anuncio: {anuncio.errorMessage}</Aviso>
        )}

        {/* Acciones de publicación */}
        {campaign.status === "BORRADOR" && (
          <form method="POST" action={`/api/campanas/${campaign.id}/publicar`}>
            <Button type="submit" disabled={noPublicable} className="h-10">
              {noPublicable ? "Corrige lo anterior para publicar" : "Publicar en Meta (queda pausada)"}
            </Button>
          </form>
        )}

        {campaign.status === "ERROR" && (
          <form method="POST" action={`/api/campanas/${campaign.id}/publicar`}>
            <Button type="submit" variant="outline" className="h-10">
              Reintentar
            </Button>
          </form>
        )}

        {campaign.status === "EN_META" && anuncio?.status !== "EN_META" && (
          <form method="POST" action={`/api/campanas/${campaign.id}/publicar`}>
            <Button type="submit" className="h-10">
              Crear el anuncio en Meta
            </Button>
          </form>
        )}

        {avanzado ? (
          <CopysPanel campaignId={campaign.id} variantes={campaign.copyVariants} />
        ) : (
          <TextoDelAnuncio campaignId={campaign.id} copy={campaign.copyVariants.find((c) => c.approved) ?? null} />
        )}

        {avanzado && (
        <div className="border-t border-border pt-6">
          <Link
            href={`/campanas/${campaign.id}/borrar`}
            className="inline-flex items-center gap-1.5 text-sm text-destructive hover:underline"
          >
            <Trash2 className="size-4" />
            Borrar esta campaña
          </Link>
        </div>
        )}
      </div>
    </AppShell>
  );
}
