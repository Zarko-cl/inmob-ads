import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { ArrowLeft, Trash2, Upload } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { resolveOrganizationForUser } from "@/lib/org";
import { CAMPAIGN_TYPES, type CampaignTypeKey } from "@/lib/meta-campaign-types";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AppShell, Aviso } from "@/app/components/app-shell";

export default async function EstrategiaDetallePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const organization = await resolveOrganizationForUser(user);
  if (!organization) redirect("/conectar");

  const { id } = await params;
  const { error: errorBorrado } = await searchParams;
  const estrategia = await prisma.strategy.findFirst({
    where: { id, organizationId: organization.id },
    include: {
      campaigns: {
        orderBy: { createdAt: "asc" },
        include: { adSets: { include: { ads: true }, orderBy: { createdAt: "asc" } } },
      },
    },
  });
  if (!estrategia) notFound();

  const totalAnuncios = estrategia.campaigns.reduce(
    (n, c) => n + c.adSets.reduce((m, s) => m + s.ads.length, 0),
    0
  );
  const anunciosEnMeta = estrategia.campaigns.reduce(
    (n, c) => n + c.adSets.reduce((m, s) => m + s.ads.filter((a) => a.status === "EN_META").length, 0),
    0
  );
  const pendientes = estrategia.campaigns.filter((c) => c.status !== "EN_META");
  const progreso = totalAnuncios > 0 ? Math.round((anunciosEnMeta / totalAnuncios) * 100) : 0;

  return (
    <AppShell
      titulo={estrategia.name}
      descripcion={`Nivel ${estrategia.nivel} · $${estrategia.monthlyBudgetClp.toLocaleString("es-CL")}/mes`}
      usuario={user}
      activo="/campanas"
      acciones={
        <Link href="/campanas" className={buttonVariants({ variant: "outline", size: "sm" })}>
          <ArrowLeft className="size-4" />
          Volver
        </Link>
      }
    >
      <div className="space-y-6">
        {errorBorrado && <Aviso tono="error">{errorBorrado}</Aviso>}

        {/* Progreso de publicación */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-sm text-muted-foreground">Anuncios publicados en Meta</span>
            <span className="bg-gradient-to-r from-foreground to-primary bg-clip-text text-2xl font-semibold text-transparent">
              {anunciosEnMeta}/{totalAnuncios}
            </span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-chart-2 transition-all duration-700"
              style={{ width: `${progreso}%` }}
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span>{estrategia.campaigns.length} campañas</span>
            <span>
              {estrategia.campaigns.reduce((n, c) => n + c.adSets.length, 0)} conjuntos
            </span>
            {pendientes.length > 0 && (
              <span className="text-amber-400">{pendientes.length} por publicar</span>
            )}
          </div>
        </div>

        {pendientes.length > 0 && (
          <p className="text-sm text-muted-foreground">
            Cada campaña se publica por separado: si Meta rechaza una, las demás no se ven afectadas.
          </p>
        )}

        <div className="grid gap-4">
          {estrategia.campaigns.map((campaign) => {
            const tipo = CAMPAIGN_TYPES[campaign.campaignType as CampaignTypeKey];
            return (
              <div key={campaign.id} className="tarjeta-glow rounded-xl border border-border bg-card p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link href={`/campanas/${campaign.id}`} className="font-medium hover:underline">
                    {campaign.name}
                  </Link>
                  <Badge
                    variant={campaign.status === "EN_META" ? "default" : "outline"}
                    className={campaign.status === "ERROR" ? "bg-destructive/15 text-destructive" : ""}
                  >
                    {campaign.status}
                  </Badge>
                </div>

                <div className="mt-1 text-sm text-muted-foreground">
                  {tipo?.label} · ${campaign.budgetAmountClp.toLocaleString("es-CL")}/día por conjunto
                </div>

                {campaign.errorMessage && (
                  <p className="mt-2 text-sm text-destructive">{campaign.errorMessage}</p>
                )}

                <ul className="mt-3 space-y-1.5">
                  {campaign.adSets.map((conjunto) => {
                    const enMeta = conjunto.ads.filter((a) => a.status === "EN_META").length;
                    const conError = conjunto.ads.filter((a) => a.status === "ERROR").length;
                    const pct = conjunto.ads.length
                      ? Math.round((enMeta / conjunto.ads.length) * 100)
                      : 0;
                    return (
                      <li key={conjunto.id} className="text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-muted-foreground">{conjunto.name}</span>
                          <span className="text-xs">
                            {enMeta}/{conjunto.ads.length} anuncios
                            {conError > 0 && (
                              <span className="text-destructive"> · {conError} con error</span>
                            )}
                          </span>
                        </div>
                        <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary/70 transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>

                {(campaign.status !== "EN_META" || anunciosEnMeta < totalAnuncios) && (
                  <form
                    method="POST"
                    action={`/api/campanas/${campaign.id}/publicar`}
                    className="mt-4"
                  >
                    <Button type="submit" size="sm">
                      <Upload className="size-4" />
                      {campaign.status === "EN_META"
                        ? "Reintentar anuncios"
                        : "Publicar en Meta (pausada)"}
                    </Button>
                  </form>
                )}
              </div>
            );
          })}
        </div>

        <div className="border-t border-border pt-6">
          <Link
            href={`/estrategias/${estrategia.id}/borrar`}
            className="inline-flex items-center gap-1.5 text-sm text-destructive hover:underline"
          >
            <Trash2 className="size-4" />
            Borrar esta estrategia completa
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
