import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { Trash2, AlertTriangle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { resolveOrganizationForUser } from "@/lib/org";
import { PALABRA_CONFIRMACION } from "@/lib/borrado";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default async function BorrarEstrategiaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const organization = await resolveOrganizationForUser(user);
  if (!organization) redirect("/conectar");

  const { id } = await params;
  const estrategia = await prisma.strategy.findFirst({
    where: { id, organizationId: organization.id },
    include: { campaigns: { include: { adSets: { include: { ads: true } } } } },
  });
  if (!estrategia) notFound();

  const conjuntos = estrategia.campaigns.reduce((n, c) => n + c.adSets.length, 0);
  const anuncios = estrategia.campaigns.reduce(
    (n, c) => n + c.adSets.reduce((m, s) => m + s.ads.length, 0),
    0
  );
  const enMeta = estrategia.campaigns.filter((c) => c.metaCampaignId).length;

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-lg">
        <div className="rounded-xl border border-destructive/40 bg-card p-6 shadow-[0_0_50px_-20px] shadow-destructive/40">
          <div className="mb-4 flex items-center gap-2">
            <Trash2 className="size-5 text-destructive" />
            <h1 className="text-lg font-semibold">Borrar estrategia</h1>
          </div>

          <p className="text-sm text-muted-foreground">
            Estás por borrar <strong className="text-foreground">{estrategia.name}</strong> y todo lo
            que generó.
          </p>

          <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 p-4">
            <p className="flex items-center gap-2 font-medium text-destructive">
              <AlertTriangle className="size-4" />
              Esta acción no se puede deshacer desde la app.
            </p>
            <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-muted-foreground">
              <li>
                <strong className="text-foreground">{estrategia.campaigns.length} campañas</strong>,{" "}
                {conjuntos} conjuntos y {anuncios} anuncios
              </li>
              <li>Los copys generados y el historial de cumplimiento</li>
              <li>
                {enMeta > 0
                  ? `${enMeta} campaña(s) se borran también en Meta`
                  : "Ninguna llegó a publicarse en Meta"}
              </li>
            </ul>
          </div>

          <form
            method="POST"
            action={`/api/estrategias/${estrategia.id}/borrar`}
            className="mt-6 space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="confirmacion">
                Para confirmar, escribe{" "}
                <strong className="font-mono text-destructive">{PALABRA_CONFIRMACION}</strong>
              </Label>
              <Input
                id="confirmacion"
                name="confirmacion"
                required
                autoComplete="off"
                placeholder={PALABRA_CONFIRMACION}
                className="h-10"
              />
            </div>

            <div className="flex flex-wrap gap-3">
              <Button type="submit" variant="destructive" className="h-10">
                <Trash2 className="size-4" />
                Borrar estrategia completa
              </Button>
              <Link
                href={`/estrategias/${estrategia.id}`}
                className={buttonVariants({ variant: "outline", className: "h-10" })}
              >
                Cancelar
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
