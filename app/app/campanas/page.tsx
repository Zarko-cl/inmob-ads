import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Activity,
  Megaphone,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { resolveOrganizationForUser } from "@/lib/org";
import { describirEstadoMeta, UMBRAL_AVISO_API } from "@/lib/meta-sync";
import { revisarCumplimiento, bloquea } from "@/lib/cumplimiento";
import { paisesRestringidosIncluidos, type ConfigSegmentacion } from "@/lib/meta-targeting";
import { type CampaignTypeKey } from "@/lib/meta-campaign-types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AppShell, Aviso } from "@/app/components/app-shell";
import { OpcionesCrear } from "./opciones-crear";

const COLOR_TONO: Record<string, string> = {
  ok: "text-emerald-400",
  aviso: "text-amber-400",
  malo: "text-destructive",
};

// Datos mínimos que necesita revisarCumplimiento() para una campaña de la lista.
type CampanaParaRevision = {
  campaignType: string;
  destinationUrl: string | null;
  creativeMediaId: string | null;
  adFormat: string;
  carouselCards: { id: string; headline: string | null; description: string | null }[];
  property: { price: number; currency: string } | null;
  adSets: {
    specialAdCategoryActive: boolean;
    targetingConfigJson: unknown;
    ads: { creativeMediaId: string | null }[];
  }[];
  copyVariants: { primaryText: string; headline: string; description: string | null }[];
};

// Devuelve cuántos problemas tiene la campaña y si impiden publicar.
function estadoCumplimiento(campana: CampanaParaRevision, privacyPolicyUrl: string | null) {
  const segmentacion = (campana.adSets[0]?.targetingConfigJson ?? null) as ConfigSegmentacion | null;
  const hallazgos = revisarCumplimiento({
    campaignType: campana.campaignType as CampaignTypeKey,
    destinationUrl: campana.destinationUrl,
    tieneImagen: Boolean(
      campana.creativeMediaId ?? campana.adSets.some((s) => s.ads.some((a) => a.creativeMediaId))
    ),
    adFormat: campana.adFormat as "IMAGEN_UNICA" | "CARRUSEL",
    tarjetasCarrusel: campana.carouselCards.length,
    textosCarrusel: campana.carouselCards.flatMap((c) => [c.headline ?? "", c.description ?? ""]),
    copyAprobado: campana.copyVariants[0] ?? null,
    propiedad: campana.property,
    specialAdCategoryActive: campana.adSets.some((s) => s.specialAdCategoryActive),
    paisesRestringidos: segmentacion ? paisesRestringidosIncluidos(segmentacion) : [],
    privacyPolicyUrl,
  });
  return { total: hallazgos.length, bloquea: bloquea(hallazgos) };
}

