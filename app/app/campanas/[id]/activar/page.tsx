import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { AlertTriangle, Play } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { resolveOrganizationForUser } from "@/lib/org";
import { Button, buttonVariants } from "@/components/ui/button";

// Página de confirmación para activar una campaña. Existe porque activar empieza a
// gastar dinero real de la cuenta publicitaria: la regla del proyecto es que eso
// nunca ocurra con un solo clic (ver CLAUDE.md).
export default async function ActivarCampanaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const organization = await resolveOrganizationForUser(user);
  if (!organization) redirect("/conectar");

  const { id } = await params;
  const campaign = await prisma.campaign.findFirst({
    where: { id, organizationId: organization.id },
    include: { adSets: { include: { ads: true } } },
  });
  if (!campaign) notFound();

  const conjuntos = campaign.adSets.length;
  const anunciosEnMeta = campaign.adSets.reduce(
    (n, s) => n + s.ads.filter((a) => a.status === "EN_META").length,
    0
  );
  const gastoDiario = campaign.adSets.reduce(
    (n, s) => n + (s.dailyBudgetClp ?? campaign.budgetAmountClp),
    0
  );

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-lg">
        <div className="rounded-xl border border-destructive/40 bg-card p-6 shadow-[0_0_50px_-20px] shadow-destructive/40">
          <div className="mb-4 flex items-center gap-2">
            <AlertTriangle className="size-5 text-destructive" />
            <h1 className="text-lg font-semibold">Activar campaña</h1>
          </div>

          <p className="text-sm text-muted-foreground">
            Estás por activar <strong className="text-foreground">{campaign.name}</strong> en Meta.
          </p>

          <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 p-4">
            <p className="font-medium text-destructive">
              Esto empieza a gastar dinero real de la cuenta publicitaria.
            </p>
            <ul className="mt-3 space-y-1.5 text-sm">
              <li className="flex justify-between gap-4">
                <span className="text-muted-foreground">Gasto diario</span>
                <strong>${gastoDiario.toLocaleString("es-CL")}</strong>
              </li>
              <li className="flex justify-between gap-4">
                <span className="text-muted-foreground">Equivale al mes</span>
                <strong>${(gastoDiario * 30).toLocaleString("es-CL")}</strong>
              </li>
              <li className="flex justify-between gap-4">
                <span className="text-muted-foreground">Conjuntos / anuncios</span>
                <strong>
                  {conjuntos} / {anunciosEnMeta}
                </strong>
              </li>
            </ul>
          </div>

          {anunciosEnMeta === 0 && (
            <p className="mt-4 text-sm text-amber-400">
              Esta campaña no tiene anuncios creados en Meta: activarla no mostraría nada. Conviene
              crear los anuncios primero.
            </p>
          )}

          <p className="mt-4 text-xs text-muted-foreground">
            El cobro lo hace Meta directamente al medio de pago de la cuenta publicitaria; esta app no
            procesa pagos.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <form method="POST" action={`/api/campanas/${campaign.id}/estado`}>
              <input type="hidden" name="accion" value="activar" />
              <input type="hidden" name="confirmo" value="si" />
              <Button type="submit" variant="destructive" className="h-10">
                <Play className="size-4" />
                Sí, activar y empezar a gastar
              </Button>
            </form>
            <Link
              href={`/campanas/${campaign.id}`}
              className={buttonVariants({ variant: "outline", className: "h-10" })}
            >
              Cancelar
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