export default async function CampanasPage({
  searchParams,
}: {
  searchParams: Promise<{ sync?: string; motivo?: string; borrado?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const organization = await resolveOrganizationForUser(user);
  if (!organization) redirect("/conectar");

  const { sync, motivo, borrado } = await searchParams;

  const conexion = await prisma.metaConnection.findFirst({
    where: { organizationId: organization.id, status: "ACTIVA" },
  });

  // Las campañas que nacieron de una estrategia se listan bajo su estrategia, no
  // sueltas, para no llenar la lista con 4 campañas que son una sola cosa.
  // Se traen los datos que necesita la revisión de cumplimiento (M9) para poder
  // mostrar de un vistazo cuáles están listas para publicar.
  const incluirParaRevision = {
    property: { select: { price: true, currency: true } },
    carouselCards: { select: { id: true, headline: true, description: true } },
    adSets: {
      select: {
        specialAdCategoryActive: true,
        targetingConfigJson: true,
        ads: { select: { creativeMediaId: true } },
      },
    },
    copyVariants: {
      where: { approved: true },
      select: { primaryText: true, headline: true, description: true },
    },
  };

  const campanas = await prisma.campaign.findMany({
    where: { organizationId: organization.id, strategyId: null },
    orderBy: { createdAt: "desc" },
    include: incluirParaRevision,
  });

  const estrategias = await prisma.strategy.findMany({
    where: { organizationId: organization.id },
    orderBy: { createdAt: "desc" },
    include: { campaigns: { include: incluirParaRevision } },
  });

  return (
    <AppShell
      titulo="Campañas"
      descripcion={organization.name}
      usuario={user}
      activo="/campanas"
    >
      <div className="space-y-8">
        {borrado && <Aviso tono="ok">Se borró “{borrado}”.</Aviso>}
        {sync === "ok" && <Aviso tono="ok">Estados sincronizados con Meta.</Aviso>}
        {sync === "error" && <Aviso tono="error">Error sincronizando: {motivo}</Aviso>}

        <OpcionesCrear />

        {/* Cuota de la API (M10): el plan pide actuar entre 70-80% de uso. */}
        {conexion && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3">
            <div className="text-sm text-muted-foreground">
              {conexion.apiUsageAt ? (
                <>
                  <span className="inline-flex flex-wrap items-center gap-2">
                    <Activity className="size-4" />
                    Uso de la API de Meta:
                    <strong
                      className={
                        (conexion.apiUsagePercent ?? 0) >= UMBRAL_AVISO_API
                          ? "text-destructive"
                          : "text-emerald-400"
                      }
                    >
                      {conexion.apiUsagePercent ?? 0}%
                    </strong>
                    {conexion.apiAccessTier && (
                      <Badge variant="secondary">{conexion.apiAccessTier}</Badge>
                    )}
                  </span>
                  {(conexion.apiUsagePercent ?? 0) >= UMBRAL_AVISO_API && (
                    <div className="mt-1 text-destructive">
                      Cerca del límite: Meta puede bloquear las llamadas. Espera unos minutos antes de
                      publicar más.
                    </div>
                  )}
                </>
              ) : (
                "Estados sin sincronizar todavía."
              )}
            </div>
            <form method="POST" action="/api/meta/sincronizar">
              <Button type="submit" variant="outline" size="sm">
                <RefreshCw className="size-4" />
                Sincronizar
              </Button>
            </form>
          </div>
        )}

        {estrategias.length > 0 && (
          <section>
            <h2 className="mb-3 text-sm font-medium text-muted-foreground">Tus estrategias</h2>
            <div className="grid gap-3">
              {estrategias.map((e) => {
                const publicadas = e.campaigns.filter((c) => c.status === "EN_META").length;
                const bloqueadas = e.campaigns.filter(
                  (c) => estadoCumplimiento(c, organization.privacyPolicyUrl).bloquea
                ).length;
                return (
                  <Link
                    key={e.id}
                    href={`/estrategias/${e.id}`}
                    className="block rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">{e.name}</span>
                      <Badge variant="secondary">Nivel {e.nivel}</Badge>
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      ${e.monthlyBudgetClp.toLocaleString("es-CL")}/mes · {publicadas}/
                      {e.campaigns.length} campañas en Meta
                    </div>
                    <div
                      className={`mt-2 flex items-center gap-1.5 text-xs ${
                        bloqueadas > 0 ? "text-destructive" : "text-emerald-400"
                      }`}
                    >
                      {bloqueadas > 0 ? (
                        <>
                          <ShieldAlert className="size-3.5" />
                          {bloqueadas} de {e.campaigns.length} no se pueden publicar
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="size-3.5" />
                          Todas cumplen los requisitos
                        </>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        <section>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">
            {estrategias.length > 0 ? "Tus campañas sueltas" : "Tus campañas"}
          </h2>

          {campanas.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-10 text-center">
              <Megaphone className="mx-auto mb-3 size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Todavía no hay campañas. Crea una campaña única o una estrategia completa.
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              {campanas.map((c) => {
                const cumpl = estadoCumplimiento(c, organization.privacyPolicyUrl);
                const estadoMeta = c.effectiveStatus ? describirEstadoMeta(c.effectiveStatus) : null;
                return (
                  <Link
                    key={c.id}
                    href={`/campanas/${c.id}`}
                    className="block rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">{c.name}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{c.status}</Badge>
                        {estadoMeta && (
                          <span className={`text-xs ${COLOR_TONO[estadoMeta.tono] ?? ""}`}>
                            {estadoMeta.texto}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {c.objective} · ${c.budgetAmountClp.toLocaleString("es-CL")}/día
                    </div>
                    <div
                      className={`mt-2 flex items-center gap-1.5 text-xs ${
                        cumpl.bloquea
                          ? "text-destructive"
                          : cumpl.total > 0
                            ? "text-amber-400"
                            : "text-emerald-400"
                      }`}
                    >
                      {cumpl.bloquea ? (
                        <>
                          <ShieldAlert className="size-3.5" />
                          No se puede publicar: {cumpl.total} problema
                          {cumpl.total === 1 ? "" : "s"} de cumplimiento
                        </>
                      ) : cumpl.total > 0 ? (
                        <>
                          <ShieldAlert className="size-3.5" />
                          {cumpl.total} advertencia{cumpl.total === 1 ? "" : "s"}
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="size-3.5" />
                          Cumplimiento sin observaciones
                        </>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
